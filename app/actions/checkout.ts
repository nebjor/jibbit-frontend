"use server";

/**
 * Checkout steps, as Server Actions. Thin wrappers over `lib/checkout/*`.
 *
 * ⚠️ `placeOrderAction` can answer with `{ kind: "redirect" }`. That branch is
 * dead today (the system payment provider settles inline) and exists so the
 * Payrexx strand does not have to touch the checkout UI — see
 * lib/checkout/payment.ts.
 */

import type { CheckoutAddress, ShippingOptionView } from "@/lib/cart/types";
import type { CartActionResult } from "@/lib/cart/types";
import {
  completeCart,
  listShippingOptions,
  placeOrder,
  saveContactAndAddress,
  selectShippingOption,
  type PlaceOrderResult,
  type SaveAddressResult,
} from "@/lib/checkout/server";

export async function saveAddressAction(
  email: string,
  address: CheckoutAddress,
): Promise<SaveAddressResult> {
  return saveContactAndAddress(email, address);
}

export async function listShippingOptionsAction(): Promise<ShippingOptionView[]> {
  return listShippingOptions();
}

export async function selectShippingOptionAction(
  optionId: string,
): Promise<CartActionResult> {
  return selectShippingOption(optionId);
}

export async function placeOrderAction(): Promise<PlaceOrderResult> {
  return placeOrder();
}

/**
 * ⚠️ FOR THE PAYMENT STRAND: the return route a PSP sends the customer back to
 * calls this and nothing else. Kept separate from `placeOrderAction` so the
 * payment session is not initialised a second time on the way back.
 */
export async function completeCartAction(): Promise<PlaceOrderResult> {
  return completeCart();
}
