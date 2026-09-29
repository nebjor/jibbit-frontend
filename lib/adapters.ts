/**
 * ADAPTER BOUNDARY — Medusa entities -> internal view types.
 *
 * This is the ONLY file that knows the shape of a Medusa product. Components
 * read `ProductView`, never `StoreProduct`. When the backend schema shifts,
 * this file changes and nothing else does.
 *
 * PRICING: Medusa v2 stores prices as decimals. CHF 27.00 arrives as `27`.
 * Never multiply or divide by 100.
 */

import type {
  StoreProduct,
  StoreProductVariant,
  StoreProductCategory,
} from "@medusajs/types";
import type {
  CategoryHandle,
  CategoryView,
  PackType,
  PriceTier,
  ProductVariantView,
  ProductView,
} from "./types";
import { normalizeGtin } from "./gtin";
import { MOCK_CATEGORIES } from "./mock-catalog";

/** variant id -> its quantity breaks, as returned by /store/price-tiers. */
export type TiersByVariant = Record<string, PriceTier[]>;

const PACK_TYPES: PackType[] = ["single", "display", "box"];

/**
 * Packaging info lives in `variant.metadata` (`units_per_pack`, `pack_type`),
 * written by the catalogue importer.
 *
 * Metadata is untyped JSON that anyone can edit in the Admin, so it is
 * validated here rather than trusted — a stray `units_per_pack: 0` must not
 * turn into a division by zero in `pricePerUnit`.
 */
function toPackaging(metadata: Record<string, unknown> | null | undefined): {
  unitsPerPack: number;
  packType: PackType;
} {
  const rawUnits = Number(metadata?.units_per_pack);
  const rawType = String(metadata?.pack_type ?? "");

  return {
    unitsPerPack:
      Number.isFinite(rawUnits) && rawUnits >= 1 ? Math.floor(rawUnits) : 1,
    packType: PACK_TYPES.includes(rawType as PackType)
      ? (rawType as PackType)
      : "single",
  };
}

/**
 * Handle normalisieren, NICHT auf eine bekannte Liste einkürzen.
 *
 * Die frühere Fassung hat jedes unbekannte Handle auf "zubehoer" gezwungen.
 * Folge im Shop: mehrere Backend-Kategorien behielten ihre Namen, zeigten
 * aber alle auf `?kategorie=zubehoer` — und bei gewählter Kategorie waren
 * alle diese Reiter gleichzeitig „aktiv". Unbekannte Handles laufen deshalb
 * unverändert durch; nur Produkte GANZ OHNE Kategorie landen im
 * Auffangkorb "zubehoer", damit sie im Mock-Filter auffindbar bleiben.
 */
function toCategoryHandle(raw: string | null | undefined): CategoryHandle {
  const h = (raw ?? "").trim().toLowerCase().replace("zubehör", "zubehoer");
  return h || "zubehoer";
}

/**
 * Die GTIN einer Variante aus Medusas drei nativen Feldern.
 *
 * Der Katalog-Import legt jede GTIN — gleich welcher Länge — in `ean` ab
 * (backend/src/scripts/gtin.ts). `upc` und `barcode` werden trotzdem gelesen,
 * falls dort im Admin von Hand ein Code gepflegt wurde. Es gewinnt der erste
 * Wert, der die Prüfung besteht — nicht der erste, der da ist: `barcode` darf
 * im Admin auch ein hauseigener Lagercode sein.
 */
function toGtin(
  v: Pick<StoreProductVariant, "ean" | "upc" | "barcode">,
): string | undefined {
  for (const raw of [v.ean, v.upc, v.barcode]) {
    const gtin = normalizeGtin(raw);
    if (gtin) return gtin;
  }
  return undefined;
}

/** Ein gepflegter, nicht leerer Text — sonst undefined. */
function nonEmpty(raw: unknown): string | undefined {
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;
}

/** Optionsnamen, die als Farbe gelten (Admin: «Farbe», englisch «Color»). */
const COLOR_OPTION = /^(farbe|colou?r)$/i;

/**
 * Die Farbe einer Variante aus den Produktoptionen.
 *
 * `variant.options` trägt nur `option_id` und `value`; den Namen der Option
 * kennt `product.options`. Die Verpackungsoption («Packung»: Einzeln /
 * Display) ist KEINE Farbe und fällt hier durch — nur eine Option, die im
 * Admin «Farbe» heisst, zählt.
 */
function toColor(
  v: Pick<StoreProductVariant, "options">,
  productOptions: StoreProduct["options"],
): string | undefined {
  const colorIds = new Set(
    (productOptions ?? [])
      .filter((o) => COLOR_OPTION.test(o.title ?? ""))
      .map((o) => o.id),
  );
  const hit = (v.options ?? []).find(
    (ov) =>
      (ov.option_id && colorIds.has(ov.option_id)) ||
      COLOR_OPTION.test(ov.option?.title ?? ""),
  );
  return nonEmpty(hit?.value);
}

/** Exportiert fuer die Regressionstests der Verfuegbarkeit
 *  (lib/product-fields.test.ts) — sonst modulintern. */
export function toVariantView(
  v: StoreProductVariant,
  tiers: PriceTier[] = [],
  productOptions: StoreProduct["options"] = null,
): ProductVariantView {
  const calc = v.calculated_price;
  return {
    id: v.id,
    title: v.title ?? "Standard",
    // Decimal CHF, used verbatim.
    price: calc?.calculated_amount ?? 0,
    compareAt:
      calc?.original_amount != null &&
      calc.calculated_amount != null &&
      calc.original_amount > calc.calculated_amount
        ? calc.original_amount
        : undefined,
    inStock:
      v.manage_inventory === false ||
      v.allow_backorder === true ||
      (v.inventory_quantity ?? 0) > 0,
    // Vorschaubild je Variante: der vorgesehene Haken für «Display zeigt die
    // Box, Heftchen das Einzelstück». Leerstrings zählen als nicht gepflegt.
    image:
      typeof v.thumbnail === "string" && v.thumbnail.trim() !== ""
        ? v.thumbnail
        : undefined,
    gtin: toGtin(v),
    sku: nonEmpty(v.sku),
    color: toColor(v, productOptions),
    material: nonEmpty(v.material),
    // A single tier is not a quantity discount — it is just the price. Drop it
    // so the product page renders no table instead of a one-row table.
    tiers: tiers.length > 1 ? tiers : [],
    ...toPackaging(v.metadata as Record<string, unknown> | null | undefined),
  };
}

export function toProductView(
  p: StoreProduct,
  tiersByVariant: TiersByVariant = {},
): ProductView {
  const variants = (p.variants ?? []).map((v) =>
    toVariantView(v, tiersByVariant[v.id], p.options),
  );
  const cheapest = variants.reduce<ProductVariantView | undefined>(
    (min, v) => (!min || v.price < min.price ? v : min),
    undefined,
  );

  const category = p.categories?.[0]?.handle ?? p.collection?.handle;

  return {
    id: p.id,
    handle: p.handle ?? p.id,
    title: p.title ?? "",
    // `brand` is a jibbit-specific metadata field on the Medusa product.
    brand: String(p.metadata?.brand ?? ""),
    subtitle: p.subtitle ?? "",
    description: p.description ?? "",
    categoryHandle: toCategoryHandle(category),
    currency:
      p.variants?.[0]?.calculated_price?.currency_code?.toUpperCase() ?? "CHF",
    price: cheapest?.price ?? 0,
    compareAt: cheapest?.compareAt,
    variants,
    images: (p.images ?? []).map((i) => i.url).filter(Boolean),
    featured: p.tags?.some((t) => t.value === "featured") ?? false,
    material: nonEmpty(p.material),
    tierExtras: toTierExtras(p),
    updatedAt: toUpdatedAt(p),
  };
}

/**
 * Letzte Änderung für `<lastmod>` der Sitemap: der jüngste Zeitstempel aus
 * Produkt und Varianten (Medusa `updated_at`), als ISO-Zeichenkette.
 *
 * Unlesbare Werte fallen weg; fehlt alles, bleibt das Feld leer und die
 * Sitemap nennt für diese Adresse kein Datum — Google wertet `<lastmod>` nur,
 * wenn es stimmt, ein geratenes Datum entwertet die Angabe für alle.
 *
 * GRENZE: Preise und Bestand liegen in eigenen Modulen; ändern sie sich,
 * bewegt sich `updated_at` nicht. Das Datum sagt also «Inhalt mindestens so
 * neu», nie zu neu — die harmlose Richtung.
 */
function toUpdatedAt(
  p: Pick<StoreProduct, "updated_at" | "variants">,
): string | undefined {
  const stamps = [p.updated_at, ...(p.variants ?? []).map((v) => v.updated_at)]
    .map((raw) => (raw ? new Date(raw).getTime() : NaN))
    .filter((t) => Number.isFinite(t));
  return stamps.length
    ? new Date(Math.max(...stamps)).toISOString()
    : undefined;
}

/**
 * product.metadata.preistabelle.stufen -> { [abMenge]: { label, image } }.
 *
 * Geschrieben vom Admin-Widget «Preistabelle»; das Foto ist die id eines
 * Produktbilds und wird hier auf dessen URL aufgelöst. Metadata ist
 * unvalidiertes JSON — alles Unbekannte fällt still weg, ein Foto, das nicht
 * (mehr) am Produkt hängt, ebenso.
 */
function toTierExtras(
  p: Pick<StoreProduct, "metadata" | "images">,
): Record<number, { label?: string; image?: string }> {
  const raw = (p.metadata?.preistabelle as { stufen?: unknown } | undefined)
    ?.stufen;
  if (!Array.isArray(raw)) return {};
  const urlById = new Map(
    (p.images ?? [])
      .filter((i) => i?.id && i?.url)
      .map((i) => [i.id, i.url] as const),
  );
  const out: Record<number, { label?: string; image?: string }> = {};
  for (const e of raw as Record<string, unknown>[]) {
    const min = Number(e?.min_quantity);
    if (!Number.isInteger(min) || min < 1) continue;
    const label =
      typeof e.label === "string" && e.label.trim() ? e.label.trim() : undefined;
    const image =
      typeof e.image_id === "string" ? urlById.get(e.image_id) : undefined;
    if (label || image) out[min] = { label, image };
  }
  return out;
}

export function toCategoryView(c: StoreProductCategory): CategoryView {
  const handle = toCategoryHandle(c.handle);
  const fallback = MOCK_CATEGORIES.find((m) => m.handle === handle);
  return {
    id: c.id,
    handle,
    name: c.name ?? fallback?.name ?? handle,
    description: c.description ?? fallback?.description ?? "",
  };
}
