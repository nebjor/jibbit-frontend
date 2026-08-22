/** Store-wide commercial + brand constants. Single place to change them. */

export const STORE = {
  name: "jibbit",
  domain: "jibbit.ch",
  tagline: "Der erste gemeinschaftsorientierte Online Headshop der Schweiz.",
  locale: "de-CH",
  currency: "CHF",
} as const;

/**
 * Shipping rules. Used by the cart's free-shipping progress indicator and by
 * every piece of shipping copy in the shop.
 *
 * Muss mit den Optionen des swiss-shipping Providers im Backend
 * uebereinstimmen (medusa-config.ts: letterPrice / parcelPrice /
 * freeShippingThreshold) — hier stehen sie nur zur Anzeige, gerechnet wird
 * serverseitig. Brief oder Paket entscheidet dort das Variantengewicht.
 */
export const SHIPPING = {
  /** Kleinsendung im Briefformat, in CHF. */
  letterRate: 3.75,
  /** Paket — z. B. eine ganze Box oder ein Display, in CHF. */
  parcelRate: 9.0,
  /** Order total (CHF) from which shipping is free. */
  freeThreshold: 69.0,
} as const;

/**
 * Payment methods offered. Content-level only for now.
 *
 * Kauf auf Rechnung (Powerpay) wird NICHT angeboten — der Zahlungsdienstleister
 * fuehrt es nicht, und die AGB nennen es seit dem 22.08.2026 nicht mehr.
 */
export const PAYMENT_METHODS = [
  { id: "twint", label: "TWINT" },
  { id: "card", label: "Kreditkarte" },
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
