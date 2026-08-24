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
 * ══ TWO REDIRECT PROVIDERS, ONE ACCOUNT ═══════════════════════════════════
 * Both talk to the shop's zahls.ch account (a white-label of the Payrexx
 * platform) and both are hosted-redirect: the backend creates a gateway and
 * puts the hosted-payment-page URL into the session's `data.link`; we send
 * the browser there.
 *
 *   pp_payrexx_payrexx  the in-house module (backend/src/modules/payrexx).
 *                       The solution running today. Appends
 *                       `?payment_session_id=…` to its return URLs, so
 *                       /checkout/success can verify the payment via
 *                       `POST /store/payrexx/return` (lib/checkout/return.ts).
 *
 *   pp_zahls_zahls      the official plugin (@zahls/medusa-plugin), newly
 *                       registered in parallel. Verified against the plugin
 *                       source (.medusa/server/src/providers/zahls/service.js):
 *                       `initiatePayment()` stores the gateway as
 *                       `data: { id, hash, link, referenceId, status, amount,
 *                       currency }` — the checkout URL is `data.link`, same
 *                       field as the Payrexx module. Its return URLs are
 *                       STATIC (no query), so the way back cannot rely on a
 *                       session id — see lib/checkout/return.ts,
 *                       `completePendingOrder()`.
 *
 * ══ WHY `pp_system_default` IS STILL AROUND ═══════════════════════════════
 * Medusa's built-in provider marks a payment as authorised WITHOUT MOVING
 * MONEY. It is the fallback for environments where no PSP is configured
 * (local dev, CI) — the region seed registers it. It must be removed from
 * the region before go-live (docs/payrexx-go-live.md §7 in the backend repo).
 * Belt and braces: a production build (`NODE_ENV=production`) refuses to
 * select or fall back to it unless `CHECKOUT_ALLOW_SYSTEM_PROVIDER=true` is
 * set explicitly — so even a forgotten region entry cannot silently produce
 * "paid" orders nobody paid for. See `systemDefaultAllowed()`.
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

/** The in-house Payrexx module (talking to zahls.ch), as registered by the backend. */
export const PAYREXX_PROVIDER_ID = "pp_payrexx_payrexx";

/** The official zahls.ch plugin (@zahls/medusa-plugin), registered in parallel. */
export const ZAHLS_PROVIDER_ID = "pp_zahls_zahls";

/** Medusa's built-in provider — authorises WITHOUT moving money. Dev/CI only. */
export const SYSTEM_DEFAULT_PROVIDER_ID = "pp_system_default";

/**
 * Providers that hand the customer to a hosted payment page. Both put the
 * page's URL into `session.data.link` (verified in both backends' sources).
 */
const REDIRECT_PROVIDER_IDS: ReadonlySet<string> = new Set([
  PAYREXX_PROVIDER_ID,
  ZAHLS_PROVIDER_ID,
]);

/**
 * First match wins. The order is a deliberate decision:
 *
 *   1. Payrexx module — the E2E-proven solution that is live today. As long
 *      as the operator keeps it on the region, it keeps taking the money;
 *      the plugin's flow cannot regress a working checkout.
 *   2. zahls.ch plugin — ranked above the system provider so that the moment
 *      the operator removes `pp_payrexx_payrexx` from the region (step 2 of
 *      the switch-over in docs/zahls-plugin.md, backend repo), the storefront
 *      moves to the plugin on its own — no code change, no window in which
 *      the no-money system provider would take over.
 *   3. `pp_system_default` — LAST resort for dev/CI, blocked in production
 *      builds (see `systemDefaultAllowed`).
 */
const PROVIDER_PREFERENCE = [
  PAYREXX_PROVIDER_ID,
  ZAHLS_PROVIDER_ID,
  SYSTEM_DEFAULT_PROVIDER_ID,
];

/**
 * May `pp_system_default` be used at all?
 *
 * In production it authorises orders WITHOUT payment, so a production build
 * refuses it unless the operator opts in explicitly (e.g. a staging smoke
 * test) via `CHECKOUT_ALLOW_SYSTEM_PROVIDER=true`. Everywhere else (dev,
 * test, CI) it stays available so a checkout without PSP credentials works.
 */
export function systemDefaultAllowed(
  env: { NODE_ENV?: string; CHECKOUT_ALLOW_SYSTEM_PROVIDER?: string } = process.env,
): boolean {
  return (
    env.NODE_ENV !== "production" ||
    env.CHECKOUT_ALLOW_SYSTEM_PROVIDER === "true"
  );
}

export function choosePaymentProvider(
  available: readonly { id: string }[],
  allowSystemDefault: boolean = systemDefaultAllowed(),
): string | undefined {
  const candidates = allowSystemDefault
    ? available
    : available.filter((p) => p.id !== SYSTEM_DEFAULT_PROVIDER_ID);

  for (const preferred of PROVIDER_PREFERENCE) {
    if (candidates.some((p) => p.id === preferred)) return preferred;
  }
  return candidates[0]?.id;
}

/**
 * Turns an initiated payment session into a handoff. Pure, so it is testable.
 *
 * For a redirect provider the gateway URL sits in `session.data.link`
 * (put there by the backend's `initiatePayment()`). A redirect provider
 * WITHOUT a usable link is a hard error: completing inline would create an
 * order nobody paid for.
 */
export function handoffFromSession(
  providerId: string,
  session: { provider_id?: string | null; data?: Record<string, unknown> | null } | undefined,
): PaymentHandoff {
  if (!REDIRECT_PROVIDER_IDS.has(providerId)) {
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
  allowSystemDefault: boolean = systemDefaultAllowed(),
): Promise<PaymentHandoff> {
  const { payment_providers: providers } =
    await sdk.store.payment.listPaymentProviders({
      region_id: cart.region_id!,
      limit: 20,
    });

  const available = providers ?? [];
  const providerId = choosePaymentProvider(available, allowSystemDefault);
  if (!providerId) {
    throw new PaymentSetupError(
      "Für diese Region ist keine Zahlungsart hinterlegt.",
    );
  }

  try {
    const session = await initiateSession(sdk, cart, providerId);
    return handoffFromSession(providerId, session);
  } catch (error) {
    // A session that EXISTS but is unusable (redirect provider without a
    // link) is a contract violation, not a missing-credentials situation —
    // faking the payment inline would create an unpaid "paid" order. Bubble
    // it up instead; the customer sees the message, the cart stays intact.
    if (error instanceof PaymentSetupError) throw error;

    // The PSP session could not be created (typically: credentials missing in
    // this environment). Fall back to the built-in provider IF the region
    // still offers it AND this environment permits it — loudly, because in
    // production this line must never appear once `pp_system_default` is
    // removed from the region.
    const fallback = allowSystemDefault
      ? available.find(
          (p) => p.id === SYSTEM_DEFAULT_PROVIDER_ID && p.id !== providerId,
        )
      : undefined;
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
