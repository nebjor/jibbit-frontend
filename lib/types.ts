/**
 * Internal view types.
 *
 * Components NEVER read raw Medusa entities. Everything goes through these
 * shapes, produced by `lib/adapters.ts`. When the Medusa backend comes up,
 * only the adapter changes — no component does.
 */

export type CategoryHandle = "papers" | "filter" | "zubehoer";

export interface CategoryView {
  id: string;
  handle: CategoryHandle;
  /** Display name, de-CH */
  name: string;
  description: string;
}

export interface ProductVariantView {
  id: string;
  title: string;
  /** Decimal CHF. Medusa v2 stores decimals — never divide/multiply by 100. */
  price: number;
  /** Original / struck-through price ("was"). Undefined when not on sale. */
  compareAt?: number;
  inStock: boolean;
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
  price: number;
  compareAt?: number;
  quantity: number;
}
