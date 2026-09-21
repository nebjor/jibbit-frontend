/**
 * Quantity-break pricing — pure functions, no React, no network.
 *
 * IMPORTANT: everything here is for DISPLAY. The price a customer actually
 * pays is calculated by Medusa when the line item is created and again on
 * every quantity change (`get-variants-and-items-with-prices`,
 * `update-line-item-in-cart`). The storefront must never send a price to the
 * backend — a `unit_price` in the request is treated as a custom price and
 * taken at face value.
 *
 * Tiers are expected ascending and gap-free, starting at 1. That is what the
 * backend importer guarantees; a variant whose tiers do not start at 1 has no
 * price for small quantities and would fail server-side anyway.
 */

import type { CartLine, PriceTier, ProductVariantView } from "./types";

/** The tier that applies at `quantity`, or undefined when there are none. */
export function activeTier(
  tiers: PriceTier[],
  quantity: number,
): PriceTier | undefined {
  if (!tiers.length) return undefined;
  const found = tiers.find(
    (t) =>
      quantity >= t.minQuantity &&
      (t.maxQuantity === null || quantity <= t.maxQuantity),
  );
  // Below the first tier (shouldn't happen, but a missing price is worse than
  // an optimistic one) fall back to the cheapest available step.
  return found ?? tiers[0];
}

/** Unit price at `quantity`; `fallback` when the variant has no tiers. */
export function unitPriceFor(
  tiers: PriceTier[],
  quantity: number,
  fallback: number,
): number {
  return activeTier(tiers, quantity)?.price ?? fallback;
}

/**
 * The next cheaper step above `quantity`, or undefined at the top tier.
 *
 * Steps that are not actually cheaper are skipped: after rounding to 5 Rappen
 * two neighbouring tiers can end up at the same price, and "buy 14 more for
 * exactly the same rate" is not a reason to buy more.
 */
export function nextTier(
  tiers: PriceTier[],
  quantity: number,
): PriceTier | undefined {
  const current = activeTier(tiers, quantity)?.price ?? Infinity;
  return tiers.find((t) => t.minQuantity > quantity && t.price < current);
}

export interface UpgradeHint {
  /** How many more units are needed to reach the next step. */
  missing: number;
  /** Unit price once that step is reached. */
  nextPrice: number;
  /** Quantity at which it kicks in. */
  atQuantity: number;
  /**
   * What the customer saves by buying up to `atQuantity` instead of stopping
   * at `quantity` — compared on the LARGER basket, which is the honest
   * comparison: more units for barely more money.
   */
  saves: number;
}

/**
 * "Noch 14 Stk. bis CHF 1.40 — spare CHF 5.60".
 *
 * The saving is `atQuantity` units at the current price minus `atQuantity`
 * units at the next price. It answers "what does the same larger basket cost
 * me if I take the step?", not "what do I save on the units I already have" —
 * the latter reads as a bigger number but is not what the customer pays.
 */
export function upgradeHint(
  tiers: PriceTier[],
  quantity: number,
): UpgradeHint | undefined {
  const next = nextTier(tiers, quantity);
  if (!next) return undefined;

  const current = activeTier(tiers, quantity);
  if (!current) return undefined;

  const atQuantity = next.minQuantity;
  const saves = atQuantity * current.price - atQuantity * next.price;

  return {
    missing: atQuantity - quantity,
    nextPrice: next.price,
    atQuantity,
    saves: round2(saves),
  };
}

/** Line total at the tier price that applies to that quantity. */
export function lineTotal(line: CartLine): number {
  const unit = unitPriceFor(line.tiers ?? [], line.quantity, line.price);
  return round2(unit * line.quantity);
}

/** Unit price of a single line, tier-aware. */
export function lineUnitPrice(line: CartLine): number {
  return unitPriceFor(line.tiers ?? [], line.quantity, line.price);
}

/**
 * Which variant should be selected when the page opens?
 *
 * The cheapest, packaging-wise: the single unit. Preselecting a display would
 * mean a customer who does not notice the selector adds CHF 33.60 instead of
 * CHF 1.95 — a seventeenfold surprise. The upsell belongs in the price table,
 * not in a default the customer did not choose.
 */
export function defaultVariant(
  variants: ProductVariantView[],
): ProductVariantView | undefined {
  const inStock = variants.filter((v) => v.inStock);
  const pool = inStock.length ? inStock : variants;
  return pool.find((v) => v.packType === "single") ?? pool[0];
}

/**
 * Name des Query-Parameters, der eine Variante vorauswählt:
 * `/products/<handle>?variant=<variantId>`.
 *
 * Google verlangt für Produktvarianten, dass sich JEDE Variante über eine
 * eigene URL direkt vorauswählen lässt («using URL query parameters») — mit
 * passendem Bild, Preis, Verfügbarkeit und Warenkorb-Knopf. Genau diese URL
 * steht im JSON-LD an `Offer.url` (lib/seo/jsonld.ts); die Seite liest den
 * Parameter serverseitig (app/products/[handle]/page.tsx). Die Varianten-ID
 * und kein sprechender Slug, weil Titel im Admin umbenannt werden, IDs nicht.
 */
export const VARIANT_PARAM = "variant";

/**
 * Welche Variante ist beim Öffnen gewählt — mit Rücksicht auf `?variant=`?
 *
 * Eine bekannte ID gewinnt, auch wenn die Variante ausverkauft ist: wer über
 * den Link zum Display kommt, soll das Display sehen (samt «Ausverkauft»),
 * nicht stillschweigend das Einzelstück. Unbekannt, leer oder mehrfach
 * gesetzt -> die übliche Vorauswahl.
 */
export function preselectedVariant(
  variants: ProductVariantView[],
  requested: string | string[] | undefined,
): ProductVariantView | undefined {
  const id = Array.isArray(requested) ? requested[0] : requested;
  return (id && variants.find((v) => v.id === id)) || defaultVariant(variants);
}

/**
 * Is this pack genuinely cheaper per unit than buying the same number of
 * singles? Returns the saving in percent, or null when it is a wash.
 *
 * For most of the catalogue a display costs exactly `unitsPerPack` × the
 * single's tier price at that quantity — there the badge would be a lie. It
 * only appears where the pack really is the better deal.
 */
export function packAdvantagePercent(
  pack: ProductVariantView,
  single: ProductVariantView | undefined,
  { threshold = 5 }: { threshold?: number } = {},
): number | null {
  if (!single || pack.packType === "single" || pack.unitsPerPack < 2) {
    return null;
  }

  const packUnitPrice = unitPriceFor(pack.tiers, 1, pack.price) / pack.unitsPerPack;
  const singleAtSameCount = unitPriceFor(
    single.tiers,
    pack.unitsPerPack,
    single.price,
  );
  if (!singleAtSameCount) return null;

  const percent = Math.floor(
    ((singleAtSameCount - packUnitPrice) / singleAtSameCount) * 100,
  );
  return percent >= threshold ? percent : null;
}

/** Price per contained unit — "CHF 1.40 / Stk." under a display's price. */
export function pricePerUnit(
  variant: ProductVariantView,
  quantity: number,
): number | null {
  if (variant.unitsPerPack < 2) return null;
  return unitPriceFor(variant.tiers, quantity, variant.price) / variant.unitsPerPack;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Anzeige-Extras einer Preisstufe aus dem Admin (Bezeichnung, Foto). */
export interface TierExtra {
  label?: string;
  image?: string;
}

export interface TierChip {
  /** «ab»-Menge der Stufe — Tippen setzt genau diese Menge. */
  minQuantity: number;
  /** Stückpreis der Stufe. */
  price: number;
  /** «24er Display» aus dem Admin, sonst «24 Stück». */
  label: string;
  /** Ersparnis gegenüber dem Einzelpreis in ganzen Prozent, 0 bei Stufe 1. */
  savePercent: number;
  /** Regulärer Stückpreis (durchgestrichen), wenn höher als `price`. */
  compareAt?: number;
  image?: string;
}

/**
 * Die Schnellwahl-Chips der Produktseite: eine je Preisstufe. Die erste Stufe
 * (ab 1) ist immer dabei — sie ist die Vorauswahl «1 Stück».
 */
export function tierChips(
  tiers: PriceTier[],
  extras: Record<number, TierExtra> = {},
): TierChip[] {
  if (!tiers.length) return [];
  const base = tiers[0].price;
  return tiers.map((t) => ({
    minQuantity: t.minQuantity,
    price: t.price,
    label:
      extras[t.minQuantity]?.label ??
      (t.minQuantity === 1 ? "1 Stück" : `${t.minQuantity} Stück`),
    savePercent:
      base > 0 ? Math.max(0, Math.floor(((base - t.price) / base) * 100)) : 0,
    compareAt: t.compareAt,
    image: extras[t.minQuantity]?.image,
  }));
}

/**
 * Was spart der Kunde bei `quantity` gegenüber dem Einzelpreis?
 * `amount` in CHF (auf Rappen gerundet), `percent` ganzzahlig abgerundet.
 */
export function savingAt(
  tiers: PriceTier[],
  quantity: number,
): { amount: number; percent: number } {
  if (!tiers.length) return { amount: 0, percent: 0 };
  const base = tiers[0].price;
  const unit = unitPriceFor(tiers, quantity, base);
  const amount = round2((base - unit) * quantity);
  const percent = base > 0 ? Math.floor(((base - unit) / base) * 100) : 0;
  return { amount: Math.max(0, amount), percent: Math.max(0, percent) };
}

/**
 * Galerie-Reihenfolge: das Foto der gewählten Stufe nach vorn, alle übrigen
 * in ihrer normalen Reihenfolge dahinter — nichts wird ausgeblendet. Ohne
 * (gültiges) Stufenfoto bleibt die Reihenfolge unverändert.
 */
export function orderImagesForTier(
  images: string[],
  tierImage: string | undefined,
): string[] {
  if (!tierImage || !images.includes(tierImage)) return images;
  return [tierImage, ...images.filter((src) => src !== tierImage)];
}
