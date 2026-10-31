/**
 * Typ der Shop-Konfiguration — alles, was an EINEM Shop hängt und bei einem
 * zweiten Shop anders ist. Die Werte stehen in `shop.config.ts` (Repo-Wurzel);
 * gelesen wird nur über `lib/config.ts` bzw. `SHOP` von dort.
 *
 * Abgrenzung zu `TenantConfig` (lib/tenant/types.ts): der Mandant sagt, WELCHES
 * Backend und WELCHE Domain diese Anfrage bedient (zur Laufzeit, pro Host);
 * die Shop-Konfiguration sagt, WIE der Shop aussieht und was er verspricht
 * (zur Build-Zeit, pro Deployment). Name, Domain und Browserfarbe des Mandanten
 * haben Vorrang — die Shop-Konfiguration liefert die Voreinstellung.
 *
 * Kein "server-only": die Datei enthält nur öffentliche Angaben und wird auch
 * von Client-Komponenten (Altersabfrage, Cookies) gelesen.
 */

export interface ShopBrand {
  /** Anzeigename, z. B. «jibbit». Auch Logo-Schriftzug. */
  name: string;
  /** Eigene öffentliche Domain. Nur auf ihr erscheinen Anbieterangaben, Pickup, Google. */
  domain: string;
  tagline: string;
  /** Titelzusatz: «<name> — <titleSuffix>». */
  titleSuffix: string;
  locale: string;
  currency: string;
}

export interface ShopBusiness {
  legalName: string;
  owner: string;
  street: string;
  postalCode: string;
  city: string;
  /** ISO-3166-1 alpha-2. */
  countryCode: string;
  email: string;
  /** E.164. */
  telephone: string;
}

export interface ShopShipping {
  /** Versandpreis je Bestellung, CHF. */
  rate: number;
  /** Was das Paketporto den Shop kostet (Anzeige «Wir teilen das Paketporto»). */
  postage: number;
  /** Bestellwert (CHF), ab dem der Versand gratis ist. */
  freeThreshold: number;
}

export interface ShopOpeningBlock {
  days: readonly string[];
  opens: string;
  closes: string;
}

export interface ShopPickup {
  enabled: boolean;
  label: string;
  address: {
    name: string;
    street: string;
    postalCode: string;
    city: string;
    countryCode: string;
  };
  /** `null` = Zeiten unbekannt («nach Vereinbarung»). */
  hours: readonly ShopOpeningBlock[] | null;
  note: string;
}

export interface ShopDelivery {
  handlingDaysMin: number;
  handlingDaysMax: number;
  transitDaysMin: number;
  transitDaysMax: number;
}

export interface ShopReturns {
  /** schema.org MerchantReturnEnumeration, z. B. "MerchantReturnNotPermitted". */
  category: string;
  warrantyYears: number;
}

export interface ShopCookies {
  /** Altersabfrage. Bestehende Werte NIE umbenennen — sonst gelten alte Antworten nicht mehr. */
  age: string;
  /** Cookie-Einwilligung. */
  consent: string;
  /** Warenkorb-ID. */
  cart: string;
}

export interface ShopFeatures {
  /** Altersabfrage vor dem Shop. Aus = nie Overlay, Altersantwort gilt als «adult». */
  ageGate: boolean;
  /** Erstbesuchs-Intro der Startseite. */
  intro: boolean;
  /** 301/410-Antworten für alte Odoo-Adressen und umbenannte Handles. */
  legacyOdooRedirects: boolean;
  /** Google Kundenrezensionen (Opt-in, Store Widget) und Bewertungszeile. */
  googleReviews: boolean;
  /** /merchant-feed.tsv. Aus = 404. */
  merchantFeed: boolean;
}

/** Design-Tokens, die überschrieben werden dürfen: CSS-Variable -> Wert. */
export type ShopThemeTokens = Readonly<Record<string, string>>;

export interface ShopTheme {
  /**
   * Browserfarbe (<meta name="theme-color">) als Voreinstellung. Fehlt sie,
   * gilt `tokens["--c-ground"]`, sonst der Wert aus app/tokens.css. Ein
   * Mandant (TenantConfig.theme.themeColor) hat Vorrang und färbt dann auch
   * `--c-ground` — siehe lib/theme.ts.
   */
  themeColor?: string;
  /** Überschreibt Variablen aus app/tokens.css; leer = Standard-Tokens. */
  tokens?: ShopThemeTokens;
}

export interface ShopGoogleProfile {
  name: string;
  /** Maps-URL des Unternehmensprofils. */
  url: string;
  /** Suchtext für scripts/google-place-id.mjs. */
  textQuery: string;
}

export interface ShopConfig {
  /** Kurzname ohne Leerzeichen; Präfix für Events, Storage-Schlüssel, Log. */
  id: string;
  brand: ShopBrand;
  priceClaim: { short: string; full: string };
  business: ShopBusiness;
  shipping: ShopShipping;
  paymentMethods: readonly { id: string; label: string }[];
  pickup: ShopPickup;
  delivery: ShopDelivery;
  returns: ShopReturns;
  /** Mindestalter laut AGB (und Altersabfrage). */
  minAge: number;
  cookies: ShopCookies;
  /** `null` = kein Unternehmensprofil. */
  googleProfile: ShopGoogleProfile | null;
  features: ShopFeatures;
  theme: ShopTheme;
}

/** Nur Typprüfung beim Schreiben der Konfiguration, kein Laufzeitverhalten. */
export function defineShopConfig<T extends ShopConfig>(config: T): T {
  return config;
}
