import "server-only";

import { headers } from "next/headers";
import { TENANT_CONFIG_HEADER } from "./constants";
import { decodeTenantHeader } from "./header-codec";
import { resolveTenantConfig } from "./config-cache";
import type { TenantConfig } from "./types";

/**
 * The one function server components / the data layer call to find out which
 * tenant this request is for.
 *
 * Reads the `x-tenant-config` header `proxy.ts` set after resolving the
 * `Host` header. This is the primary — and in a correctly configured
 * deployment, the *only* — path: it is a plain header read, no cache lookup,
 * no control-plane call, so per-request cost is negligible regardless of
 * whether Proxy happens to share a module cache with the rendering process
 * (per Next's own docs, Proxy "should not attempt relying on shared modules
 * or globals" — so this code doesn't).
 */
export async function getTenantContext(): Promise<TenantConfig> {
  const h = await headers();
  const encoded = h.get(TENANT_CONFIG_HEADER);
  if (encoded) {
    const decoded = decodeTenantHeader(encoded);
    if (decoded) return decoded;
  }

  // Defensive fallback. This should never trigger in production — proxy.ts's
  // matcher covers every route that can reach a server component, and it
  // always sets this header before letting a request through. If we land
  // here it means either the matcher was narrowed and no longer covers this
  // route, or something upstream stripped the header — both are bugs, not
  // expected traffic. Re-resolving directly from `Host` keeps the page
  // working instead of 500ing, but it reintroduces the control plane onto
  // this one request's path, which is exactly what proxy.ts exists to avoid.
  const host = h.get("host");
  if (!host) {
    throw new Error("[tenant] request has no Host header — cannot resolve a tenant");
  }
  console.warn(
    `[tenant] "${TENANT_CONFIG_HEADER}" header missing for host "${host}" — falling back to a ` +
      "direct tenant lookup. proxy.ts should have set this header for every request; check its matcher.",
  );
  const config = await resolveTenantConfig(host);
  if (!config) {
    throw new Error(
      `[tenant] host "${host}" resolved to no tenant while rendering — proxy.ts should have returned 404 before this ran`,
    );
  }
  return config;
}
