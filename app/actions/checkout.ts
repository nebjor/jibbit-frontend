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
import {
  completePendingOrder,
  confirmPaymentReturn,
  type PaymentReturnResult,
  type PendingOrderResult,
} from "@/lib/checkout/return";

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

/**
 * Rückkehr von der zahls.ch/Payrexx-Bezahlseite: Zahlungsstand server-seitig
 * beim Backend abgleichen und — wenn bezahlt — die Bestellung holen.
 * Der Browser liefert nur die `payment_session_id` aus der Rückkehr-URL;
 * jede Statusaussage kommt vom Backend (lib/checkout/return.ts).
 */
export async function confirmPaymentReturnAction(
  paymentSessionId: string,
): Promise<PaymentReturnResult> {
  return confirmPaymentReturn(paymentSessionId);
}

/**
 * Rückkehr vom zahls.ch-Plugin (pp_zahls_zahls): dessen Redirect-URLs sind
 * statisch, der Browser bringt KEINE Zahlungsreferenz mit. Statt eines
 * Status-Abgleichs versucht der Server, den Cart abzuschliessen — Medusa
 * autorisiert dabei die Zahlung frisch beim PSP (lib/checkout/return.ts,
 * `completePendingOrder`). Unbezahlt ⇒ keine Bestellung, Warenkorb bleibt.
 */
export async function completePendingOrderAction(): Promise<PendingOrderResult> {
  return completePendingOrder();
}
