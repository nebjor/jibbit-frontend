/**
 * Internal view types.
 *
 * Components NEVER read raw Medusa entities. Everything goes through these
 * shapes, produced by `lib/adapters.ts`. When the Medusa backend comes up,
 * only the adapter changes — no component does.
 */

/**
 * Kategorie-Handle, wie es vom Backend kommt (normalisiert in
 * `lib/adapters.ts`). Bewusst ein offener String und keine Union: Kategorien
 * pflegt der Betreiber im Admin, und jede neue Kategorie muss ohne
 * Code-Änderung sauber durch Navigation, Filter und Sitemap laufen. Die
 * frühere harte Union liess alle unbekannten Handles auf "zubehoer"
 * kollabieren — drei Kategorien, ein Link, drei „aktive" Reiter.
 */
export type CategoryHandle = string;

export interface CategoryView {
  id: string;
  handle: CategoryHandle;
  /** Display name, de-CH */
  name: string;
  description: string;
}

/**
 * One quantity break. `maxQuantity: null` marks the top tier, open-ended.
 *
 * Mirrors a `price` row in Medusa's pricing module (`min_quantity` /
 * `max_quantity`). Display only: the binding price is always recalculated
 * server-side when a line item is created or its quantity changes.
 */
export interface PriceTier {
  minQuantity: number;
  maxQuantity: number | null;
  /** Decimal CHF for ONE unit of this variant at this quantity. */
  price: number;
}

/** How a variant is packaged. Drives the unit-price line and the deal badge. */
export type PackType = "single" | "display" | "box";

export interface ProductVariantView {
  id: string;
  title: string;
  /** Decimal CHF. Medusa v2 stores decimals — never divide/multiply by 100. */
  price: number;
  /** Original / struck-through price ("was"). Undefined when not on sale. */
  compareAt?: number;
  inStock: boolean;
  /**
   * Quantity breaks, ascending and gap-free. Empty when the variant has one
   * flat price — the price table then renders nothing at all.
   */
  tiers: PriceTier[];
  /** Units inside one of these: 1 for a single item, 24 for a display. */
  unitsPerPack: number;
  packType: PackType;
}

export interface ProductView {
  id: string;
  handle: string;
  title: string;
  brand: string;
  subtitle: string;
  description: string;
  categoryHandle: CategoryHandle;
  currency: string;
  /** Cheapest variant price — what the card shows. */
  price: number;
  compareAt?: number;
  variants: ProductVariantView[];
  images: string[];
  /** Editorially featured on the landing page. */
  featured: boolean;
}

/** A line in the local (pre-backend) cart. */
export interface CartLine {
  variantId: string;
  productHandle: string;
  title: string;
  variantTitle: string;
  /**
   * Unit price at quantity 1. Kept for lines without tiers; with `tiers` set
   * the displayed unit price is derived from the quantity instead, so the
   * drawer cannot drift from what Medusa charges at checkout.
   */
  price: number;
  compareAt?: number;
  quantity: number;
  /** Copied from the variant so the cart can reprice itself on quantity change. */
  tiers?: PriceTier[];
  unitsPerPack?: number;
}
