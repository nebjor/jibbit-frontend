import "server-only";

import { fetchTenantConfigFromControlPlane } from "./control-plane-client";
import { normalizeHost } from "./resolve-host";
import type { TenantConfig } from "./types";

/**
 * The tenant config cache — this is the fix for §6.2(b) in the multi-tenancy
 * design doc: "the control plane must never be on the request path."
 *
 * THE RULE THIS ENFORCES: once we have ever successfully resolved a host, a
 * control-plane outage can NEVER take that host's storefront down. Stale
 * config keeps being served, indefinitely, for as long as the outage lasts.
 * A cache that stops serving (evicts, or fails closed) when the upstream
 * errors is not a safety mechanism — it is a single point of failure with a
 * timer attached. See `resolve()` below for exactly where that guarantee is
 * implemented (short version: refresh failures never touch the stored
 * entry).
 *
 * THE ONE EXCEPTION, ACKNOWLEDGED: the very first request for a host this
 * process has never seen has no last-known-good to fall back to, so the
 * control plane is unavoidably synchronous for that one request. Every
 * subsequent request for the same host — even one arriving while the first
 * request's fetch is still in flight, even if the control plane goes down a
 * second later — is served from cache. This is bounded to cold start only;
 * it is not a loophole that reintroduces the control plane on the steady-state
 * path.
 *
 * CONCURRENCY: this module is a per-process module-level cache — the kind of
 * shared, mutable state the task brief specifically warns about. It is safe
 * here because every read and write is addressed by `host` and nothing here
 * ever holds a single "current tenant" slot that a second, unrelated request
 * could overwrite mid-flight. Compare this to the *removed* pattern in the
 * old `lib/medusa.ts`, which built one Medusa client at module load from
 * `process.env` and exported it as a bare singleton `sdk` — that was fine in
 * a single-tenant process but becomes an actual cross-tenant leak the moment
 * one process serves many tenants concurrently, because there was only ever
 * one slot for "the" backend URL and publishable key. Never reintroduce that
 * shape here: every cache in this module is keyed by tenant host/id, never a
 * single bare variable.
 */

const FRESH_TTL_MS = 60_000;
/** How long a "no tenant maps to this host" result is trusted before rechecking. */
const NEGATIVE_TTL_MS = 30_000;
/** Floor between background refresh attempts for one host, even if many requests land while stale. */
const MIN_REFRESH_INTERVAL_MS = 5_000;

interface FoundEntry {
  kind: "found";
  config: TenantConfig;
  fetchedAt: number;
  lastAttemptAt: number;
}
interface NotFoundEntry {
  kind: "not-found";
  fetchedAt: number;
}
type CacheEntry = FoundEntry | NotFoundEntry;

export type TenantFetcher = (host: string) => Promise<TenantConfig | null>;

export interface ResolveOptions {
  /**
   * Extends the lifetime of a background refresh past the current response —
   * pass `event.waitUntil` from Proxy. Optional: in a long-running Node.js
   * server (this app's deployment target) a bare fire-and-forget promise
   * still runs to completion, but in a request-scoped runtime it could be
   * killed early, so callers that have an event should always pass it.
   */
  waitUntil?: (promise: Promise<unknown>) => void;
}

/**
 * Factory rather than a bare module export, so tests get fully isolated
 * cache instances (own Map, own clock-relative TTLs, own fake fetcher) —
 * see `config-cache.test.ts`. The app itself uses the single shared instance
 * exported at the bottom of this file.
 */
export function createTenantConfigCache(fetcher: TenantFetcher, now: () => number = Date.now) {
  const store = new Map<string, CacheEntry>();
  const inFlight = new Map<string, Promise<TenantConfig | null>>();

  function fetchAndStore(key: string, host: string): Promise<TenantConfig | null> {
    const existing = inFlight.get(key);
    if (existing) return existing; // de-dupe concurrent lookups for the same never-yet-cached host

    const attempt = (async () => {
      try {
        const config = await fetcher(host);
        const t = now();
        if (config) {
          store.set(key, { kind: "found", config, fetchedAt: t, lastAttemptAt: t });
          return config;
        }
        store.set(key, { kind: "not-found", fetchedAt: t });
        return null;
      } catch {
        // Control plane unreachable / erroring / timed out. Deliberately do
        // NOT write to `store` here — see module doc comment. If an entry
        // already existed it is untouched (last-known-good keeps serving);
        // if none existed, the next request retries from scratch rather than
        // being pinned to a transient failure.
        return null;
      } finally {
        inFlight.delete(key);
      }
    })();

    inFlight.set(key, attempt);
    return attempt;
  }

  async function resolve(rawHost: string, opts: ResolveOptions = {}): Promise<TenantConfig | null> {
    const key = normalizeHost(rawHost);
    const entry = store.get(key);
    const t = now();

    if (!entry) {
      // Cold: no last-known-good exists yet. This is the one path where the
      // control plane is genuinely on the critical path — see module comment.
      return fetchAndStore(key, key);
    }

    if (entry.kind === "not-found") {
      if (t - entry.fetchedAt < NEGATIVE_TTL_MS) return null;
      // Negative-cache expired. Answer from cache immediately (still "not
      // found" as far as we know) and recheck in the background, in case the
      // tenant was provisioned since. A slow/erroring recheck must not make
      // an already-unknown host start blocking requests.
      const refresh = fetchAndStore(key, key);
      opts.waitUntil?.(refresh);
      return null;
    }

    // entry.kind === "found"
    if (t - entry.fetchedAt < FRESH_TTL_MS) return entry.config;

    // Stale-while-revalidate: serve the last-known-good value immediately,
    // and kick a background refresh — throttled so a hammered or slow
    // control plane doesn't get hit once per incoming request.
    if (t - entry.lastAttemptAt >= MIN_REFRESH_INTERVAL_MS) {
      entry.lastAttemptAt = t;
      const refresh = fetchAndStore(key, key);
      opts.waitUntil?.(refresh);
    }
    return entry.config;
  }

  return {
    resolve,
    /** Test/debug only: current cached state for a host, without triggering a fetch. */
    _peek: (rawHost: string): CacheEntry | undefined => store.get(normalizeHost(rawHost)),
    _size: (): number => store.size,
  };
}

/** The cache instance the app actually uses — proxy.ts and the RSC-side fallback in lib/tenant/context.ts both resolve against this. */
const sharedCache = createTenantConfigCache(fetchTenantConfigFromControlPlane);

export function resolveTenantConfig(
  host: string,
  opts?: ResolveOptions,
): Promise<TenantConfig | null> {
  return sharedCache.resolve(host, opts);
}
