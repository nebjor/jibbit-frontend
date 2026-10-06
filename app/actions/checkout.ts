"use server";

/**
 * Checkout steps, as Server Actions. Thin wrappers over `lib/checkout/*`.
 *
 * ⚠️ `placeOrderAction` can answer with `{ kind: "redirect" }` — the zahls.ch
 * plugin hands the customer to its hosted payment page; only the dev/CI
 * system provider settles inline. See lib/checkout/payment.ts.
 */

import type { CartActionResult, CheckoutAddress } from "@/lib/cart/types";
import {
  completeCart,
  ensureShippingMethod,
  placeOrder,
  saveContactAndAddress,
  type PlaceOrderResult,
  type SaveAddressResult,
} from "@/lib/checkout/server";
import {
  completePendingOrder,
  type PendingOrderResult,
} from "@/lib/checkout/return";
import type { DeliveryChoice } from "@/lib/checkout/pickup";

/** `delivery`: Lieferung oder Abholung im Laden (lib/checkout/pickup.ts). */
export async function saveAddressAction(
  email: string,
  address: CheckoutAddress,
  delivery: DeliveryChoice = "shipping",
): Promise<SaveAddressResult> {
  // Nur die zwei bekannten Werte durchlassen — das ist eine Server Action,
  // der Aufruf kommt aus dem Browser.
  return saveContactAndAddress(email, address, delivery === "pickup" ? "pickup" : "shipping");
}

export async function ensureShippingAction(): Promise<CartActionResult> {
  return ensureShippingMethod();
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
