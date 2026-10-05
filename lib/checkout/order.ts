/**
 * Placed orders, for the confirmation page — server-only.
 *
 * GUEST ORDERS: `GET /store/orders/:id` answers without any authentication,
 * verified against a live backend. That is what makes a guest confirmation page
 * possible at all. It also means the id is the only secret protecting it, so
 * never link to an order id from anywhere public and never put it in a sitemap.
 */

import "server-only";

import {
  toCartLineView,
  toCheckoutAddress,
  type MedusaAddressLike,
  type MedusaLineItemLike,
} from "@/lib/cart/adapter";
import { cartContext, logCartError } from "@/lib/cart/server";
import type { CartLineView, CheckoutAddress } from "@/lib/cart/types";

export interface OrderView {
  id: string;
  /** The human-facing number ("Bestellung 2"), not the ULID. */
  displayId: number;
  email: string;
  currency: string;
  lines: CartLineView[];
  /** Gross goods total. Same tax-inclusive convention as the cart. */
  subtotal: number;
  shipping: number;
  total: number;
  address: CheckoutAddress | null;
  /**
   * Bestellzeitpunkt, ISO-8601 — Grundlage für das voraussichtliche
   * Lieferdatum, das die Bestätigungsseite an Google Kundenrezensionen
   * meldet (lib/google-kundenrezensionen/payload.ts). Leer, wenn Medusa
   * keines liefert; die Komponente rendert dann nichts.
   */
  createdAt: string;
}

/**
 * Die Variante jeder Position: dort liegt die GTIN (`ean`/`upc`/`barcode`,
 * Begründung in lib/cart/adapter.ts). Medusa 2.18 liefert `*items.variant`
 * für diese Route bereits von Haus aus (defaultStoreRetrieveOrderFields);
 * ausdrücklich angefragt, damit das so bleibt, falls die Voreinstellung
 * einmal schrumpft. Nur `*`-Präfix, also ERGÄNZEND — ein Eintrag ohne
 * Präfix würde die Standardfelder ersetzen und die Seite verlöre Summen
 * und Adresse.
 */
const ORDER_FIELDS = "*items.variant";

function isoDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export async function getOrder(orderId: string): Promise<OrderView | null> {
  const ctx = await cartContext();
  if (!ctx) return null;

  try {
    const { order } = await ctx.sdk.store.order.retrieve(orderId, {
      fields: ORDER_FIELDS,
    });
    return {
      id: order.id,
      displayId: order.display_id ?? 0,
      email: order.email ?? "",
      createdAt: isoDate(order.created_at),
      currency: (order.currency_code ?? "chf").toUpperCase(),
      lines: (order.items ?? []).map((item) =>
        toCartLineView(item as unknown as MedusaLineItemLike),
      ),
      subtotal: order.item_total ?? 0,
      shipping: order.shipping_total ?? 0,
      total: order.total ?? 0,
      address: toCheckoutAddress(
        order.shipping_address as unknown as MedusaAddressLike | null,
      ),
    };
  } catch (error) {
    logCartError("order:retrieve", error);
    return null;
  }
}
