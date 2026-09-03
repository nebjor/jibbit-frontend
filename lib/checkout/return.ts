/**
 * Rückkehr von der zahls.ch-Bezahlseite — server-only.
 *
 * Die Redirect-URLs des offiziellen Plugins (pp_zahls_zahls) sind STATISCH
 * (pro Provider in medusa-config.ts hinterlegt, ohne Query) — es gibt auf
 * dem Rückweg keine Zahlungsreferenz in der URL. Die server-seitige Prüfung
 * ist `cart.complete()` selbst: Medusas `completeCartWorkflow` autorisiert
 * die Payment Session, wofür das Plugin den Gateway-Status FRISCH bei
 * zahls.ch abfragt (`authorizePayment` → `getPaymentStatus` → `getGateway`,
 * siehe Plugin-Quelltext providers/zahls/service.js). Unbezahlt ⇒ complete
 * schlägt fehl, es entsteht keine Bestellung. Bezahlt ⇒ Bestellung — oder,
 * wenn der Webhook schneller war, idempotent die BESTEHENDE Bestellung.
 *
 * Wer `/checkout/success` von Hand aufruft, bekommt deshalb keine bezahlte
 * Bestellung.
 */

import "server-only";

import {
  cartContext,
  clearCartId,
  currentCartId,
  logCartError,
} from "@/lib/cart/server";

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
