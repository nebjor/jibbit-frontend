/**
 * ⚠️ SEAM FOR THE PAYMENT STRAND. ⚠️
 *
 * Payrexx (TWINT, Powerpay, cards) is being built in a separate strand. This
 * file is the ONLY place the checkout talks to a payment provider, and it is
 * shaped so that strand fills in a branch instead of restructuring the
 * checkout — the same contract `components/CartProvider.tsx` used to carry for
 * the backend itself.
 *
 * ══ THE CONTRACT ══════════════════════════════════════════════════════════
 * `preparePayment(cart)` returns a `PaymentHandoff`, and the return type
 * ALREADY admits both worlds:
 *
 *   { kind: "inline" }              the order can be completed right here
 *   { kind: "redirect", url }       the browser must go to the PSP first
 *
 * `app/actions/checkout.ts` branches on `kind`. A redirect flow therefore needs
 * no change outside this file: return `{ kind: "redirect", url }` and the
 * checkout will send the customer there instead of completing.
 *
 * ══ WHAT THE PAYMENT STRAND HAS TO DO ═════════════════════════════════════
 *  1. Put `pp_payrexx_payrexx` first in `PROVIDER_PREFERENCE` (or drop
 *     `pp_system_default`, which must never reach production — it authorises
 *     without taking money).
 *  2. Pass whatever Payrexx needs through `data` in `initiatePaymentSession`
 *     (success/failure/cancel URLs, the enabled PSP ids).
 *  3. Read the gateway link out of the created session and return it as
 *     `{ kind: "redirect", url }`.
 *  4. Add a return route that the PSP sends the customer back to, which calls
 *     `completeCheckout()` from `app/actions/checkout.ts`. Completion is
 *     deliberately NOT done here: the webhook/redirect handling is the payment
 *     strand's, the order creation is the checkout's, and mixing them is how
 *     double-charges happen.
 *
 * ══ WHAT MUST NOT MOVE ════════════════════════════════════════════════════
 * The storefront never sends an amount. Medusa derives it from the cart; a
 * client-supplied amount would be taken at face value.
 */

import "server-only";

import type { HttpTypes } from "@medusajs/types";
import type Medusa from "@medusajs/js-sdk";

export type PaymentHandoff =
  | {
      /** Payment is settled (or deferred) — complete the cart now. */
      kind: "inline";
      providerId: string;
    }
  | {
      /** Send the browser to `url`; the PSP returns the customer afterwards. */
      kind: "redirect";
      providerId: string;
      url: string;
    };

export class PaymentSetupError extends Error {}

/**
 * First match wins.
 *
 * `pp_system_default` is a Medusa built-in that marks a payment as authorised
 * WITHOUT MOVING MONEY. It is here so the checkout is complete and testable
 * before Payrexx lands, and it is exactly what the payment strand removes.
 * The backend seed registers both providers on the Swiss region.
 */
const PROVIDER_PREFERENCE = ["pp_system_default", "pp_payrexx_payrexx"];

export function choosePaymentProvider(
  available: readonly { id: string }[],
): string | undefined {
  for (const preferred of PROVIDER_PREFERENCE) {
    if (available.some((p) => p.id === preferred)) return preferred;
  }
  return available[0]?.id;
}

/**
 * Create the payment session Medusa needs before a cart can be completed.
 *
 * `initiatePaymentSession` creates the cart's payment collection on the fly
 * when there is none, so no separate collection call is needed here.
 */
export async function preparePayment(
  sdk: Medusa,
  cart: HttpTypes.StoreCart,
): Promise<PaymentHandoff> {
  const { payment_providers: providers } =
    await sdk.store.payment.listPaymentProviders({
      region_id: cart.region_id!,
      limit: 20,
    });

  const providerId = choosePaymentProvider(providers ?? []);
  if (!providerId) {
    throw new PaymentSetupError(
      "Für diese Region ist keine Zahlungsart hinterlegt.",
    );
  }

  await sdk.store.payment.initiatePaymentSession(cart, {
    provider_id: providerId,
  });

  // ⚠️ PAYMENT STRAND: this is the branch point. For a redirect provider,
  // read the gateway URL out of the session returned above and return
  // `{ kind: "redirect", providerId, url }` instead.
  return { kind: "inline", providerId };
}
