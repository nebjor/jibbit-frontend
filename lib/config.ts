/** Store-wide commercial + brand constants. Single place to change them. */

export const STORE = {
  name: "jibbit",
  domain: "jibbit.ch",
  tagline: "Der erste gemeinschaftsorientierte Online Headshop der Schweiz.",
  locale: "de-CH",
  currency: "CHF",
} as const;

/** Shipping rules. Used by the cart's free-shipping progress indicator. */
export const SHIPPING = {
  /** Flat rate in CHF. */
  flatRate: 9.0,
  /** Order total (CHF) from which shipping is free. */
  freeThreshold: 100.0,
} as const;

/** Payment methods offered (via Payrexx). Content-level only for now. */
export const PAYMENT_METHODS = [
  { id: "twint", label: "TWINT" },
  { id: "powerpay", label: "Powerpay (Rechnung)" },
] as const;

/**
 * Minimum age for purchase in Switzerland (tobacco-adjacent accessories).
 */
export const MIN_AGE = 18;
