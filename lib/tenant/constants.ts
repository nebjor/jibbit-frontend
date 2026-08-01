/**
 * The request header `proxy.ts` uses to hand the resolved `TenantConfig` to
 * the rest of the app (server components, route handlers). Encoded — see
 * `header-codec.ts` — because tenant theme strings are de-CH content and can
 * contain non-ASCII characters (umlauts), which raw header values mangle.
 *
 * Shared between `proxy.ts` and `lib/tenant/context.ts` so the name can only
 * ever drift in one place.
 */
export const TENANT_CONFIG_HEADER = "x-tenant-config";
