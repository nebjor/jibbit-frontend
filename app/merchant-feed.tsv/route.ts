import { unstable_cache } from "next/cache";
import {
  CatalogUnavailableError,
  getCategoriesForTenant,
  getProductsForTenant,
} from "@/lib/data";
import { FEATURES } from "@/lib/config";
import { buildMerchantFeed } from "@/lib/seo/merchant-feed";
import { getTenantContext } from "@/lib/tenant/context";
import type { TenantConfig } from "@/lib/tenant/types";

/**
 * /merchant-feed.tsv — der Google-Merchant-Center-Feed, live aus Medusa.
 *
 * Das Merchant Center holt die Datei per «geplantem Abruf» einmal täglich
 * (Einrichtung: docs/seo/merchant-feed.md). Erzeugt wird sie aus denselben
 * Produktdaten wie die Produktseiten; die Zeilenlogik steht in
 * lib/seo/merchant-feed.ts und ist dort getestet — dieser Handler holt nur
 * Daten und setzt Header.
 *
 * CACHING: eine Stunde je Mandant. Die Route ist wegen der Mandanten-
 * auflösung (`headers()`) dynamisch, ein `revalidate`-Segment-Export griffe
 * also nicht; stattdessen `unstable_cache` um die Erzeugung, mit dem
 * Mandanten ALS ARGUMENT — Request-APIs sind in einem Cache-Scope nicht
 * erlaubt, deshalb `getProductsForTenant` statt `getProducts`. Der
 * Cache-Schlüssel enthält die Mandanten-ID, damit sich zwei Shops nie
 * gegenseitig den Feed liefern.
 *
 * KEINE INDEX-SPERRE: Staging sendet `X-Robots-Tag: noindex` (proxy.ts) —
 * das betrifft die Suche, nicht den Feed-Abruf; robots.txt erlaubt in beiden
 * Zuständen alles. Der Feed ist also auch dort abrufbar, was zum Testen der
 * Einrichtung erwünscht ist.
 *
 * BACKEND WEG -> 503, NIE EIN LEERER FEED. Ein Feed ohne Zeilen mit Status
 * 200 wäre für Google die Aussage «alle Artikel gelöscht». Bei einem
 * Fehlerstatus behält das Merchant Center den letzten erfolgreichen Abruf
 * und versucht es später erneut — genau das Richtige bei einer Störung.
 */

const REVALIDATE_SECONDS = 3600;

async function renderFeed(tenant: TenantConfig): Promise<string> {
  const [products, categories] = await Promise.all([
    getProductsForTenant(tenant),
    getCategoriesForTenant(tenant),
  ]);
  return buildMerchantFeed({
    products,
    categories,
    domain: tenant.theme.domain,
    host: tenant.host,
  });
}

export async function GET(): Promise<Response> {
  // Shop ohne Merchant-Center-Feed (shop.config.ts, `features.merchantFeed`).
  if (!FEATURES.merchantFeed) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const tenant = await getTenantContext();

  const cached = unstable_cache(
    () => renderFeed(tenant),
    ["merchant-feed", tenant.id],
    { revalidate: REVALIDATE_SECONDS, tags: ["merchant-feed"] },
  );
  let body: string;
  try {
    body = await cached();
  } catch (err) {
    if (!(err instanceof CatalogUnavailableError)) throw err;
    return new Response("Katalog nicht verfügbar", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Retry-After": "600",
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(body, {
    headers: {
      "Content-Type": "text/tab-separated-values; charset=utf-8",
      // Zwischenspeicher davor (nginx, CDN) dürfen dieselbe Stunde halten.
      "Cache-Control": `public, max-age=0, s-maxage=${REVALIDATE_SECONDS}`,
    },
  });
}
