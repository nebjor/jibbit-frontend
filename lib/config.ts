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
 * Payment methods offered, via zahls.ch (official plugin
 * @zahls/medusa-plugin in the backend). Content-level: what the shop
 * PROMISES. No invoice purchase — zahls.ch has no Powerpay;
 * Rechnungs-/Ratenkauf would be Klarna and needs the "Pay Plus" plan.
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
 * Anbieterkennzeichnung — dieselben Angaben, die app/impressum/page.tsx für
 * Menschen rendert, hier maschinenlesbar für das Organization-Schema
 * (lib/seo/jsonld.ts).
 *
 * ⚠️ ZWEI ORTE, EIN SACHVERHALT: ändert sich die Adresse oder die Nummer,
 * muss sie HIER UND im Impressum geändert werden. Bewusst nicht zusammen-
 * gelegt — die Impressumsseite ist ein Rechtstext mit eigener Gliederung und
 * offenen Punkten, kein Datensatz. Wer sie später auf diese Konstanten
 * umstellt, löst das Problem richtig.
 */
export const BUSINESS = {
  legalName: "Neber Import",
  owner: "Joris Neber",
  street: "Unterwegli 1",
  postalCode: "8404",
  city: "Winterthur",
  /** ISO-3166-1 alpha-2. Steht auch in jeder Versand- und Rückgabeangabe. */
  countryCode: "CH",
  email: "joris@jibbit.ch",
  /** E.164 — schema.org will eine international wählbare Nummer. */
  telephone: "+41764140890",
} as const;

/**
 * Lieferfristen in Werktagen, für `OfferShippingDetails.deliveryTime`.
 *
 * Bearbeitung: 1–3 Werktage nach Bestelleingang, so auch auf
 * /service/versand.
 *
 * Transport (Angabe des Betreibers): A-Post 1–2 Werktage, B-Post 2–3 — je
 * nachdem, zu welcher Tageszeit bestellt wird. Ausgezeichnet wird 1–3, weil
 * das beide Versandarten abdeckt und der Shop im Bestellprozess keine
 * zusichert. Wer später nur noch B-Post bucht, verengt hier auf 2–3: eine
 * genauere Angabe ist besser, eine zu knappe ist eine Zusage, die bricht.
 *
 * Die Zahlen müssen mit dem übereinstimmen, was /service/versand schreibt —
 * Google gleicht das Markup gegen die Seite ab.
 */
export const DELIVERY = {
  handlingDaysMin: 1,
  handlingDaysMax: 3,
  /** A-Post: 1–2 Werktage. */
  transitDaysMin: 1,
  /** B-Post: 2–3 Werktage. */
  transitDaysMax: 3,
} as const;

/**
 * Rückgabe, maschinenlesbar. Menschenlesbar: /service/rueckgabe.
 *
 * `MerchantReturnNotPermitted` ist keine Nachlässigkeit, sondern die
 * Regelung: das Schweizer Recht kennt für Onlinebestellungen kein
 * Widerrufsrecht, und jibbit gewährt freiwillig keines. Defekte und
 * Falschlieferungen laufen über die gesetzliche Sachgewährleistung — die
 * ist kein Rückgabefenster und darf auch nicht als eines ausgezeichnet
 * werden.
 */
export const RETURNS = {
  category: "MerchantReturnNotPermitted",
  /** Sachgewährleistung nach OR, in Jahren. Nur Anzeige/Doku. */
  warrantyYears: 2,
} as const;

/**
 * Browser theme colour (address bar on mobile).
 *
 * ⚠️ This must mirror `--c-ground` in app/tokens.css. It cannot read the CSS
 * custom property, because Next emits it into <meta name="theme-color"> at build
 * time. When you swap the colorway, update this value too — it is the only
 * colour literal outside tokens.css.
 */
export const THEME_COLOR = "#F6F5F3";
