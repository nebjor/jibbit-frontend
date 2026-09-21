"use server";

/**
 * Checkout steps, as Server Actions. Thin wrappers over `lib/checkout/*`.
 *
 * ⚠️ `placeOrderAction` can answer with `{ kind: "redirect" }` — the zahls.ch
 * plugin hands the customer to its hosted payment page; only the dev/CI
 * system provider settles inline. See lib/checkout/payment.ts.
 */

import type { CheckoutAddress } from "@/lib/cart/types";
import {
  completeCart,
  placeOrder,
  saveContactAndAddress,
  type PlaceOrderResult,
  type SaveAddressResult,
} from "@/lib/checkout/server";
import {
  completePendingOrder,
  type PendingOrderResult,
} from "@/lib/checkout/return";

export async function saveAddressAction(
  email: string,
  address: CheckoutAddress,
): Promise<SaveAddressResult> {
  return saveContactAndAddress(email, address);
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

/**
 * Rückkehr von der zahls.ch-Bezahlseite (pp_zahls_zahls): die Redirect-URLs
 * des Plugins sind statisch, der Browser bringt KEINE Zahlungsreferenz mit.
 * Statt eines Status-Abgleichs versucht der Server, den Cart abzuschliessen —
 * Medusa autorisiert dabei die Zahlung frisch beim PSP
 * (lib/checkout/return.ts, `completePendingOrder`). Unbezahlt ⇒ keine
 * Bestellung, Warenkorb bleibt.
 */
export async function completePendingOrderAction(): Promise<PendingOrderResult> {
  return completePendingOrder();
}
