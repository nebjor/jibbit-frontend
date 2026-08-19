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

/**
 * Like `formatPrice`, but for an amount whose currency is not the store's
 * default — an order carries its own `currency_code`, and a tenant that sells
 * in EUR would otherwise get CHF amounts labelled in Swiss francs.
 *
 * Formatters are memoized per currency for the same reason as above: building
 * an Intl.NumberFormat per row is measurably slow.
 */
const byCurrency = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number, currency: string): string {
  const code = (currency || STORE.currency).toUpperCase();
  if (code === STORE.currency) return chf.format(amount);

  let fmt = byCurrency.get(code);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat(STORE.locale, {
        style: "currency",
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      // An unknown code must not take a page down over a currency symbol.
      fmt = bare;
    }
    byCurrency.set(code, fmt);
  }
  return fmt.format(amount);
}

/** Percentage saved, rounded down. Returns 0 when there is no discount. */
export function discountPercent(price: number, compareAt?: number): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.floor(((compareAt - price) / compareAt) * 100);
}
