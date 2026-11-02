import { defineShopConfig, type ShopTheme } from "./lib/shop-config";

/**
 * SHOP-KONFIGURATION — alles, was an jibbit hängt und bei einem anderen Shop
 * anders ist. Eine Datei pro Deployment; Anleitung: docs/shop-config.md.
 *
 * Gelesen wird sie über `lib/config.ts` (STORE, SHIPPING, BUSINESS, PICKUP …),
 * nie direkt in Komponenten — so bleiben die Importe stabil.
 *
 * Kommentare zu einzelnen Werten (Rechtsgrundlage, Abgleich mit Impressum,
 * Google-Profil …) stehen in lib/config.ts bei der jeweiligen Konstante.
 */
const business = {
  legalName: "Neber Import",
  owner: "Joris Neber",
  street: "Unterwegli 1",
  postalCode: "8404",
  city: "Winterthur",
  countryCode: "CH",
  email: "info@jibbit.ch",
  telephone: "+41764140890",
} as const;

export const SHOP = defineShopConfig({
  id: "jibbit",

  brand: {
    name: "jibbit",
    domain: "jibbit.ch",
    tagline: "Der erste gemeinschaftsorientierte Online Headshop der Schweiz.",
    titleSuffix: "Online Headshop Schweiz",
    locale: "de-CH",
    currency: "CHF",
  },

  priceClaim: {
    short: "Dauertiefpreise",
    full: "Dauertiefpreise · mit Mengenrabatt noch günstiger",
  },

  business,

  shipping: { rate: 4.5, postage: 9.0, freeThreshold: 69.0 },

  paymentMethods: [
    { id: "twint", label: "TWINT" },
    { id: "card", label: "Kreditkarte (Visa/Mastercard)" },
    { id: "postfinance", label: "PostFinance" },
    { id: "apple-pay", label: "Apple Pay" },
    { id: "google-pay", label: "Google Pay" },
  ],

  pickup: {
    enabled: true,
    label: "Abholung im Laden",
    address: {
      name: "jibbit",
      street: business.street,
      postalCode: business.postalCode,
      city: business.city,
      countryCode: business.countryCode,
    },
    hours: [{ days: ["Mo", "Di", "Mi", "Do", "Fr"], opens: "09:00", closes: "17:00" }],
    note: "Wir melden uns per E-Mail, sobald deine Bestellung abholbereit ist.",
  },

  delivery: {
    handlingDaysMin: 1,
    handlingDaysMax: 3,
    transitDaysMin: 1,
    transitDaysMax: 3,
  },

  returns: { category: "MerchantReturnNotPermitted", warrantyYears: 2 },

  minAge: 18,

  // ⚠️ Diese Werte nie ändern, solange der Shop Besucher hat: bestehende
  // Antworten (Alter, Einwilligung, Warenkorb) hängen an den Namen.
  cookies: {
    age: "jibbit_alterscheck",
    consent: "jibbit_cookie_consent",
    cart: "jibbit_cart_id",
  },

  googleProfile: {
    name: "Jibbit .ch - Headshop",
    textQuery: "Jibbit Unterwegli 1 Winterthur",
    url: "https://www.google.com/maps/place/Jibbit+.ch+-+Headshop/@47.5034579,8.7507617,17z/data=!4m6!3m5!1s0x479a99b97f037e55:0xb2d9dd525e314c6c!8m2!3d47.5034579!4d8.7507617!16s%2Fg%2F11p1f3mtw4",
  },

  features: {
    ageGate: true,
    intro: true,
    legacyOdooRedirects: true,
    googleReviews: true,
    merchantFeed: true,
  },

  // Leer = Standard-Tokens aus app/tokens.css (Colorway «Kiosk»). Beispiel:
  // theme: { tokens: { "--c-accent": "#2f7d32", "--radius": "8px" } }
  theme: {} as ShopTheme,
});
