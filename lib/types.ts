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
  /** Regular (struck-through) unit price when higher than `price`. */
  compareAt?: number;
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
  /**
   * Eigenes Bild dieser Variante (Medusa `variant.thumbnail` — «from the
   * product images»). Nicht gepflegt -> undefined; die Produktseite zeigt
   * dann das erste Produktbild.
   */
  image?: string;
  /**
   * GTIN dieser Packung (8/12/13/14 Ziffern), bereits geprüft — siehe
   * lib/gtin.ts. Je Variante, weil Einzelstück und Display zwei Artikel mit
   * zwei Nummern sind. Nicht gepflegt oder ungültig -> undefined.
   */
  gtin?: string;
  /**
   * Artikelnummer aus Medusa (`variant.sku`, vom Katalog-Import deterministisch
   * vergeben). Stabil über Umbenennungen hinweg — deshalb die `id` im
   * Merchant-Center-Feed (lib/seo/merchant-feed.ts). Nicht gepflegt -> undefined.
   */
  sku?: string;
  /**
   * Farbe aus einer Produktoption «Farbe»/«Color», falls das Produkt eine
   * führt. Nur für den Merchant-Center-Feed; die Produktseite zeigt Optionen
   * über den Variantentitel.
   */
  color?: string;
  /** Material der Variante (Medusa `variant.material`), sonst undefined. */
  material?: string;
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
  /** Material des Produkts (Medusa `product.material`), wenn gepflegt. */
  material?: string;
  /**
   * Bezeichnung und Foto je Preisstufe aus dem Admin-Widget «Preistabelle»
   * (product.metadata.preistabelle), Schlüssel = «ab»-Menge. Leer, wenn nichts
   * gepflegt ist — dann heissen die Chips «24 Stück» und die Galerie bleibt
   * in ihrer normalen Reihenfolge.
   */
  tierExtras?: Record<number, { label?: string; image?: string }>;
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
  /**
   * Schrittweite der +/−-Knöpfe im Warenkorb: die Preisstufe, die der Kunde
   * gewählt hat (24er Display -> 24). Fehlt sie, 1.
   */
  step?: number;
  unitsPerPack?: number;
}
