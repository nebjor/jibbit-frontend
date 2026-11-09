/**
 * Die Einträge der Sitemap — reine Funktion, kein React, kein Netz.
 *
 * app/sitemap.ts holt die Daten und entscheidet über den Schalter
 * (SITE_INDEXABLE); was in der Datei steht, entscheidet sich hier und ist in
 * lib/seo/sitemap.test.ts geprüft. Recherche und Quellen:
 * docs/seo/sitemap-und-merchant-center.md.
 *
 * WAS HINEINGEHÖRT
 * Nur kanonische, indexierbare Adressen: Startseite, Rechtliches und Service,
 * jede Kategorieseite (`/kategorie/<handle>`, die alte Form
 * `/?kategorie=<handle>` ist eine 301), jedes veröffentlichte Produkt. NICHT hinein gehören: /shop (nur
 * noch Umleitung), /suche, /checkout, /konto (alle `noindex`) und die
 * Varianten-Adressen `?variant=<id>` — deren Canonical ist die Produktseite.
 *
 * WAS GOOGLE LIEST
 * `<loc>` und `<lastmod>`; `<priority>` und `<changefreq>` ignoriert Google.
 * `priority` bleibt trotzdem stehen — andere Suchmaschinen lesen es, und es
 * schadet nicht. `<lastmod>` steht nur an Produkten, denn nur dort gibt es
 * ein echtes Änderungsdatum (Medusa `updated_at`).
 */

import type { MetadataRoute } from "next";
import type { CategoryView, ProductView } from "../types";
import handleData from "./handle-redirects.data.json";
import { absoluteImages, productUrl } from "./jsonld";
import { categoryPath } from "./category-url";

/**
 * Seiten ohne Katalogbezug, die indexiert werden sollen.
 *
 * "/shop" fehlt bewusst: die Adresse ist nur noch eine dauerhafte Umleitung
 * auf die Startseite — Umleitungen gehören nicht in die Sitemap.
 *
 * Wer hier eine Seite ergänzt, prüft ihr `robots` in den Metadaten: eine
 * `noindex`-Seite in der Sitemap ist ein Widerspruch, den die Search Console
 * als Fehler meldet.
 */
export const SITEMAP_STATIC_PATHS = [
  "",
  "/impressum",
  "/agb",
  "/datenschutz",
  "/widerrufsrecht",
  "/service/kontakt",
  "/service/versand",
  "/service/zahlungsarten",
  "/service/rueckgabe",
  "/service/faq",
] as const;

/** Google: höchstens 1000 Bilder je `<url>`. */
const MAX_IMAGES_PER_URL = 1000;

/**
 * Next setzt `url` und Bildadressen UNVERÄNDERT in die XML-Datei
 * (next/dist/build/webpack/loaders/metadata/resolve-route-data.js). Ein `&`
 * in einer Bildadresse ergäbe ungültiges XML — und eine Sitemap, die der
 * Parser ablehnt, ist für Google gar keine.
 */
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Ein verwertbares Änderungsdatum: lesbar und nicht in der Zukunft. */
function lastModified(raw: string | undefined, now: Date): Date | undefined {
  if (!raw) return undefined;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return undefined;
  return date.getTime() > now.getTime() ? undefined : date;
}

export interface SitemapOptions {
  /** Öffentliche Domain des Mandanten (TenantTheme.domain). */
  domain: string;
  /** Normalisierter Host des Mandanten — für die Bildproxy-Pfade. */
  host: string;
  products: ProductView[];
  categories: CategoryView[];
  /** Injizierbar, damit Tests nicht altern. */
  now?: Date;
}

export function sitemapEntries({
  domain,
  host,
  products,
  categories,
  now = new Date(),
}: SitemapOptions): MetadataRoute.Sitemap {
  const base = `https://${domain}`;

  // Jede Adresse genau einmal — auch wenn das Backend ein Produkt zweimal
  // liefert (Seitenwechsel, während jemand im Admin ein Produkt anlegt).
  const seen = new Set<string>();
  const once = (entries: MetadataRoute.Sitemap) =>
    entries.filter((e) => (seen.has(e.url) ? false : (seen.add(e.url), true)));

  return once([
    ...SITEMAP_STATIC_PATHS.map((path) => ({
      url: `${base}${path}`,
      priority: path === "" ? 1 : 0.6,
    })),
    ...categories
      // Umbenannte Kategorien (z. B. «filter» → «filter-tips») sind eine 301;
      // Umleitungen gehören nicht in die Sitemap, auch wenn das Backend die
      // alte Kategorie noch ausliefert.
      .filter((c) => !Object.hasOwn(handleData.kategorien, c.handle))
      .map((c) => ({
        // Kodieren: Handles können `&` oder Umlaute enthalten.
        url: `${base}${categoryPath(c.handle)}`,
        priority: 0.8,
      })),
    ...products
      .filter((p) => p.handle)
      .map((p) => {
        const images = absoluteImages(p.images, domain, host)
          .slice(0, MAX_IMAGES_PER_URL)
          .map(xmlEscape);
        const modified = lastModified(p.updatedAt, now);
        return {
          // Dieselbe Funktion wie Canonical, JSON-LD und Merchant-Feed.
          url: xmlEscape(productUrl(domain, p.handle)),
          priority: 0.7,
          ...(modified ? { lastModified: modified } : {}),
          ...(images.length ? { images } : {}),
        };
      }),
  ]);
}
