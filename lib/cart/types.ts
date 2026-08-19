/**
 * Cart view types — what components read. Nothing here is a raw Medusa entity.
 *
 * PRICES: every amount is a DECIMAL, TAX-INCLUSIVE CHF amount taken verbatim
 * from Medusa. The store is configured `is_tax_inclusive: true` for chf (see
 * the backend seed), so `item_total` / `total` / `shipping_total` are the gross
 * numbers a Swiss customer expects to see. Never display `item_subtotal` — that
 * is the NET figure (CHF 33.60 gross shows up there as 31.08) and putting it in
 * front of a customer would understate the price.
 */

/** One line, as Medusa currently prices it. */
export interface CartLineView {
  /** Medusa line item id — the handle for update/delete. */
  id: string;
  variantId: string;
  productHandle: string;
  title: string;
  /** Empty string when the product has only one variant. */
  variantTitle: string;
  quantity: number;
  /**
   * Gross unit price AS MEDUSA CHARGES IT — already the quantity-break price
   * for this line's quantity. The storefront does not recompute it from
   * `lib/pricing.ts`; that module stays for the product page, where no cart
   * exists yet.
   */
  unitPrice: number;
  /** Gross line total, straight from Medusa's `items[].total`. */
  lineTotal: number;
  /** Struck-through original, when Medusa reports a higher one. */
  compareAtUnitPrice?: number;
  thumbnail?: string;
}

/**
 * The whole cart, derived from one Medusa response.
 *
 * `subtotal` / `shipping` / `total` are Medusa's own numbers. The drawer must
 * never add up line totals itself: summing rounded line values can drift a
 * rappen from `item_total`, and a cart that disagrees with the checkout by a
 * rappen is the same class of bug as one that disagrees by CHF 26.
 */
export interface CartState {
  /** Medusa cart id, or null when the customer has no cart yet. */
  id: string | null;
  lines: readonly CartLineView[];
  /** Total item count, for the header badge. */
  count: number;
  /** Gross goods total — Medusa's `item_total`. */
  subtotal: number;
  /** Gross shipping — Medusa's `shipping_total`. 0 until a method is chosen. */
  shipping: number;
  /** Gross grand total — Medusa's `total`. */
  total: number;
  /** True once a shipping method sits on the cart, i.e. `shipping` is binding. */
  hasShippingMethod: boolean;
  currency: string;
  email: string | null;
  /** True once a shipping address with a country is on the cart. */
  hasShippingAddress: boolean;
  /** Prefill for the checkout form; null before the address step. */
  address: CheckoutAddress | null;
}

/** Delivery address. Guest checkout — no customer account is assumed. */
export interface CheckoutAddress {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  postalCode: string;
  city: string;
  /** ISO-2, lowercase. Only "ch" is served today. */
  countryCode: string;
  phone?: string;
}

/** One selectable delivery method. */
export interface ShippingOptionView {
  id: string;
  name: string;
  /** Prose from the shipping option type; never a price. */
  description: string;
  /**
   * Gross price, or `null` when Medusa cannot state it up front.
   *
   * The seeded Swiss option is `price_type: "calculated"`, and the store route
   * (`listShippingOptionsForCartWorkflow`) documents that it does NOT compute
   * calculated prices — `amount` comes back undefined. The binding price only
   * materialises as `cart.shipping_total` once the method is on the cart, which
   * is why the checkout selects a method before showing a shipping figure.
   */
  amount: number | null;
}

/** Every cart mutation answers with this. Errors are values, not exceptions. */
export type CartActionResult =
  | { ok: true; cart: CartState }
  | { ok: false; message: string; cart: CartState };

export const EMPTY_CART: CartState = Object.freeze({
  id: null,
  lines: Object.freeze([]) as readonly CartLineView[],
  count: 0,
  subtotal: 0,
  shipping: 0,
  total: 0,
  hasShippingMethod: false,
  currency: "CHF",
  email: null,
  hasShippingAddress: false,
  address: null,
});
