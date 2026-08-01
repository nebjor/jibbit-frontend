/**
 * Multi-tenant types.
 *
 * A `TenantConfig` is everything the storefront needs to serve one tenant's
 * store: which Medusa backend to talk to, which publishable key to send, and
 * enough branding to render correct metadata. It is resolved once per
 * request (by `proxy.ts`, from the `Host` header) and carried through the
 * rest of the request via the `x-tenant-config` header — see
 * `lib/tenant/context.ts` for how server components read it back out.
 */

export interface TenantTheme {
  /** Display name, e.g. "jibbit". Used for <title>, OG siteName, etc. */
  storeName: string;
  /** Public-facing domain (subdomain or custom domain) for canonical URLs. */
  domain: string;
  /** Mirrors the tenant's `--c-ground` token; emitted as <meta name="theme-color">. */
  themeColor: string;
}

export interface TenantConfig {
  /** Stable id from the control plane. Used as the cache/memoization key. */
  id: string;
  /** The normalized host this config was resolved for (lowercase, no port). */
  host: string;
  /** This tenant's Medusa backend base URL. */
  backendUrl: string;
  /** This tenant's publishable API key. Never expose across tenants — see lib/medusa.ts. */
  publishableKey: string;
  theme: TenantTheme;
}
