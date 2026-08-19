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
 *     option. Verified against a live backend: `item_total` 100.00 -> shipping
 *     0, `item_total` 99.60 -> shipping 9.
 *   - `SHIPPING` in lib/config.ts mirrors `fixedPrice` / `freeShippingThreshold`
 *     from the backend's medusa-config.ts.
 *
 * ⚠️ If an operator changes those backend options, `SHIPPING` must change with
 * them. There is no runtime link between the two — the storefront cannot read
 * the fulfillment provider's configuration.
 */

import { SHIPPING } from "@/lib/config";

/** Estimated gross shipping for a goods subtotal. Free at and above the threshold. */
export function estimateShipping(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= SHIPPING.freeThreshold ? 0 : SHIPPING.flatRate;
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
