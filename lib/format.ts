import { STORE } from "./config";

/**
 * Money formatting. Medusa v2 prices are already decimal CHF — the value is
 * passed through untouched, only formatted.
 *
 * Uses a module-level Intl instance (constructing Intl.NumberFormat per render
 * is measurably slow in product grids).
 */
const chf = new Intl.NumberFormat(STORE.locale, {
  style: "currency",
  currency: STORE.currency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** -> "CHF 27.00" */
export function formatPrice(amount: number): string {
  return chf.format(amount);
}

/** -> "27.00" (no currency symbol, for price-forward layouts) */
const bare = new Intl.NumberFormat(STORE.locale, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatAmount(amount: number): string {
  return bare.format(amount);
}

/** Percentage saved, rounded down. Returns 0 when there is no discount. */
export function discountPercent(price: number, compareAt?: number): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.floor(((compareAt - price) / compareAt) * 100);
}
