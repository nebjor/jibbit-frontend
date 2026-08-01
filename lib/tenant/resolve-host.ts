/**
 * Pure host-parsing helpers. No I/O, no env access beyond what's passed in —
 * kept this way so tenant resolution logic is trivially unit-testable
 * without spinning up a server or a fake control plane.
 */

export type HostKind = "subdomain" | "custom-domain" | "bare-base-domain";

export interface HostLookup {
  /** How this host relates to BASE_DOMAIN — informational, not used for the actual lookup. */
  kind: HostKind;
  /** Normalized (lowercase, no port) host — this is the control-plane lookup key. */
  key: string;
  /** The subdomain label, when `kind === "subdomain"`. */
  slug?: string;
}

/** Lowercases and strips a trailing `:port`, so `Foo.Bar:8000` and `foo.bar` hit the same cache entry. */
export function normalizeHost(rawHost: string): string {
  return rawHost.trim().toLowerCase().split(":")[0];
}

/**
 * Classifies a host as one of:
 * - a `<slug>.<baseDomain>` platform subdomain (e.g. `jibbit.jibbit.app`)
 * - a fully custom domain a tenant has pointed at us (e.g. `shop.example.ch`)
 * - the bare base domain itself (e.g. `jibbit.app`), which is never a tenant
 *
 * The classification is informational (logging, tests); the actual
 * control-plane lookup uses the same normalized host string either way, since
 * the control plane is the source of truth for which domains map to which
 * tenant — this function does not need to "know" about custom domains beyond
 * telling the two cases apart.
 */
export function classifyHost(rawHost: string, baseDomain: string): HostLookup {
  const host = normalizeHost(rawHost);
  const base = normalizeHost(baseDomain);

  if (host === base) {
    return { kind: "bare-base-domain", key: host };
  }

  const suffix = `.${base}`;
  if (host.endsWith(suffix)) {
    return { kind: "subdomain", key: host, slug: host.slice(0, -suffix.length) };
  }

  return { kind: "custom-domain", key: host };
}
