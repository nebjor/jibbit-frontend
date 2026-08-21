/**
 * PAYMENT SEAM — the ONLY place the checkout talks to a payment provider.
 *
 * ══ THE CONTRACT ══════════════════════════════════════════════════════════
 * `preparePayment(cart)` returns a `PaymentHandoff`:
 *
 *   { kind: "inline" }              the order can be completed right here
 *   { kind: "redirect", url }       the browser must go to the PSP first
 *
 * `app/actions/checkout.ts` branches on `kind`; the UI handles both.
 *
 * ══ THE REDIRECT PROVIDER: zahls.ch via the Payrexx module ════════════════
 * The backend registers `pp_payrexx_payrexx` (backend/src/modules/payrexx).
 * The shop's account is at zahls.ch — a white-label of the Payrexx platform,
 * same REST API under `api.zahls.ch`; the backend only needs
 * `PAYREXX_API_BASE_URL` to switch hosts. `initiatePaymentSession` makes the
 * backend create a gateway there and put the hosted-payment-page URL into the
 * session's `data.link`; we send the browser to it. After paying, the
 * customer lands on `/checkout/success?payment_session_id=…`, which confirms
 * the payment server-side (lib/checkout/return.ts) — never trusting the
 * browser's word for it.
 *
 * ══ WHY `pp_system_default` IS STILL AROUND ═══════════════════════════════
 * Medusa's built-in provider marks a payment as authorised WITHOUT MOVING
 * MONEY. It is the fallback for environments where the PSP is not configured
 * (local dev, CI) — the region seed registers both. It MUST be removed from
 * the region before go-live (docs/payrexx-go-live.md §7 in the backend repo);
 * until then a session-init failure falls back to it loudly rather than
 * killing the checkout.
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

/** The Payrexx/zahls.ch provider as registered by the backend. */
export const PAYREXX_PROVIDER_ID = "pp_payrexx_payrexx";

/**
 * First match wins.
 *
 * The real PSP comes first. `pp_system_default` stays as the LAST resort for
 * environments without PSP credentials — see the header comment; it must be
 * gone from the region before go-live.
 */
const PROVIDER_PREFERENCE = [PAYREXX_PROVIDER_ID, "pp_system_default"];

export function choosePaymentProvider(
  available: readonly { id: string }[],
): string | undefined {
  for (const preferred of PROVIDER_PREFERENCE) {
    if (available.some((p) => p.id === preferred)) return preferred;
  }
  return available[0]?.id;
}

/**
 * Turns an initiated payment session into a handoff. Pure, so it is testable.
 *
 * For the redirect provider the gateway URL sits in `session.data.link`
 * (put there by the backend's `initiatePayment()`). A redirect provider
 * WITHOUT a link is a hard error: completing inline would create an order
 * nobody paid for.
 */
export function handoffFromSession(
  providerId: string,
  session: { provider_id?: string | null; data?: Record<string, unknown> | null } | undefined,
): PaymentHandoff {
  if (providerId !== PAYREXX_PROVIDER_ID) {
    return { kind: "inline", providerId };
  }

  const link = session?.data?.link;
  if (typeof link !== "string" || !link) {
    throw new PaymentSetupError(
      "Die Weiterleitung zur Bezahlseite konnte nicht erstellt werden. Bitte nochmals versuchen.",
    );
  }
  return { kind: "redirect", providerId, url: link };
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

  const available = providers ?? [];
  const providerId = choosePaymentProvider(available);
  if (!providerId) {
    throw new PaymentSetupError(
      "Für diese Region ist keine Zahlungsart hinterlegt.",
    );
  }

  try {
    const session = await initiateSession(sdk, cart, providerId);
    return handoffFromSession(providerId, session);
  } catch (error) {
    // The PSP session could not be created (typically: credentials missing in
    // this environment). Fall back to the built-in provider IF the region
    // still offers it — loudly, because in production this line must never
    // appear once `pp_system_default` is removed from the region.
    const fallback = available.find(
      (p) => p.id === "pp_system_default" && p.id !== providerId,
    );
    if (!fallback) throw error;

    console.error(
      `[checkout] payment session with ${providerId} failed — falling back to ` +
        `pp_system_default (authorises WITHOUT moving money): ${String(error)}`,
    );
    await initiateSession(sdk, cart, fallback.id);
    return { kind: "inline", providerId: fallback.id };
  }
}

async function initiateSession(
  sdk: Medusa,
  cart: HttpTypes.StoreCart,
  providerId: string,
): Promise<HttpTypes.StorePaymentSession | undefined> {
  const { payment_collection } = await sdk.store.payment.initiatePaymentSession(
    cart,
    { provider_id: providerId },
  );
  return (payment_collection?.payment_sessions ?? []).find(
    (s) => s.provider_id === providerId,
  );
}
