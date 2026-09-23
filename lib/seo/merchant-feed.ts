/**
 * Google-Merchant-Center-Produktfeed — reine Funktionen, kein React, kein Netz.
 *
 * WAS DAS IST
 * Die Datei, die das Merchant Center täglich unter /merchant-feed.tsv abholt
 * («geplanter Abruf»), statt dass jemand eine TSV von Hand hochlädt. Vorlage
 * und Begründung der Spaltenwahl: medusa-ecom/export/merchant-center/README.md
 * (Stand des alten Odoo-Shops). Hier steht dieselbe Spaltenwahl, jetzt aus
 * Medusa gespeist — abzüglich dessen, was es seit dem neuen Shop nicht mehr
 * gibt (ein Versandpreis -> kein `shipping_label`).
 *
 * KONSISTENZ MIT DEM JSON-LD IST DER PUNKT
 * Google gleicht jede Feed-Zeile mit der Landingpage ab und aktualisiert
 * Preis und Verfügbarkeit automatisch aus deren strukturierten Daten
 * («automatische Artikelaktualisierungen»). Das funktioniert nur, wenn Feed
 * und Seite dasselbe sagen: gleiche URL (`link` = `Offer.url`), gleiches Bild
 * (`image_link` = erstes `image`), gleicher Preis (`price` = `Offer.price`),
 * gleiche Verfügbarkeit. Deshalb rechnet dieses Modul NICHTS selbst, was
 * lib/seo/jsonld.ts schon rechnet — es ruft dieselben Helfer.
 *
 * FORMAT (Google, «Dateiformate»)
 * UTF-8, erste Zeile die englischen Attributnamen, eine Zeile je Artikel,
 * Tabulator als Trenner. In Feldern keine Tabs, Zeilenumbrüche oder geraden
 * Anführungszeichen (`sanitize`), Dezimalpunkt, Preis als `12.34 CHF`.
 *
 * EHRLICHKEIT
 * Alle Produkte kommen in den Feed, auch die, die Google nach der
 * Tabakzubehör-Richtlinie voraussichtlich ablehnt. Kategorisiert wird
 * wahrheitsgemäss (600 «Rauchzubehör» für Papers und Filter) — eine
 * Tarnkategorie wäre «Misrepresentation» und kostet das Konto, nicht nur den
 * Artikel. `custom_label_0` trägt die erwartete Richtlinien-Einordnung, damit
 * sich die Gruppen im Merchant Center filtern lassen.
 */

import { STORE } from "../config";
import { normalizeGtin } from "../gtin";
import { unitPriceFor } from "../pricing";
import type { CategoryView, ProductView, ProductVariantView } from "../types";
import { absoluteImages, imagesForVariant, money, productUrl, variantUrl } from "./jsonld";

/* ─── Spalten ────────────────────────────────────────────────────── */

/**
 * Die Kopfzeile — Googles Attributnamen, in dieser Reihenfolge.
 *
 * Bewusst NICHT dabei:
 *   - `shipping`, `shipping_label`: Versand steht auf Kontoebene (ein Preis,
 *     gratis ab Schwelle); ein Label bräuchte es nur bei mehreren Tarifen.
 *   - `sale_price`: `price` ist der aktuelle Preis; Streichpreise sind im
 *     Sinn der Google-Regeln (30 Tage verlangt, 5–90 % Rabatt) nicht belegt.
 *   - `item_group_id`, `multipack`: Einzelstück und Display sind
 *     Herstellergebinde mit eigener GTIN, keine Google-Varianten.
 *   - `unit_pricing_measure`/`_base_measure`: Medusa kennt die Inhaltsmenge
 *     (120 Filter, 5 m Rolle) nicht — nichts erfinden.
 */
export const MERCHANT_FEED_COLUMNS = [
  "id",
  "title",
  "description",
  "link",
  "image_link",
  "availability",
  "price",
  "brand",
  "gtin",
  "identifier_exists",
  "condition",
  "google_product_category",
  "product_type",
  "color",
  "material",
  "custom_label_0",
  "custom_label_1",
] as const;

export type MerchantFeedColumn = (typeof MERCHANT_FEED_COLUMNS)[number];
export type MerchantFeedRow = Record<MerchantFeedColumn, string>;

/* ─── Kategorien ─────────────────────────────────────────────────── */

/**
 * Google-Produktkategorie (Taxonomie-ID) und Richtlinien-Erwartung je
 * Shop-Kategorie, geschlüsselt über das Kategorie-Handle aus Medusa.
 *
 * Die Handles entstehen im Backend aus den Kategorienamen des Katalog-Imports
 * (medusa-ecom backend/src/scripts/import-catalog.ts `categoryFor`: Papers,
 * Filter, Aschenbecher, Zubehör) — `zubehör` normalisiert lib/adapters.ts zu
 * `zubehoer`. Was nicht in dieser Tabelle steht, bekommt KEINE
 * Google-Kategorie: «Zubehör» ist ein Sammelkorb (Dosen, Grinder, …), für
 * den es keine eine ehrliche Zuordnung gibt. Google ordnet dann selbst zu.
 *
 *   600  Heim & Garten > Rauchzubehör
 *   4082 Heim & Garten > Rauchzubehör > Aschenbecher
 */
const CATEGORY_RULES: Record<
  string,
  { googleCategory: string; policyLabel: string }
> = {
  papers: { googleCategory: "600", policyLabel: "tabakzubehoer-papers" },
  filter: { googleCategory: "600", policyLabel: "tabakzubehoer-filter" },
  aschenbecher: { googleCategory: "4082", policyLabel: "zubehoer-unkritisch" },
};

/**
 * Ein Aschenbecher ist ein Aschenbecher, auch wenn er im Admin unter
 * «Zubehör» liegt (so im Mock-Katalog). Dieselbe Erkennung wie im Backend.
 */
const ASHTRAY = /aschenbecher|ashtray/i;

function categoryRule(product: ProductView) {
  return (
    CATEGORY_RULES[product.categoryHandle] ??
    (ASHTRAY.test(product.title) ? CATEGORY_RULES.aschenbecher : undefined)
  );
}

/** `custom_label_1`: die Packungsart, wie sie der Katalog führt. */
const PACK_LABEL: Record<ProductVariantView["packType"], string> = {
  single: "einzeln",
  display: "display",
  box: "box",
};

/* ─── Felder ─────────────────────────────────────────────────────── */

/**
 * Ein Feldwert, der in einer TSV-Zeile nichts kaputt macht: keine Tabs
 * (Spaltentrenner), keine Zeilenumbrüche (Zeilentrenner), keine geraden
 * Anführungszeichen (manche Parser lesen sie als Quoting). Alles davon wird
 * zu einem Leerzeichen bzw. entfernt, Mehrfach-Leerraum zusammengezogen.
 */
export function sanitize(value: string | undefined | null): string {
  return (value ?? "")
    .replace(/[\t\r\n\v\f]+/g, " ")
    .replace(/"/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Google: `title` ≤ 150 Zeichen, `description` ≤ 5000. Hart abgeschnitten. */
const TITLE_MAX = 150;
const DESCRIPTION_MAX = 5000;

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max).trimEnd() : value;
}

/** `12.34 CHF` — Dezimalpunkt, zwei Stellen, Währung dahinter. */
export function feedPrice(amount: number, currency: string): string {
  return `${money(amount)} ${currency}`;
}

/* ─── Zeilen ─────────────────────────────────────────────────────── */

export interface MerchantFeedOptions {
  products: ProductView[];
  /** Zur Auflösung des Kategorienamens für `product_type`. */
  categories?: CategoryView[];
  /** Öffentliche Domain des Mandanten (TenantTheme.domain). */
  domain: string;
  /** Normalisierter Host des Mandanten — für die Bildproxy-Pfade. */
  host: string;
}

/**
 * Eine Zeile je Variante.
 *
 * Ein Produkt mit einer Variante ergibt eine Zeile mit der kanonischen
 * Produkt-URL; mehrere Varianten ergeben je eine Zeile mit der Varianten-URL
 * (`?variant=<id>`) — genau die Adressen, die das JSON-LD als `Offer.url`
 * führt, und die Seite wählt die Packung dort serverseitig vor.
 */
export function merchantFeedRows({
  products,
  categories = [],
  domain,
  host,
}: MerchantFeedOptions): MerchantFeedRow[] {
  const categoryName = new Map(categories.map((c) => [c.handle, c.name]));
  const rows: MerchantFeedRow[] = [];

  for (const product of products) {
    const single = product.variants.length === 1;
    const rule = categoryRule(product);
    const currency = product.currency || STORE.currency;
    const baseDescription = product.description || product.subtitle;

    for (const variant of product.variants) {
      // Preis für EIN Stück dieser Packung — dieselbe Zahl wie `Offer.price`
      // im JSON-LD; die Rabattstufen darüber kennt Google nicht.
      const unit = unitPriceFor(variant.tiers, 1, variant.price);
      const gtin = normalizeGtin(variant.gtin) ?? "";
      const [image] = absoluteImages(
        imagesForVariant(product, variant),
        domain,
        host,
      );

      rows.push({
        // Die SKU ist stabil über Umbenennungen; die Artikelhistorie im
        // Merchant Center hängt an dieser id. Ohne SKU die Medusa-ID — auch
        // stabil, nur nicht sprechend.
        id: sanitize(variant.sku || variant.id),
        title: clip(
          sanitize(single ? product.title : `${product.title} – ${variant.title}`),
          TITLE_MAX,
        ),
        description: clip(
          sanitize(
            single || !baseDescription
              ? baseDescription
              : `${variant.title}: ${baseDescription}`,
          ),
          DESCRIPTION_MAX,
        ),
        link: single
          ? productUrl(domain, product.handle)
          : variantUrl(domain, product.handle, variant.id),
        image_link: image ?? "",
        availability: variant.inStock ? "in_stock" : "out_of_stock",
        price: feedPrice(unit, currency),
        brand: sanitize(product.brand),
        gtin,
        // Nie `no`: Markenartikel HABEN eine GTIN, auch wenn sie hier nicht
        // gepflegt ist. `yes` ist Googles Standardwert; ohne Marke und ohne
        // Nummer bleibt das Feld leer — nicht sicher genug für ein `no`.
        identifier_exists: (product.brand || gtin) ? "yes" : "",
        condition: "new",
        google_product_category: rule?.googleCategory ?? "",
        product_type: sanitize(categoryName.get(product.categoryHandle)),
        color: sanitize(variant.color),
        material: sanitize(variant.material ?? product.material),
        custom_label_0: rule?.policyLabel ?? "",
        custom_label_1: PACK_LABEL[variant.packType],
      });
    }
  }

  return rows;
}

/** Kopfzeile plus Zeilen, `\n`-getrennt, mit abschliessendem Zeilenumbruch. */
export function renderMerchantFeed(rows: MerchantFeedRow[]): string {
  const lines = [
    MERCHANT_FEED_COLUMNS.join("\t"),
    ...rows.map((row) => MERCHANT_FEED_COLUMNS.map((c) => row[c]).join("\t")),
  ];
  return lines.join("\n") + "\n";
}

/** Produkte rein, fertige TSV raus. */
export function buildMerchantFeed(options: MerchantFeedOptions): string {
  return renderMerchantFeed(merchantFeedRows(options));
}
