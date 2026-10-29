/**
 * Was die Kasse über die Lieferart anzeigt — rein, ohne Netz, ohne Preislogik.
 *
 * Alle Beträge kommen fertig aus Medusa (`shipping_total`, siehe
 * lib/cart/adapter.ts); hier wird nur entschieden, WIE sie erscheinen:
 * «CHF 4.50» oder «Gratis». Gerechnet wird nichts.
 *
 * Der Name der Medusa-Option ist ein Verwaltungsname («Standardversand
 * Schweiz») und taucht nirgends sonst im Shop auf. Kundschaft liest, was der
 * Shop selbst schreibt: «Versand mit der Schweizerischen Post» (so auch in
 * der Lieferart-Wahl und auf /service/versand).
 *
 * Lieferzeit: Das Versandmodul liefert keine. Angezeigt wird deshalb nur,
 * was der Shop auf /service/versand und in den AGB selbst zusagt
 * (`DELIVERY.handlingDays*`: Versand innerhalb von 1–3 Werktagen) — keine
 * zusammengerechnete Ankunftszeit.
 */

import { DELIVERY, PICKUP } from "@/lib/config";
import { formatPrice } from "@/lib/format";

export const SHIPPING_METHOD_LABEL = "Versand mit der Schweizerischen Post";

export interface ShippingDisplay {
  /** «Versand mit der Schweizerischen Post» bzw. «Abholung im Laden». */
  label: string;
  /** «CHF 4.50» oder «Gratis». */
  cost: string;
  free: boolean;
  /** Vor der Methode auf dem Cart ist der Betrag nur die Schätzung. */
  estimate: boolean;
  /** Zusage des Shops zur Bearbeitungszeit; bei Abholung nicht vorhanden. */
  timing: string | null;
}

export function shippingDisplay(input: {
  pickup: boolean;
  shipping: number;
  estimate?: boolean;
}): ShippingDisplay {
  const free = input.shipping <= 0;
  return {
    label: input.pickup ? PICKUP.label : SHIPPING_METHOD_LABEL,
    cost: free ? "Gratis" : formatPrice(input.shipping),
    free,
    estimate: Boolean(input.estimate) && !input.pickup,
    timing: input.pickup ? null : handlingTimeText(),
  };
}

/** «Versand in der Regel innerhalb von 1–3 Werktagen» — Wortlaut wie /service/versand. */
export function handlingTimeText(): string {
  const { handlingDaysMin: min, handlingDaysMax: max } = DELIVERY;
  const range: string = min === (max as number) ? `${min}` : `${min}–${max}`;
  return `Versand in der Regel innerhalb von ${range} Werktagen`;
}

/**
 * «Noch CHF 26.10 bis Gratisversand» — derselbe Wortlaut wie der
 * FreeShippingMeter (Warenkorb und Kasse). `null`, wenn nichts mehr fehlt
 * oder es nichts freizuschalten gibt (Abholung).
 */
export function missingForFreeShippingText(remaining: number, pickup = false): string | null {
  if (pickup || !(remaining > 0)) return null;
  return `Noch ${formatPrice(remaining)} bis Gratisversand`;
}

/** Zeile «Anzahl × Einzelpreis» der Zusammenfassung. */
export function quantityTimesPrice(quantity: number, unitPrice: number): string {
  return `${quantity} × ${formatPrice(unitPrice)}`;
}
