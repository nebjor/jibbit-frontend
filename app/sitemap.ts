import type { MetadataRoute } from "next";
import { getProducts, getCategories } from "@/lib/data";
import { getTenantContext } from "@/lib/tenant/context";
import { isSiteIndexable } from "@/lib/seo/indexing";
import { sitemapEntries } from "@/lib/seo/sitemap";

/**
 * /sitemap.xml — je Anfrage erzeugt, nie beim Build eingefroren.
 *
 * MULTI-TENANT: every URL below must be under the resolved tenant's own domain.
 *
 * Was hineingehört, entscheidet lib/seo/sitemap.ts (dort getestet); diese
 * Datei holt nur die Daten.
 *
 * EINE LEERE SITEMAP GIBT ES NUR MIT ABSICHT — auf einem gesperrten
 * Deployment (Staging, SITE_INDEXABLE nicht gesetzt). Auf einem
 * indexierbaren Deployment gilt:
 *
 *   - Backend nicht erreichbar -> `getProducts()` wirft
 *     (CatalogUnavailableError), die Route antwortet mit 5xx. Google behält
 *     dann die zuletzt gelesene Sitemap und versucht es später erneut. Eine
 *     Sitemap ohne Produkte mit Status 200 hiesse dagegen «diese Seiten gibt
 *     es nicht mehr».
 *   - Backend liefert null Produkte oder null Kategorien -> die Sitemap wird
 *     ausgeliefert (die übrigen Seiten stimmen ja), aber es steht als Fehler
 *     im Log.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Zuerst der Tenant: der Header-Zugriff hält die Route dynamisch, der
  // Schalter darunter wird also je Anfrage gelesen und nicht beim Build
  // eingefroren (siehe app/robots.ts).
  const tenant = await getTenantContext();

  // Gesperrtes Deployment (Staging): eine LEERE Sitemap — gültiges XML ohne
  // eine einzige URL, und ohne das Backend überhaupt zu fragen. Die
  // robots.txt verweist in diesem Zustand auch nicht mehr hierher.
  if (!isSiteIndexable()) return [];

  let products, categories;
  try {
    [products, categories] = await Promise.all([
      getProducts(),
      getCategories(),
    ]);
  } catch (err) {
    console.error(
      `[seo:${tenant.id}] sitemap.xml: Katalog nicht abrufbar — die Route ` +
        "antwortet mit einem Fehler statt mit einer Sitemap ohne Produkte.",
      err,
    );
    throw err;
  }

  if (products.length === 0 || categories.length === 0) {
    console.error(
      `[seo:${tenant.id}] sitemap.xml: ${products.length} Produkte, ` +
        `${categories.length} Kategorien — die Sitemap ist unvollständig. ` +
        "Backend und Publishable Key prüfen.",
    );
  }

  return sitemapEntries({
    domain: tenant.theme.domain,
    host: tenant.host,
    products,
    categories,
  });
}
