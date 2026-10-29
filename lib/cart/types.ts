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
  /** Medusa-Produkt-ID — Schlüssel für die Bestandsabfrage (lib/cart/availability.ts). */
  productId?: string;
  /**
   * Bestellbare Höchstmenge der Variante; null = unbegrenzt, undefined =
   * unbekannt (wird wie unbegrenzt behandelt). Siehe lib/stock.ts.
   */
  availableQuantity?: number | null;
  /**
   * Geprüfte GTIN der Variante (lib/gtin.ts) — nur gesetzt, wenn die
   * Variante mitgeladen wurde (Bestellungen, lib/checkout/order.ts) und der
   * Wert die Prüfziffer besteht. Einziger Abnehmer: Google Kundenrezensionen
   * auf der Bestätigungsseite (Produktbewertungen je GTIN).
   */
  gtin?: string;
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
  /** In `total` enthaltene Steuer — Medusas `tax_total`; 0, wenn keine anfällt. */
  taxTotal?: number;
  /**
   * Aktionsrabatt (brutto) — Medusas `discount_total`, 0 ohne Rabatt. Bereits
   * in `subtotal`/`total` abgezogen; nur zur Anzeige («davon Aktionsrabatt»).
   */
  discount?: number;
  /** True once a shipping method sits on the cart, i.e. `shipping` is binding. */
  hasShippingMethod: boolean;
  /**
   * Abholung im Laden statt Versand. Mit Methode auf dem Cart: deren Marker
   * (`data.pickup`); davor: die in `metadata.pickup` gespeicherte Wahl. Die
   * Gratisversand-Anzeige und die Versandschätzung richten sich danach —
   * siehe lib/checkout/pickup.ts.
   */
  pickup: boolean;
  currency: string;
  email: string | null;
  /** True once a shipping address with a country is on the cart. */
  hasShippingAddress: boolean;
  /** Prefill for the checkout form; null before the address step. */
  address: CheckoutAddress | null;
}

/**
 * Delivery address. Deliberately account-agnostic: whether the checkout
 * REQUIRES a login is decided in `lib/checkout/account-requirement.ts`, and
 * nothing in this shape depends on a customer record either way.
 */
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

/** Every cart mutation answers with this. Errors are values, not exceptions. */
export type CartActionResult =
  | { ok: true; cart: CartState; notice?: string }
  | { ok: false; message: string; cart: CartState };

export const EMPTY_CART: CartState = Object.freeze({
  id: null,
  lines: Object.freeze([]) as readonly CartLineView[],
  count: 0,
  subtotal: 0,
  shipping: 0,
  total: 0,
  hasShippingMethod: false,
  pickup: false,
  currency: "CHF",
  email: null,
  hasShippingAddress: false,
  address: null,
});
