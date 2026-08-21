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

/**
 * Payment methods offered, via zahls.ch (a white-label of the Payrexx
 * platform — the backend's Payrexx module talks to it, see
 * backend/src/modules/payrexx). Content-level: what the shop PROMISES.
 * No invoice purchase — zahls.ch has no Powerpay; Rechnungs-/Ratenkauf
 * would be Klarna and needs the "Pay Plus" plan.
 */
export const PAYMENT_METHODS = [
  { id: "twint", label: "TWINT" },
  { id: "card", label: "Kreditkarte (Visa/Mastercard)" },
  { id: "postfinance", label: "PostFinance" },
] as const;

/**
 * Minimum age for purchase in Switzerland (tobacco-adjacent accessories).
 */
export const MIN_AGE = 18;

/**
 * Browser theme colour (address bar on mobile).
 *
 * ⚠️ This must mirror `--c-ground` in app/tokens.css. It cannot read the CSS
 * custom property, because Next emits it into <meta name="theme-color"> at build
 * time. When you swap the colorway, update this value too — it is the only
 * colour literal outside tokens.css.
 */
export const THEME_COLOR = "#F6F5F3";
