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

import { estimateShipping } from "@/lib/cart/shipping";
import { DELIVERY, PICKUP } from "@/lib/config";
import { pickupAddressLines, pickupHoursText, type DeliveryChoice } from "@/lib/checkout/pickup";
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

/** Eine wählbare Lieferart in der eingeklappten Kasse (Radiogruppe «Lieferung»). */
export interface DeliveryOptionView {
  value: DeliveryChoice;
  title: string;
  /** «CHF 4.50» oder «Gratis». */
  cost: string;
  /** Nur die Schätzung des Shops, nicht Medusas Betrag (Lieferart nicht gewählt). */
  estimate: boolean;
  /** Lieferzusage bzw. Abholort mit Zeiten. */
  detail: string;
}

/**
 * Die Lieferarten, zwischen denen die Kundin in der eingeklappten Kasse wählt.
 *
 * Die gewählte Art zeigt Medusas Betrag (`shipping`). Für die nicht gewählte
 * Versandart kennt nur der Shop eine Schätzung (lib/cart/shipping.ts) — sie
 * ist als solche markiert, bis die Wahl auf dem Cart steht. Abholung gibt es
 * nur, wenn sie freigeschaltet ist.
 */
export function deliveryOptionViews(input: {
  pickup: boolean;
  shipping: number;
  subtotal: number;
  estimate?: boolean;
}): DeliveryOptionView[] {
  const shippingSelected = !input.pickup;
  const post = shippingDisplay({
    pickup: false,
    shipping: shippingSelected ? input.shipping : estimateShipping(input.subtotal),
  });
  const options: DeliveryOptionView[] = [
    {
      value: "shipping",
      title: post.label,
      cost: post.cost,
      estimate: shippingSelected ? Boolean(input.estimate) : true,
      detail: handlingTimeText(),
    },
  ];
  if (PICKUP.enabled) {
    options.push({
      value: "pickup",
      title: PICKUP.label,
      cost: "Gratis",
      estimate: false,
      detail: `${pickupAddressLines().slice(1).join(", ")} · ${pickupHoursText()}. ${PICKUP.note}`,
    });
  }
  return options;
}
