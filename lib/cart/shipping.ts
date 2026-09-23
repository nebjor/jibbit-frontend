/**
 * Shipping cost as the storefront ESTIMATES it before a delivery method sits on
 * the cart — pure, no network.
 *
 * ⚠️ This is a display estimate, never a charge. The binding number is
 * `cart.shipping_total`, produced by the backend's `swiss-shipping` provider,
 * which compares the GROSS goods total against its `freeShippingThreshold`.
 * `SHIPPING` in lib/config.ts mirrors its options; there is no runtime link
 * between the two.
 */

import { SHIPPING } from "@/lib/config";

/** Estimated gross shipping for a goods subtotal: free at the threshold. */
export function estimateShipping(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= SHIPPING.freeThreshold ? 0 : SHIPPING.rate;
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
