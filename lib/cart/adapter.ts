/**
 * ADAPTER BOUNDARY — Medusa cart -> CartState. Pure; safe to unit-test.
 *
 * The one rule this file enforces: MONEY COMES FROM MEDUSA. Nothing here
 * multiplies, sums or re-derives a price. `lib/pricing.ts` computes quantity
 * breaks for the product page, where no cart exists yet; the moment a cart
 * exists, Medusa is the only source of truth and the drawer shows its numbers.
 * The bug this prevents — a drawer that promises CHF 33.60 for a basket the
 * checkout charges CHF 60.00 for — has happened in this project before.
 *
 * The input type is declared structurally rather than as `HttpTypes.StoreCart`
 * so tests can build a fixture without conjuring a full Medusa entity.
 * `lib/cart/server.ts` passes a real `StoreCart` in, so TypeScript still checks
 * that the two shapes agree.
 */

import type { CartLineView, CartState, CheckoutAddress } from "./types";
import { EMPTY_CART } from "./types";
import { normalizeGtin } from "@/lib/gtin";
import { isPickup } from "@/lib/checkout/pickup";

/** The subset of a Medusa store cart this adapter reads. */
export interface MedusaCartLike {
  id: string;
  currency_code?: string | null;
  email?: string | null;
  item_total?: number | null;
  shipping_total?: number | null;
  total?: number | null;
  tax_total?: number | null;
  /** Rabatt aus Promotionen, brutto (inkl. Steuer-Anteil). Nur mit `+discount_total` in den Feldern. */
  discount_total?: number | null;
  items?: MedusaLineItemLike[] | null;
  /** `data` nur mit `+shipping_methods.data` in den Feldern (lib/cart/server.ts). */
  shipping_methods?: { id: string; data?: Record<string, unknown> | null }[] | null;
  shipping_address?: MedusaAddressLike | null;
  /** `pickup: true`, wenn die Kasse die Abholung gewählt hat. */
  metadata?: Record<string, unknown> | null;
}

export interface MedusaLineItemLike {
  id: string;
  variant_id?: string | null;
  product_id?: string | null;
  product_handle?: string | null;
  product_title?: string | null;
  title?: string | null;
  variant_title?: string | null;
  thumbnail?: string | null;
  quantity: number;
  unit_price: number;
  compare_at_unit_price?: number | null;
  /**
   * Gross line total. Only present when the request asked for `+items.total` —
   * see `CART_FIELDS` in lib/cart/server.ts. The fallback below keeps a line
   * renderable if it is ever missing; the cart-level `item_total` is used for
   * the subtotal regardless, so a missing line total can never move the sum
   * the customer is asked to pay.
   */
  total?: number | null;
  original_total?: number | null;
  /**
   * Medusas Momentaufnahme von `variant.barcode` auf der Position — bei
   * Bestellungen immer da, bei Warenkörben nicht. Der Katalog-Import legt
   * die GTIN aber in `ean` ab (lib/adapters.ts, `toGtin`), darum braucht es
   * zusätzlich die Variante selbst — die holt lib/checkout/order.ts mit
   * `*items.variant`.
   */
  variant_barcode?: string | null;
  variant?: {
    ean?: string | null;
    upc?: string | null;
    barcode?: string | null;
  } | null;
}

export interface MedusaAddressLike {
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country_code?: string | null;
  phone?: string | null;
}

function num(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * GTIN einer Position: der erste Kandidat, der die Prüfziffer besteht
 * (lib/gtin.ts) — gleiche Reihenfolge und gleiche Begründung wie `toGtin`
 * in lib/adapters.ts; `variant_barcode` ist Medusas Momentaufnahme für den
 * Fall, dass die Variante nicht mitgeladen wurde. Nichts Gültiges -> undefined.
 */
function lineGtin(item: MedusaLineItemLike): string | undefined {
  const candidates = [
    item.variant?.ean,
    item.variant?.upc,
    item.variant?.barcode,
    item.variant_barcode,
  ];
  for (const raw of candidates) {
    const gtin = normalizeGtin(raw);
    if (gtin) return gtin;
  }
  return undefined;
}

export function toCartLineView(item: MedusaLineItemLike): CartLineView {
  const unitPrice = num(item.unit_price);
  return {
    id: item.id,
    variantId: item.variant_id ?? "",
    productId: item.product_id ?? undefined,
    productHandle: item.product_handle ?? "",
    title: item.product_title ?? item.title ?? "",
    // «Default variant» ist Medusas Platzhalter bei Produkten mit nur einer
    // Variante (Admin: «Erstellen» ohne Varianten) — im Warenkorb Rauschen.
    variantTitle:
      item.variant_title && item.variant_title !== "Default variant"
        ? item.variant_title
        : "",
    quantity: item.quantity,
    unitPrice,
    lineTotal:
      typeof item.total === "number" && Number.isFinite(item.total)
        ? item.total
        : unitPrice * item.quantity,
    compareAtUnitPrice:
      typeof item.compare_at_unit_price === "number" &&
      item.compare_at_unit_price > unitPrice
        ? item.compare_at_unit_price
        : undefined,
    thumbnail: item.thumbnail ?? undefined,
    gtin: lineGtin(item),
  };
}

export function toCheckoutAddress(
  address: MedusaAddressLike | null | undefined,
): CheckoutAddress | null {
  if (!address?.country_code) return null;
  return {
    firstName: address.first_name ?? "",
    lastName: address.last_name ?? "",
    company: address.company ?? undefined,
    address1: address.address_1 ?? "",
    address2: address.address_2 ?? undefined,
    postalCode: address.postal_code ?? "",
    city: address.city ?? "",
    countryCode: address.country_code.toLowerCase(),
    phone: address.phone ?? undefined,
  };
}

export function toCartState(cart: MedusaCartLike | null | undefined): CartState {
  if (!cart) return EMPTY_CART;

  const lines = (cart.items ?? []).map(toCartLineView);

  return {
    id: cart.id,
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    // `item_total` and NOT `item_subtotal`: prices are maintained tax-inclusive
    // for CHF, so `item_total` is the gross figure (CHF 33.60) while
    // `item_subtotal` is the net one (CHF 31.08). Showing the latter would
    // quote a price 8.1% below what the customer is charged.
    subtotal: num(cart.item_total),
    shipping: num(cart.shipping_total),
    total: num(cart.total),
    taxTotal: num(cart.tax_total),
    discount: num(cart.discount_total),
    hasShippingMethod: (cart.shipping_methods ?? []).length > 0,
    pickup: isPickup(cart),
    currency: (cart.currency_code ?? "chf").toUpperCase(),
    email: cart.email ?? null,
    hasShippingAddress: Boolean(cart.shipping_address?.country_code),
    address: toCheckoutAddress(cart.shipping_address),
  };
}
