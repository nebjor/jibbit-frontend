/**
 * Rückkehr von der Bezahlseite — server-only. Zwei Wege, je nach Provider:
 *
 * ── Payrexx-Modul (pp_payrexx_payrexx): `confirmPaymentReturn()` ──────────
 * Der Kunde landet nach dem Bezahlen auf
 * `/checkout/success?payment_session_id=…`. Was dann passiert, entscheidet
 * NIE der Browser, sondern immer das Backend:
 *
 *   1. `POST /store/payrexx/return` — das Backend fragt den Zahlungsstand
 *      frisch beim PSP ab und schliesst bei bestätigter Zahlung den Cart
 *      selbst ab (derselbe Weg, den auch der Webhook nimmt; beide teilen sich
 *      einen Idempotenz-Schlüssel, doppelt passiert nichts).
 *   2. `cart.complete()` — liefert die Bestellung. Medusas
 *      `completeCartWorkflow` ist idempotent: für einen bereits (vom Webhook
 *      oder von Schritt 1) abgeschlossenen Cart kommt die BESTEHENDE
 *      Bestellung zurück, es entsteht keine zweite.
 *
 * Wer `/checkout/success` von Hand aufruft, bekommt deshalb keine bezahlte
 * Bestellung — Schritt 1 meldet dann `pending` und hier endet es.
 *
 * ── zahls.ch-Plugin (pp_zahls_zahls): `completePendingOrder()` ────────────
 * Die Redirect-URLs des offiziellen Plugins sind STATISCH (pro Provider in
 * medusa-config.ts hinterlegt, ohne Query) — es gibt auf dem Rückweg keine
 * `payment_session_id` und keine `/store/payrexx/return`-Route. Die
 * server-seitige Prüfung ist hier `cart.complete()` selbst: Medusas
 * `completeCartWorkflow` autorisiert die Payment Session, wofür das Plugin
 * den Gateway-Status FRISCH bei zahls.ch abfragt (`authorizePayment` →
 * `getPaymentStatus` → `getGateway`, siehe Plugin-Quelltext
 * providers/zahls/service.js). Unbezahlt ⇒ complete schlägt fehl, es
 * entsteht keine Bestellung. Bezahlt ⇒ Bestellung — oder, wenn der Webhook
 * schneller war, idempotent die BESTEHENDE Bestellung.
 */

import "server-only";

import {
  cartContext,
  clearCartId,
  currentCartId,
  logCartError,
} from "@/lib/cart/server";

export type PaymentReturnResult =
  /** Bezahlt und Bestellung gefunden — Bestätigungsseite zeigen. */
  | { kind: "order"; orderId: string }
  /** Bezahlt, aber kein Cart-Cookie mehr (anderer Browser/Gerät). */
  | { kind: "paid" }
  /** Noch nicht bezahlt oder Zahlung noch in Prüfung — später erneut fragen. */
  | { kind: "pending" }
  /** Zahlung abgelehnt oder abgebrochen. Der Warenkorb besteht weiter. */
  | { kind: "canceled" }
  /** Backend/PSP nicht erreichbar — KEIN Misserfolg, erneut versuchen. */
  | { kind: "unknown" }
  | { kind: "error"; message: string };

export async function confirmPaymentReturn(
  paymentSessionId: string,
): Promise<PaymentReturnResult> {
  if (!paymentSessionId) {
    return { kind: "error", message: "Es fehlt die Zahlungsreferenz." };
  }

  const ctx = await cartContext();
  if (!ctx) {
    return { kind: "unknown" };
  }

  let status: string;
  try {
    const res = await ctx.sdk.client.fetch<{ status?: string }>(
      "/store/payrexx/return",
      {
        method: "POST",
        body: { payment_session_id: paymentSessionId },
      },
    );
    status = String(res?.status ?? "unknown");
  } catch (error) {
    // Auch ein 502 ("PSP nicht erreichbar") landet hier. Bewusst KEIN
    // Fehler: der Webhook zieht unabhängig davon nach, und der Client darf
    // es gleich nochmals versuchen.
    logCartError("checkout:payment-return", error);
    return { kind: "unknown" };
  }

  if (status === "pending") return { kind: "pending" };
  if (status === "canceled") return { kind: "canceled" };
  if (status !== "authorized" && status !== "captured") {
    return { kind: "unknown" };
  }

  // Zahlung ist beim PSP bestätigt. Jetzt die Bestellung holen.
  const cartId = await currentCartId();
  if (!cartId) {
    // Zahlung ist da, aber dieser Browser kennt den Cart nicht (mehr) —
    // die Bestellung entsteht trotzdem (Webhook/Return-Route), nur die
    // Bestätigungsseite können wir nicht zeigen.
    return { kind: "paid" };
  }

  try {
    const result = await ctx.sdk.store.cart.complete(cartId);
    if (result.type === "order") {
      await clearCartId();
      return { kind: "order", orderId: result.order.id };
    }
    const message =
      typeof result.error?.message === "string"
        ? result.error.message
        : "Die Bestellung konnte noch nicht abgeschlossen werden.";
    return { kind: "error", message };
  } catch (error) {
    logCartError("checkout:payment-complete", error);
    // Die Zahlung IST bestätigt — das darf dem Kunden nicht als Misserfolg
    // präsentiert werden. Webhook/Retry schliessen die Bestellung ab.
    return { kind: "paid" };
  }
}

// ---------------------------------------------------------------------------
// zahls.ch-Plugin: Rückkehr ohne Session-Referenz
// ---------------------------------------------------------------------------

export type PendingOrderResult =
  /** Bestellung abgeschlossen — Bestätigungsseite zeigen. */
  | { kind: "order"; orderId: string }
  /**
   * Noch keine Bestellung: Zahlung (laut zahls.ch) noch nicht bestätigt oder
   * Backend gerade nicht erreichbar — später erneut versuchen. Der Warenkorb
   * bleibt bestehen; erst eine erfolgreiche Bestellung räumt ihn weg.
   */
  | { kind: "pending" }
  /** Kein Warenkorb in diesem Browser — hier gibt es nichts abzuschliessen. */
  | { kind: "missing" };

/**
 * `cart.complete()` gegen den Cart aus dem Cookie — die gesamte Wahrheit
 * kommt vom Backend (das wiederum bei zahls.ch nachfragt), nie vom Browser.
 *
 * Bewusst OHNE das `completed_at`-Frühwarnsystem von `loadCart()`: hat der
 * Webhook den Cart schon abgeschlossen, liefert `completeCartWorkflow`
 * idempotent die bestehende Bestellung zurück — genau die wollen wir zeigen.
 *
 * Ein `pending` unterscheidet NICHT zwischen «noch nicht bezahlt» und
 * «Backend nicht erreichbar» — beides heisst für den Kunden: warten, nichts
 * wurde doppelt belastet, der Warenkorb ist noch da.
 */
export async function completePendingOrder(): Promise<PendingOrderResult> {
  const ctx = await cartContext();
  const cartId = await currentCartId();
  if (!ctx || !cartId) {
    return { kind: "missing" };
  }

  try {
    const result = await ctx.sdk.store.cart.complete(cartId);
    if (result.type === "order") {
      await clearCartId();
      return { kind: "order", orderId: result.order.id };
    }
    // `{ type: "cart", error }` — typischerweise «payment not authorized»,
    // solange zahls.ch die Zahlung noch nicht bestätigt hat.
    return { kind: "pending" };
  } catch (error) {
    logCartError("checkout:pending-order", error);
    return { kind: "pending" };
  }
}
