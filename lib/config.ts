import { SHOP } from "@/shop.config";
import { themeColorOf } from "@/lib/theme";

/**
 * Store-wide commercial + brand constants.
 *
 * DIE WERTE STEHEN IN `shop.config.ts` (Repo-Wurzel, Anleitung:
 * docs/shop-config.md). Diese Datei reicht sie unter den bisherigen Namen
 * durch und trägt die Begründungen zu den einzelnen Konstanten — so bleiben
 * alle Importe (`@/lib/config`) unverändert.
 */
export { SHOP };

export const STORE = {
  name: SHOP.brand.name,
  domain: SHOP.brand.domain,
  tagline: SHOP.brand.tagline,
  /** Zusatz im Seitentitel: «<name> — <titleSuffix>». */
  titleSuffix: SHOP.brand.titleSuffix,
  locale: SHOP.brand.locale,
  currency: SHOP.brand.currency,
} as const;

/** Schalter je Shop (shop.config.ts, `features`). */
export const FEATURES = SHOP.features;

/**
 * Discount positioning, shop-wide instead of per price. No superlatives
 * ("günstigste der Schweiz", "Tiefstpreis-Garantie") without proof — UWG
 * Art. 3 Abs. 1 lit. e.
 */
export const PRICE_CLAIM = SHOP.priceClaim;

/**
 * Versand — nur zur Anzeige, gerechnet wird im Backend. Muss mit den Optionen
 * des swiss-shipping-Providers übereinstimmen (medusa-config.ts: `price`,
 * `freeShippingThreshold`).
 */
export const SHIPPING = SHOP.shipping;

/**
 * Payment methods offered, via zahls.ch (official plugin
 * @zahls/medusa-plugin in the backend). Content-level: what the shop
 * PROMISES. No invoice purchase — zahls.ch has no Powerpay;
 * Rechnungs-/Ratenkauf would be Klarna and needs the "Pay Plus" plan.
 */
export const PAYMENT_METHODS = SHOP.paymentMethods;

/**
 * Minimum age for purchase in Switzerland (tobacco-adjacent accessories).
 */
export const MIN_AGE = SHOP.minAge;

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
export const BUSINESS = SHOP.business;

/**
 * Abholung im Laden («Abholung im Laden»): Onlinebestellungen können im
 * Ladenlokal in Winterthur gratis abgeholt werden (Entscheid des Inhabers,
 * 2026-10-05). Die Kasse bietet sie als zweite Lieferart neben dem Versand.
 *
 * Adresse = `BUSINESS` — Laden und Anbieterkennzeichnung sind dieselbe
 * Adresse. Öffnungszeiten identisch mit dem Google-Unternehmensprofil
 * («Jibbit .ch - Headshop»); ändern sie sich dort, hier mitziehen — Google
 * gleicht `openingHoursSpecification` (lib/seo/jsonld.ts) und die Seiten
 * gegen das Profil ab. Dieselben Angaben stehen für die Mails im Backend
 * (`medusa-ecom/backend/src/lib/pickup.ts`).
 *
 * Erkannt wird die Abholung in Medusa NIE am Namen, sondern an der Shipping
 * Option (`metadata.pickup`, `data.pickup`, `type.code = "pickup"`) — siehe
 * lib/checkout/pickup.ts.
 */
export const PICKUP = SHOP.pickup;

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
export const DELIVERY = SHOP.delivery;

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
export const RETURNS = SHOP.returns;

/**
 * Browser theme colour (address bar on mobile), Voreinstellung des Shops.
 *
 * Kommt aus `SHOP.theme` (`themeColor`, sonst `tokens["--c-ground"]`, sonst
 * der Standard aus app/tokens.css) — siehe lib/theme.ts. Ein Mandant
 * (TenantConfig.theme.themeColor) hat Vorrang.
 */
export const THEME_COLOR = themeColorOf(SHOP.theme);
