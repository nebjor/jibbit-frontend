"use server";

/**
 * The four cart mutations, as Server Actions.
 *
 * This is the seam `components/CartProvider.tsx` always advertised: the same
 * four operations, now backed by a real Medusa cart. They are thin on purpose —
 * all the logic lives in `lib/cart/*`, which is unit-testable without Next.
 *
 * Every action answers with the FULL new cart, so the client never has to
 * reconstruct state from a partial response and can never disagree with the
 * server about what a basket costs.
 */

import {
  addLineToCart,
  clearCart,
  readCartState,
  removeCartLine,
  setLineQuantity,
} from "@/lib/cart/server";
import type { CartActionResult, CartState } from "@/lib/cart/types";

export async function addLineAction(
  variantId: string,
  quantity: number,
): Promise<CartActionResult> {
  return addLineToCart(variantId, quantity);
}

export async function setQuantityAction(
  variantId: string,
  quantity: number,
): Promise<CartActionResult> {
  return setLineQuantity(variantId, quantity);
}

export async function removeLineAction(
  variantId: string,
): Promise<CartActionResult> {
  return removeCartLine(variantId);
}

export async function clearCartAction(): Promise<CartActionResult> {
  return clearCart();
}

/** Re-read the cart, e.g. after returning from a payment provider. */
export async function refreshCartAction(): Promise<CartState> {
  return readCartState();
}
