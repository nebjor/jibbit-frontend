import "server-only";

import type { TenantConfig } from "./types";
import { normalizeHost } from "./resolve-host";

/**
 * Operator-provided tenant table, read from the `STATIC_TENANTS` env var.
 *
 * WHY THIS EXISTS
 * The control plane resolves tenants that were provisioned through the
 * platform. jibbit.ch itself is not one of them — it is the shop that existed
 * before the platform did, and it must be able to run on a box where no
 * control plane is deployed at all. Without this, a production build answers
 * every request with 404, because `resolveLocalFallbackTenant()` is hard
 * disabled whenever `NODE_ENV === "production"` (deliberately — see
 * local-fallback.ts).
 *
 * WHAT IT DOES NOT DO
 * It is NOT a default tenant. Entries are keyed by exact host, and a host
 * that appears in no entry still falls through to the control plane and then
 * to 404. The rule "an unknown host must never be served someone else's
 * store" is untouched: this table can only ever *add* known hosts.
 *
 * Format — a JSON array, each entry a TenantConfig plus optional `aliases`:
 *
 *   STATIC_TENANTS='[{
 *     "id": "jibbit",
 *     "host": "jibbit.ch",
 *     "aliases": ["www.jibbit.ch"],
 *     "backendUrl": "http://medusa:9000",
 *     "publishableKey": "pk_...",
 *     "theme": { "storeName": "jibbit", "domain": "jibbit.ch", "themeColor": "#F6F5F3" }
 *   }]'
 *
 * Server-only, and deliberately NOT prefixed `NEXT_PUBLIC_`: it carries a
 * publishable key per tenant, and a shared multi-tenant bundle must never
 * bake any single tenant's configuration into the client JS.
 */

export interface StaticTenantEntry extends TenantConfig {
  /** Extra hosts served by the same config, e.g. the www variant. */
  aliases?: string[];
}

/** host (normalized) -> config. Built once per process. */
type TenantIndex = Map<string, TenantConfig>;

let cached: TenantIndex | null = null;
let cachedFrom: string | undefined;

export function parseStaticTenants(raw: string | undefined): TenantIndex {
  const index: TenantIndex = new Map();
  if (!raw?.trim()) return index;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    // Loud, but not fatal: a malformed table must not take the process down.
    // Every host then falls through to the control plane / 404, which is the
    // safe direction to fail in.
    console.error(
      `[tenant] STATIC_TENANTS is not valid JSON — ignoring it. ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return index;
  }

  if (!Array.isArray(parsed)) {
    console.error("[tenant] STATIC_TENANTS must be a JSON array — ignoring it.");
    return index;
  }

  for (const candidate of parsed) {
    const entry = candidate as Partial<StaticTenantEntry>;
    const missing = (["id", "host", "backendUrl", "publishableKey"] as const).filter(
      (k) => typeof entry[k] !== "string" || !entry[k],
    );
    if (missing.length || !entry.theme?.storeName) {
      console.error(
        `[tenant] STATIC_TENANTS entry skipped, incomplete: ${
          missing.join(", ") || "theme.storeName"
        }`,
      );
      continue;
    }

    const config: TenantConfig = {
      id: entry.id!,
      host: normalizeHost(entry.host!),
      backendUrl: entry.backendUrl!,
      publishableKey: entry.publishableKey!,
      theme: {
        storeName: entry.theme.storeName,
        domain: entry.theme.domain ?? normalizeHost(entry.host!),
        themeColor: entry.theme.themeColor ?? "#FFFFFF",
      },
    };

    for (const host of [entry.host!, ...(entry.aliases ?? [])]) {
      const key = normalizeHost(host);
      if (!key) continue;
      // The alias keeps its own `host` so canonical URLs and logs report the
      // host that was actually requested, not the primary one.
      index.set(key, { ...config, host: key });
    }
  }

  return index;
}

/** The configured tenant for `rawHost`, or null when it is not in the table. */
export function resolveStaticTenant(rawHost: string): TenantConfig | null {
  const raw = process.env.STATIC_TENANTS;
  if (cached === null || cachedFrom !== raw) {
    cached = parseStaticTenants(raw);
    cachedFrom = raw;
  }
  return cached.get(normalizeHost(rawHost)) ?? null;
}
