/**
 * Shipping cost as the storefront ESTIMATES it before a delivery method sits on
 * the cart — pure, no network.
 *
 * ⚠️ This is a display estimate, never a charge. The binding number is
 * `cart.shipping_total`, produced by the backend's `swiss-shipping` provider.
 * The two agree because they use the same rule against the same quantity:
 *
 *   - The provider (`SwissShippingProviderService.calculatePrice`) compares the
 *     GROSS, tax-inclusive goods total against its `freeShippingThreshold`
 *     option.
 *   - `SHIPPING` in lib/config.ts mirrors `letterPrice` / `parcelPrice` /
 *     `freeShippingThreshold` from the backend's medusa-config.ts.
 *
 * ⚠️ WARUM DIE SCHAETZUNG IMMER DEN PAKETTARIF NENNT: Seit dem 22.08.2026 ist
 * der Tarif dreistufig, und ob eine Sendung als Brief oder als Paket geht,
 * entscheidet das GEWICHT der Varianten. Das Gewicht liegt im Warenkorb der
 * Storefront nicht vor — nur das Backend sieht es. Diese Schaetzung nennt
 * deshalb den hoeheren der beiden Saetze. Faellt der echte Versand guenstiger
 * aus, sieht der Kunde an der Kasse WENIGER als hier angekuendigt. Andersherum
 * waere es ein Versprechen, das die Kasse bricht.
 *
 * ⚠️ If an operator changes those backend options, `SHIPPING` must change with
 * them. There is no runtime link between the two — the storefront cannot read
 * the fulfillment provider's configuration.
 */

import { SHIPPING } from "@/lib/config";

/**
 * Estimated gross shipping for a goods subtotal. Free at and above the
 * threshold, otherwise the PARCEL rate — see the note above on why this is
 * deliberately the pessimistic of the two rates.
 */
export function estimateShipping(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= SHIPPING.freeThreshold ? 0 : SHIPPING.parcelRate;
}

/** CHF still needed for free shipping; 0 once reached. */
export function remainingForFreeShipping(subtotal: number): number {
  const missing = SHIPPING.freeThreshold - subtotal;
  return missing > 0 ? Math.round(missing * 100) / 100 : 0;
}

/** 0..1 progress toward the free-shipping threshold. */
export function freeShippingProgress(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return Math.min(subtotal / SHIPPING.freeThreshold, 1);
}
