import { NextResponse } from "next/server";
import { resolveTenantForHost } from "@/lib/tenant/resolve-tenant";
import { parseMediaPath } from "@/lib/media";

/**
 * Bildproxy: `/media/<host>/<key>` -> `<tenant.backendUrl>/static/<key>`.
 *
 * WARUM ES DIESE ROUTE GIBT — kurz: die Backend-URL eines Tenants ist im
 * Regelfall nicht öffentlich erreichbar (im Compose `http://medusa:9000`), und
 * `images.remotePatterns` ist eine Build-Zeit-Angabe, die in einer
 * mehrmandantenfähigen Storefront niemand vollständig kennen kann. Die lange
 * Fassung steht in lib/media.ts und next.config.ts.
 *
 * WARUM DER HOST IM PFAD STEHT UND NICHT IM HEADER
 * Das ist der unschöne Teil, und er hat einen harten Grund. Optimiert
 * `next/image` einen RELATIVEN Pfad, ruft es diesen Handler nicht über HTTP
 * auf, sondern baut sich einen synthetischen Request:
 *
 *   createRequestResponseMocks({ url: href, method, socket })
 *   (next/dist/server/image-optimizer.js, `fetchInternalImage`)
 *
 * Dieser Request trägt KEINE EINZIGE HEADER-ZEILE — weder den Host noch den
 * `x-tenant-config`-Header, den proxy.ts sonst setzt. Jede Auflösung über
 * `getTenantContext()` sähe hier `host: ""`, fände keinen Tenant und würde
 * jedes Produktbild mit 404 beantworten. Im `next dev` fällt das NICHT auf,
 * dort funktioniert der Header-Weg; erst der Produktionsserver stolpert
 * darüber. Der Host im Pfad ist die einzige Angabe, die diesen synthetischen
 * Request überlebt.
 *
 * WAS DAS FÜR DIE MANDANTENTRENNUNG BEDEUTET
 * Der Pfad wählt nur AUS DEN KONFIGURIERTEN Tenants aus — dieselbe Kette wie
 * in proxy.ts, unbekannter Host also weiterhin 404. Ausgeliefert werden
 * dadurch ausschliesslich Produktbilder, die auf der Storefront des jeweiligen
 * Tenants ohnehin öffentlich sind; private Uploads sind über die
 * `private-`-Regel in lib/media.ts ausgeschlossen. Was hier NICHT passieren
 * kann: eine fremde Zieladresse angeben. Diese Route nimmt keine URL entgegen,
 * nur einen Dateischlüssel — ein Parameter à la `/media?src=…` wäre ein
 * offener Proxy und damit ein Weg in interne Netze (SSRF).
 *
 * Node-Runtime, nicht Edge: die Tenant-Auflösung hängt an `server-only`-Code.
 */
export const runtime = "nodejs";

/**
 * Ein Jahr, `immutable`. Vertretbar, weil Medusas Dateischlüssel einen
 * Zeitstempel enthalten (`1787182876847-elements-kss-front.webp`): dasselbe
 * Bild erneut hochzuladen erzeugt einen NEUEN Schlüssel. Eine URL kann ihren
 * Inhalt also nicht wechseln.
 */
const CACHE_CONTROL = "public, max-age=31536000, immutable";

/** Was ein Produktbild sein darf. Alles andere wird nicht durchgereicht. */
const ALLOWED_CONTENT_TYPES = [
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/avif",
  "image/gif",
];

function notFound() {
  return new NextResponse("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;

  const parsed = parseMediaPath(path);
  if (!parsed) return notFound();

  const tenant = await resolveTenantForHost(parsed.host);
  if (!tenant) return notFound();

  const upstream = `${tenant.backendUrl.replace(/\/+$/, "")}/static/${parsed.key}`;

  let response: Response;
  try {
    response = await fetch(upstream, {
      // Weder Cookies noch Auth-Header weiterreichen: /static liefert das
      // Backend ohnehin ohne Authentifizierung aus, und was hier nicht
      // mitgeht, kann auch nicht verloren gehen.
      headers: { accept: request.headers.get("accept") ?? "image/*" },
      cache: "no-store",
    });
  } catch {
    // Backend unerreichbar. 404 statt 500: für den Aufrufer ist „das Bild gibt
    // es hier nicht" die brauchbarere Antwort, und der Bildoptimizer bricht
    // dann nur dieses eine Bild ab, statt die Seite zu vergiften.
    return notFound();
  }

  if (!response.ok || !response.body) return notFound();

  const contentType = (response.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim();
  // SVG steht bewusst NICHT auf der Liste: es kann Skripte enthalten, und ein
  // Produktbild ist nie ein SVG.
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) return notFound();

  const headers = new Headers({
    "content-type": contentType,
    "cache-control": CACHE_CONTROL,
    "x-content-type-options": "nosniff",
  });
  const length = response.headers.get("content-length");
  if (length) headers.set("content-length", length);

  return new NextResponse(response.body, { status: 200, headers });
}
