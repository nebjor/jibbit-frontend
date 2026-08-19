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
}

export async function getOrder(orderId: string): Promise<OrderView | null> {
  const ctx = await cartContext();
  if (!ctx) return null;

  try {
    const { order } = await ctx.sdk.store.order.retrieve(orderId);
    return {
      id: order.id,
      displayId: order.display_id ?? 0,
      email: order.email ?? "",
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
