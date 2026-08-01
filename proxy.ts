import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { TENANT_CONFIG_HEADER } from "@/lib/tenant/constants";
import { resolveTenantConfig } from "@/lib/tenant/config-cache";
import { encodeTenantHeader } from "@/lib/tenant/header-codec";
import { resolveLocalFallbackTenant } from "@/lib/tenant/local-fallback";
import { classifyHost } from "@/lib/tenant/resolve-host";

/**
 * Host-based tenant resolution — the front door of multi-tenancy.
 *
 * Runs before any data fetch, for every route except static assets (see
 * `config.matcher` below — this deliberately does NOT exclude
 * `sitemap.xml`/`robots.txt`: those are tenant-specific too and need the
 * header set just like any page).
 *
 * Two hard rules from the design doc, both enforced right here:
 *   - Unknown host -> 404. Never a default tenant (§3 principles: blast
 *     radius of one; a misconfigured DNS record must not leak another
 *     tenant's store).
 *   - The control plane is never *directly* on this request's latency path
 *     except on a cold cache (see lib/tenant/config-cache.ts) — `resolveTenantConfig`
 *     is what implements the last-known-good fallback, this file just calls it.
 */
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const rawHost = request.headers.get("host") ?? "";

  const local = resolveLocalFallbackTenant();
  const tenant =
    local ??
    (await resolveTenantConfig(rawHost, {
      waitUntil: (p) => event.waitUntil(p),
    }));

  if (!tenant) {
    // Observability only — BASE_DOMAIN never changes *how* a host is looked
    // up (both forms are resolved the same way, against the same control
    // plane, by the same normalized host string; see resolve-host.ts's doc
    // comment). It's what lets an operator tell "unknown subdomain of ours"
    // apart from "unknown custom domain" in the logs.
    if (process.env.BASE_DOMAIN) {
      const { kind } = classifyHost(rawHost, process.env.BASE_DOMAIN);
      console.warn(`[tenant] 404: unresolvable host "${rawHost}" (${kind})`);
    }
    // Requirement 2: never fall back to a default tenant. There is also no
    // tenant to brand a 404 page for, so this is deliberately a plain
    // response rather than rendering the app's (tenant-flavoured) not-found
    // page — Proxy is documented as not the place for that kind of work
    // anyway ("not intended for slow data fetching" / heavy logic).
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const requestHeaders = new Headers(request.headers);
  // Defense in depth: a client could send its own x-tenant-config header
  // trying to smuggle a different tenant past a downstream consumer. Strip
  // before setting ours so there is never a moment where two values exist.
  requestHeaders.delete(TENANT_CONFIG_HEADER);
  requestHeaders.set(TENANT_CONFIG_HEADER, encodeTenantHeader(tenant));

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    // Everything except static assets and the favicon. Sitemap/robots are
    // intentionally NOT excluded — they render per-tenant domain data.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
