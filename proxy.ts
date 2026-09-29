import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { TENANT_CONFIG_HEADER } from "@/lib/tenant/constants";
import { encodeTenantHeader } from "@/lib/tenant/header-codec";
import { resolveTenantForHost } from "@/lib/tenant/resolve-tenant";
import { classifyHost } from "@/lib/tenant/resolve-host";
import {
  applyIndexingHeader,
  isTenantlessAssetPath,
} from "@/lib/seo/indexing";
import { legacyRedirectLocation } from "@/lib/seo/legacy-redirects";
import { lowercaseProductPath } from "@/lib/seo/canonical-path";

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
 *
 * Resolution order: dev fallback, then the operator's static table, then the
 * control plane. The static table is how jibbit.ch itself is served on a box
 * with no control plane deployed — it is keyed by exact host and can only ADD
 * known hosts, so the "unknown host -> 404" rule above still holds. See
 * lib/tenant/static-tenants.ts.
 *
 * ZWEITE AUFGABE — NOINDEX FÜR GESPERRTE DEPLOYMENTS. Solange
 * SITE_INDEXABLE nicht ausdrücklich gesetzt ist (Staging), trägt JEDE Antwort,
 * die hier durchläuft, `X-Robots-Tag: noindex, nofollow` — auch das 404 für
 * unbekannte Hosts. Warum hier und nicht in `headers()` der next.config.ts:
 * deren Ergebnis friert der Build ins Routen-Manifest ein; dieser Proxy läuft
 * im Node-Prozess des Containers und liest die Umgebung je Anfrage. Schalter
 * und Begründung der sicheren Voreinstellung: lib/seo/indexing.ts.
 */
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  // Bild- und Asset-Pfade (zweiter Matcher-Block unten): KEINE
  // Tenant-Auflösung — die vertragen sie nicht, Begründung am Matcher. Sie
  // kommen nur hier vorbei, damit auch Bilder eines Staging-Deployments den
  // Noindex-Header tragen und nicht in der Bildersuche landen. Indexierbar
  // ist das ein unverändertes Durchreichen.
  if (isTenantlessAssetPath(request.nextUrl.pathname)) {
    const passthrough = NextResponse.next();
    applyIndexingHeader(passthrough.headers);
    return passthrough;
  }

  const rawHost = request.headers.get("host") ?? "";

  // Die Kette selbst steht in lib/tenant/resolve-tenant.ts — sie wird auch vom
  // Bildproxy gebraucht und darf zwischen beiden nicht auseinanderlaufen.
  const tenant = await resolveTenantForHost(rawHost, {
    waitUntil: (p) => event.waitUntil(p),
  });

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
      headers: applyIndexingHeader(
        new Headers({ "content-type": "text/plain; charset=utf-8" }),
      ),
    });
  }

  const { domain } = tenant.theme;
  const { pathname, search } = request.nextUrl;
  // Alte Odoo-Adressen: EIN Sprung aufs Ziel, Odoos Parameter (?search=,
  // ?order=) fallen weg — Begründung in lib/seo/legacy-redirects.ts.
  const legacyTarget = legacyRedirectLocation(domain, pathname, search);
  if (legacyTarget) {
    // Nicht request.nextUrl als Basis: hinter nginx trägt sie die interne Adresse.
    return NextResponse.redirect(new URL(legacyTarget, `https://${domain}`), 301);
  }

  // Gross geschriebene Produktadressen: eine Schreibweise je Produkt.
  const lowercased = lowercaseProductPath(pathname);
  if (lowercased) {
    return NextResponse.redirect(new URL(lowercased + search, `https://${domain}`), 301);
  }

  const requestHeaders = new Headers(request.headers);
  // Defense in depth: a client could send its own x-tenant-config header
  // trying to smuggle a different tenant past a downstream consumer. Strip
  // before setting ours so there is never a moment where two values exist.
  requestHeaders.delete(TENANT_CONFIG_HEADER);
  requestHeaders.set(TENANT_CONFIG_HEADER, encodeTenantHeader(tenant));

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applyIndexingHeader(response.headers);
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, the favicon and the health probe.
    // Sitemap/robots are intentionally NOT excluded — they render per-tenant
    // domain data.
    //
    // `healthz` must be excluded: the container health check connects to
    // 127.0.0.1, which is in no tenant table and would 404 forever, marking a
    // healthy container unhealthy. It serves no tenant content — see
    // app/healthz/route.ts.
    //
    // `media` muss ebenfalls draussen bleiben, und das ist keine Bequemlichkeit:
    // Wenn `next/image` einen RELATIVEN Pfad optimiert, ruft es den Handler
    // nicht über HTTP auf, sondern mit einem synthetischen Request —
    // `createRequestResponseMocks({ url, method, socket })`, siehe
    // next/dist/server/image-optimizer.js. Der trägt ÜBERHAUPT KEINE Header,
    // also auch keinen Host. Diese Funktion sähe `host: ""`, fände keinen
    // Tenant und würde jedes Produktbild mit 404 beantworten; der Optimizer
    // meldet das als „The requested resource isn't a valid image". Deshalb
    // löst app/media/[...path]/route.ts seinen Tenant aus dem PFAD auf und
    // braucht diesen Header gar nicht.
    //
    // `loader/` sind die Pixel-Art-Assets aus public/ (Lade-Sprite und
    // Fehler-Stub, siehe components/PixelJoint.tsx). Sie sind für alle
    // Tenants dieselben Bytes — eine Tenant-Auflösung hätte hier nichts zu
    // entscheiden, und ihr „unbekannter Host -> 404" würde ausgerechnet auf
    // der Fehlerseite auch noch das Fehlerbild wegnehmen.
    "/((?!_next/static|_next/image|favicon.ico|healthz|media/|loader/).*)",

    // ZWEITER BLOCK — nur für den Noindex-Header, OHNE Tenant-Auflösung
    // (`isTenantlessAssetPath` zweigt sie oben vorher ab). Der Ausschluss im
    // ersten Block bleibt deshalb unverändert gültig. Der interne Aufruf des
    // Bildoptimizers an /media ist kein HTTP-Request und kommt hier gar nicht
    // vorbei; betroffen sind nur echte Anfragen von aussen.
    //
    // Weiterhin draussen: `_next/static` (gehashte JS/CSS-Bündel — keine
    // Suchtreffer, dafür die mit Abstand meisten Anfragen), `favicon.ico` und
    // `healthz`. Wer auch die lückenlos abdecken will, setzt den Header im
    // vorgeschalteten Reverse-Proxy.
    //
    // Matcher müssen Konstanten sein (Next wertet sie beim Build statisch
    // aus) — der Schalter selbst kann hier also nicht stehen.
    "/_next/image",
    "/media/:path*",
    "/loader/:path*",
  ],
};
