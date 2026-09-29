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
 * ══ ONE REDIRECT PROVIDER ═════════════════════════════════════════════════
 * The shop's only PSP is zahls.ch via the official plugin — hosted-redirect:
 * the backend creates a gateway and puts the hosted-payment-page URL into
 * the session's `data.link`; we send the browser there.
 *
 *   pp_zahls_zahls      the official plugin (@zahls/medusa-plugin).
 *                       Verified against the plugin source
 *                       (.medusa/server/src/providers/zahls/service.js):
 *                       `initiatePayment()` stores the gateway as
 *                       `data: { id, hash, link, referenceId, status, amount,
 *                       currency }` — the checkout URL is `data.link`.
 *                       Its return URLs are STATIC (no query), so the way
 *                       back cannot rely on a session id — see
 *                       lib/checkout/return.ts, `completePendingOrder()`.
 *
 * ══ WHY `pp_system_default` IS STILL AROUND ═══════════════════════════════
 * Medusa's built-in provider marks a payment as authorised WITHOUT MOVING
 * MONEY. It is the fallback for environments where no PSP is configured
 * (local dev, CI) — the region seed registers it. It must be removed from
 * the region before go-live (docs/zahls-plugin.md in the backend repo).
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

/** The official zahls.ch plugin (@zahls/medusa-plugin) — the shop's only PSP. */
export const ZAHLS_PROVIDER_ID = "pp_zahls_zahls";

/** Medusa's built-in provider — authorises WITHOUT moving money. Dev/CI only. */
export const SYSTEM_DEFAULT_PROVIDER_ID = "pp_system_default";

/**
 * Providers that hand the customer to a hosted payment page. The page's URL
 * sits in `session.data.link` (verified in the plugin source).
 */
const REDIRECT_PROVIDER_IDS: ReadonlySet<string> = new Set([
  ZAHLS_PROVIDER_ID,
]);

/**
 * First match wins. The order is a deliberate decision:
 *
 *   1. zahls.ch plugin — the shop's real PSP; it always outranks the
 *      no-money system provider.
 *   2. `pp_system_default` — LAST resort for dev/CI, blocked in production
 *      builds (see `systemDefaultAllowed`).
 */
const PROVIDER_PREFERENCE = [
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
      "Die Weiterleitung zur Bezahlseite konnte nicht erstellt werden. Dein " +
        "Warenkorb bleibt erhalten — bitte in ein paar Minuten nochmals " +
        "versuchen oder uns kurz schreiben.",
    );
  }
  return { kind: "redirect", providerId, url: link };
}

/**
 * What the customer reads when the PSP session could not be created.
 *
 * NOT "Bitte nochmals versuchen": by far the most common cause is a backend
 * that offers a provider it cannot serve (see `describeInitiateFailure`), and
 * retrying that never helps. The message says what is true — it is not the
 * cart, it is our side — and offers the one action that does help.
 */
export const PAYMENT_UNAVAILABLE =
  "Die Bezahlung lässt sich gerade nicht starten — an deinem Warenkorb liegt " +
  "es nicht. Dein Warenkorb bleibt erhalten: bitte in ein paar Minuten " +
  "nochmals versuchen oder uns kurz schreiben, dann klären wir das.";

/**
 * The one line that has to end up in the server log when payment setup fails.
 *
 * ─── WHY THIS IS WORTH ITS OWN FUNCTION ───────────────────────────────────
 * `POST /store/payment-collections/:id/payment-sessions` answers with a bare
 * 500 `unknown_error` for BOTH of the realistic causes, so the response body
 * alone never says which one it was:
 *
 *   1. The region offers a provider the running backend does not register
 *      (a `ZAHLS_*` value missing from its environment). Medusa's payment
 *      module throws "Unable to retrieve the payment provider with id: …"
 *      and turns it into `unknown_error`. Note that the store route
 *      `GET /store/payment-providers` still lists such a provider, and its
 *      `is_enabled` stays `true` forever — Medusa 2.13.6 never flips it
 *      (`@medusajs/payment/dist/loaders/providers.js` filters the existing
 *      rows by the very list it then compares against, so the disable branch
 *      is unreachable). The storefront therefore CANNOT detect this case.
 *   2. The PSP itself refused (bad key, gateway rejected, network).
 *
 * So the storefront logs everything it knows — which provider it picked, what
 * the region offered, and the backend's status/type/message — and names the
 * command that settles it on the backend side. Without that line, the next
 * person starts this investigation from zero.
 *
 * ─── THE HINT FOLLOWS THE FAILURE ─────────────────────────────────────────
 * Not every failure is a bare 500. When zahls.ch itself refuses, its answer
 * comes through as a 4xx WITH a message — on staging that was `status=400 |
 * message=An error occurred: API is not included in your license.` (trial
 * expired). Appending the "provider not registered" hint to such a line sends
 * the reader to the wrong place, so `initiateFailureHint` chooses the hint
 * from what the backend actually answered.
 */
export function describeInitiateFailure(
  providerId: string,
  regionId: string | null | undefined,
  available: readonly { id: string }[],
  error: unknown,
): string {
  const e = (error ?? {}) as Record<string, unknown>;
  const status = e.status ?? e.statusCode;
  const type = e.type ?? e.code;
  const message = error instanceof Error ? error.message : String(error);

  const parts = [
    `provider=${providerId}`,
    `region=${regionId ?? "?"}`,
    `region_offers=[${available.map((p) => p.id).join(",") || "-"}]`,
  ];
  if (status != null) parts.push(`status=${String(status)}`);
  if (type != null) parts.push(`type=${String(type)}`);
  parts.push(`message=${message}`);

  return (
    `[checkout] could not create a payment session — ${parts.join(" | ")} | ` +
    initiateFailureHint(status, type, message)
  );
}

/**
 * The diagnosis script, as it has to be called INSIDE the container: the
 * runtime image only holds the output of `medusa build`, so the file is
 * `.js` there. The `.ts` path exists only in the source tree.
 */
const CHECK_PAYMENT_SETUP =
  "docker compose exec medusa npx medusa exec ./src/scripts/check-payment-setup.js " +
  "(.js inside the container, which only holds compiled code; " +
  "locally / with `medusa develop` it is ./src/scripts/check-payment-setup.ts)";

/**
 * Pick the hint that matches the failure.
 *
 *   - "zahls.ch network error"      → the backend cannot reach zahls.ch
 *   - 4xx WITH a message            → zahls.ch refused; the message is its
 *                                     answer (license / credentials / other)
 *   - 500, `unknown_error`, nothing → provider offered but not registered
 */
export function initiateFailureHint(
  status: unknown,
  type: unknown,
  message: string,
): string {
  const text = message.trim();

  if (/zahls\.ch network error/i.test(text)) {
    return (
      `the backend cannot reach zahls.ch (network error) — nothing is wrong ` +
      `with the provider setup or the cart. Check outbound connectivity/DNS ` +
      `of the medusa container and the zahls.ch status, then retry.`
    );
  }

  const code = Number(status);
  const rejected =
    status != null &&
    Number.isFinite(code) &&
    code >= 400 &&
    code < 500 &&
    text !== "" &&
    String(type ?? "") !== "unknown_error";

  if (rejected) {
    const head =
      `the payment provider rejected the call — the message above is its ` +
      `answer, the provider IS registered. `;
    if (/licen[sc]e|lizenz/i.test(text)) {
      return (
        head +
        `Check the zahls.ch subscription (trial expired or plan without API ` +
        `access) in the zahls.ch backend; no deploy needed.`
      );
    }
    if (
      code === 401 ||
      code === 403 ||
      /api[\s_-]?(key|secret)|instance|unauthori[sz]ed|forbidden/i.test(text)
    ) {
      return (
        head +
        `Check ZAHLS_API_KEY / ZAHLS_INSTANCE in the backend's environment ` +
        `against the zahls.ch backend.`
      );
    }
    return (
      head + `Check account, license and credentials in the zahls.ch backend.`
    );
  }

  return (
    `a bare 500/unknown_error here usually means the backend offers this ` +
    `provider but does not register it (missing ZAHLS_* in its environment). ` +
    `Settle it on the backend: ${CHECK_PAYMENT_SETUP}`
  );
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
    console.error(
      `[checkout] no usable payment provider — region=${cart.region_id ?? "?"} | ` +
        `region_offers=[${available.map((p) => p.id).join(",") || "-"}] | ` +
        `system_default_allowed=${allowSystemDefault} | ` +
        `fix: Admin → Einstellungen → Regionen → Zahlungsanbieter → zahls.ch`,
    );
    throw new PaymentSetupError(
      "Für diese Region ist gerade keine Zahlungsart freigeschaltet. Schreib " +
        "uns kurz — wir schalten sie frei und melden uns bei dir.",
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
    // Log BEFORE deciding what to do with it: this is the only place that
    // still holds the provider, the region and the region's offer list
    // together with the backend's answer.
    console.error(describeInitiateFailure(providerId, cart.region_id, available, error));

    const fallback = allowSystemDefault
      ? available.find(
          (p) => p.id === SYSTEM_DEFAULT_PROVIDER_ID && p.id !== providerId,
        )
      : undefined;
    if (!fallback) {
      // Turn it into a PaymentSetupError so the customer gets a message that
      // says something true, instead of `placeOrder`'s catch-all "please try
      // again" — which is wrong advice for a misconfigured backend.
      throw new PaymentSetupError(PAYMENT_UNAVAILABLE);
    }

    console.error(
      `[checkout] falling back to pp_system_default for ${providerId} ` +
        `(authorises WITHOUT moving money)`,
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
