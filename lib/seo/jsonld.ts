/**
 * JSON-LD (schema.org) für den Shop — reine Funktionen, kein React, kein Netz.
 *
 * WARUM HIER UND NICHT IN DEN SEITEN
 * Die Produktseite trug das Schema bisher inline. Das war für ein `name` und
 * einen Preis in Ordnung; sobald Varianten, Staffelpreise, Versand und
 * Rückgabe dazukommen, ist es eine Seite Logik mitten in einer Seite Layout —
 * und nichts davon wäre prüfbar, ohne die Seite zu rendern. Hier sind es
 * Funktionen mit Eingabe und Ausgabe, und lib/seo/jsonld.test.ts prüft genau
 * die Aussagen, die draussen teuer sind, wenn sie falsch sind: Preise,
 * Verfügbarkeit, Rückgaberecht.
 *
 * WAS GOOGLE DARAUS MACHT
 * Das `Product`-Schema ist die Eintrittskarte für die Shopping-/Rich-Results-
 * Kacheln (Bild, Preis, Verfügbarkeit, Rückgabehinweis). Zwei Dinge, die
 * dieses Modul NICHT erfinden kann und die der Betreiber liefern muss:
 *
 *   1. GTIN/EAN je Variante. Ohne Produktkennung kann Google ein Angebot
 *      keinem identischen Artikel der Mitbewerber zuordnen — es steht dann
 *      neben statt bei ihnen. Die Nummern stehen auf jeder Box. Der Weg ist
 *      gebaut (Katalog -> Medusa-Variante -> `ProductVariantView.gtin` ->
 *      `gtinNode` unten, am `Product` der jeweiligen Packung); was fehlt,
 *      sind die Nummern selbst für den Rest des Sortiments.
 *   2. Ein echtes Logo (components/Logo.tsx ist noch ein Platzhalter).
 *      Solange keins existiert, steht hier kein `logo` — eine erkennbare
 *      Lücke ist besser als eine URL, die auf nichts zeigt.
 *
 * WELCHES FORMAT, UND WARUM
 * Recherche, Zielformen, Pflicht-/Empfehlungsfelder mit Quellen und die
 * offenen Punkte stehen in docs/seo/jsonld-format.md. Kurzfassung: mehrere
 * Packungen -> `ProductGroup` + `hasVariant` (je Packung ein `Product` mit
 * eigener GTIN, eigenem `Offer`, eigener URL); eine Packung -> blankes
 * `Product`. Kein `AggregateOffer` mehr — Google: «Don't use AggregateOffer
 * to describe a set of product variants», und Händlereinträge verlangen ein
 * `Offer`.
 *
 * EHRLICHKEIT IST HIER KEINE STILFRAGE
 * Weicht das Schema von dem ab, was an der Kasse wirklich passiert, ist das
 * kein SEO-Vorteil, sondern ein Grund für Google, den Shop abzuwerten oder
 * aus Shopping zu nehmen. Deshalb steht unten `MerchantReturnNotPermitted`
 * und nicht die 7-Tage-Frist, mit der Mitbewerber werben: jibbit gewährt
 * kein Rückgaberecht bei Sinneswandel (/service/rueckgabe), und ein Schema,
 * das eines verspricht, wäre schlicht gelogen.
 */

import {
  BUSINESS,
  DELIVERY,
  PICKUP,
  RETURNS,
  SHIPPING,
  STORE,
} from "../config";
import { openingHoursSpecification } from "../checkout/pickup";
import { gtinProperty, normalizeGtin } from "../gtin";
import { toMediaSrc } from "../media";
import { knownBrand } from "../placeholder";
import { VARIANT_PARAM, unitPriceFor } from "../pricing";
import type { ProductVariantView, ProductView } from "../types";

export type JsonLdObject = Record<string, unknown>;

/** UN/CEFACT-Code für «Stück». Steht an jeder Mengenangabe. */
const PIECE = "H87";
/** UN/CEFACT-Code für «Tag». Steht an Bearbeitungs- und Transportzeit. */
const DAY = "DAY";

const SCHEMA = "https://schema.org";

/* ─── Bausteine ──────────────────────────────────────────────────── */

/**
 * Entfernt `undefined`, `null` und leere Arrays — rekursiv, weil die
 * Bausteine unten verschachtelt sind.
 *
 * Ein Feld wegzulassen ist in JSON-LD etwas anderes, als es leer zu setzen:
 * `"brand": null` ist eine Aussage («dieses Produkt hat keine Marke») und
 * wird von Prüfwerkzeugen angestrichen, ein fehlendes Feld nicht.
 */
export function prune<T>(value: T): T {
  if (Array.isArray(value)) {
    const arr = value
      .map((v) => prune(v))
      .filter((v) => v !== undefined && v !== null);
    return arr as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: JsonLdObject = {};
    for (const [k, v] of Object.entries(value as JsonLdObject)) {
      const cleaned = prune(v);
      if (cleaned === undefined || cleaned === null) continue;
      if (Array.isArray(cleaned) && cleaned.length === 0) continue;
      out[k] = cleaned;
    }
    return out as unknown as T;
  }
  return value;
}

/**
 * Beträge gehen als Zeichenkette mit zwei Nachkommastellen raus.
 *
 * Nicht aus Formatierungsliebe: Staffelpreise werden gerechnet
 * (`40.8 / 34`), und eine Gleitkommazahl landet dann als
 * `1.2000000000000002` im Schema. Google liest das als Preis.
 */
export function money(value: number): string {
  return value.toFixed(2);
}

const availability = (inStock: boolean) =>
  inStock ? `${SCHEMA}/InStock` : `${SCHEMA}/OutOfStock`;

const quantity = (
  min: number,
  max: number | null | undefined,
  unitCode: string,
) =>
  prune({
    "@type": "QuantitativeValue",
    minValue: min,
    maxValue: max ?? undefined,
    unitCode,
  });

/** Basis-URL eines Mandanten. Überall `https` — die Storefront läuft nur so. */
const origin = (domain: string) => `https://${domain}`;

export const organizationId = (domain: string) =>
  `${origin(domain)}/#organization`;
export const websiteId = (domain: string) => `${origin(domain)}/#website`;
export const returnPolicyId = (domain: string) =>
  `${origin(domain)}/#returnpolicy`;
export const shippingServiceId = (domain: string) =>
  `${origin(domain)}/#shipping`;
export const productUrl = (domain: string, handle: string) =>
  `${origin(domain)}/products/${handle}`;
/**
 * Die URL, die eine Variante VORAUSWÄHLT — `…/products/<handle>?variant=<id>`.
 *
 * Google (Produktvarianten, «single-page»): jede Variante braucht eine eigene
 * URL über Query-Parameter, die Seite dahinter zeigt Bild, Preis und
 * Verfügbarkeit genau dieser Variante. Kanonisch bleibt die Adresse OHNE
 * Parameter — die gehört der `ProductGroup`.
 */
export const variantUrl = (domain: string, handle: string, variantId: string) =>
  `${productUrl(domain, handle)}?${VARIANT_PARAM}=${encodeURIComponent(variantId)}`;

/**
 * Die Rückgaberegel — eine einzige für den ganzen Shop, deshalb mit `@id`
 * versehen und überall referenziert statt kopiert.
 *
 * `MerchantReturnNotPermitted` bezieht sich auf die freiwillige Rückgabe.
 * Die gesetzliche Sachgewährleistung (zwei Jahre, Art. 197 ff. OR) besteht
 * davon unberührt; schema.org kennt dafür kein Feld, und sie als
 * Rückgabefenster auszugeben wäre falsch — sie deckt Mängel, nicht
 * Sinneswandel.
 */
export function returnPolicyJsonLd(domain: string): JsonLdObject {
  return {
    "@type": "MerchantReturnPolicy",
    "@id": returnPolicyId(domain),
    name: "Rückgaberecht & Reklamation",
    applicableCountry: BUSINESS.countryCode,
    returnPolicyCountry: BUSINESS.countryCode,
    returnPolicyCategory: `${SCHEMA}/${RETURNS.category}`,
    merchantReturnLink: `${origin(domain)}/service/rueckgabe`,
  };
}

/** Montag bis Freitag — an diesen Tagen wird gepackt und zugestellt. */
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(
  (d) => `${SCHEMA}/${d}`,
);

/**
 * Versandangaben je Angebot: der eine Versandpreis, oder 0, wenn die Packung
 * allein schon den Gratisversand-Betrag erreicht. Die Schwelle für den ganzen
 * Warenkorb steht auf Organisationsebene (`shippingServiceJsonLd`).
 *
 * Google liest auf Angebotsebene nur `shippingRate`, `shippingDestination`
 * und `deliveryTime`; das Angebot schlägt die Organisationsebene.
 */
export function shippingDetailsJsonLd(
  currency: string,
  unitPrice = 0,
): JsonLdObject {
  const rate = {
    value: money(unitPrice >= SHIPPING.freeThreshold ? 0 : SHIPPING.rate),
  };

  return {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", ...rate, currency },
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: BUSINESS.countryCode,
    },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: quantity(
        DELIVERY.handlingDaysMin,
        DELIVERY.handlingDaysMax,
        DAY,
      ),
      transitTime: quantity(
        DELIVERY.transitDaysMin,
        DELIVERY.transitDaysMax,
        DAY,
      ),
      // «Tage» heisst Werktage. Google führt das Feld auf Angebotsebene nicht
      // mehr (nur noch am `ShippingService`), schema.org kennt es weiterhin.
      businessDays: {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: WEEKDAYS,
      },
    },
  };
}

/**
 * Die Versandregel des ganzen Shops, auf Organisationsebene.
 *
 * Google empfiehlt seit 2025, die allgemeine Versandregel als
 * `ShippingService` unter `Organization.hasShippingService` zu führen und
 * `Offer.shippingDetails` nur für Abweichungen zu nutzen. Hier steht, was
 * sich am einzelnen Angebot NICHT sagen lässt: die Schwelle für den
 * Gratisversand (`orderValue`). Treffen mehrere Bedingungen zu, nimmt Google
 * die günstigste; deshalb überlappen die beiden Fenster nicht.
 *
 * Rangfolge bei Google (stark -> schwach): Merchant-Center-Feed, Content API,
 * Einstellungen in Merchant Center/Search Console, Markup am Angebot, Markup
 * an der Organisation. Dieser Knoten ist also die schwächste Quelle — und
 * die einzige, die ohne Merchant Center überhaupt existiert.
 */
export function shippingServiceJsonLd(
  domain: string,
  currency: string = STORE.currency,
): JsonLdObject {
  const destination = {
    "@type": "DefinedRegion",
    addressCountry: BUSINESS.countryCode,
  };
  const transitTime = {
    "@type": "ServicePeriod",
    duration: quantity(DELIVERY.transitDaysMin, DELIVERY.transitDaysMax, DAY),
    businessDays: WEEKDAYS,
  };
  // Beträge sind auf 5 Rappen gerundet; «unter 69.00» endet bei 68.99.
  const belowThreshold = SHIPPING.freeThreshold - 0.01;

  return {
    "@type": "ShippingService",
    "@id": shippingServiceId(domain),
    name: "Versand Schweiz",
    description:
      `CHF ${money(SHIPPING.rate)}, gratis ab CHF ${money(SHIPPING.freeThreshold)} Bestellwert. Versand nur in die Schweiz.`,
    fulfillmentType: `${SCHEMA}/FulfillmentTypeDelivery`,
    handlingTime: {
      "@type": "ServicePeriod",
      duration: quantity(
        DELIVERY.handlingDaysMin,
        DELIVERY.handlingDaysMax,
        DAY,
      ),
      businessDays: WEEKDAYS,
    },
    shippingConditions: [
      {
        "@type": "ShippingConditions",
        shippingDestination: destination,
        orderValue: {
          "@type": "MonetaryAmount",
          minValue: money(0),
          maxValue: money(belowThreshold),
          currency,
        },
        shippingRate: {
          "@type": "MonetaryAmount",
          value: money(SHIPPING.rate),
          currency,
        },
        transitTime,
      },
      {
        "@type": "ShippingConditions",
        shippingDestination: destination,
        orderValue: {
          "@type": "MonetaryAmount",
          minValue: money(SHIPPING.freeThreshold),
          currency,
        },
        shippingRate: { "@type": "MonetaryAmount", value: money(0), currency },
        transitTime,
      },
    ],
  };
}

/* ─── Organisation & Website ─────────────────────────────────────── */

export interface SiteIdentity {
  /** Öffentliche Domain des Mandanten (TenantTheme.domain). */
  domain: string;
  /** Anzeigename des Shops (TenantTheme.storeName). */
  storeName: string;
}

/**
 * Der Betrieb hinter dem Shop.
 *
 * MULTI-TENANT: Name und Domain kommen vom aufgelösten Mandanten, die
 * ANBIETERKENNZEICHNUNG (Firma, Adresse, Telefon, E-Mail, Rückgaberegel)
 * aber nur auf jibbits eigener Domain. Das Layout teilt sich zwar die
 * Marketing-Zeile über alle Mandanten (dokumentierter Kompromiss in
 * app/layout.tsx); eine fremde Storefront mit jibbits Adresse und
 * Telefonnummer auszuzeichnen, ist jedoch etwas anderes als ein geteilter
 * Slogan: sie benennt maschinenlesbar den falschen Verkäufer.
 *
 * LADEN: jibbit hat ein Ladenlokal (Abholung im Laden, `PICKUP`). Auf der
 * eigenen Domain ist die Organisation deshalb zusätzlich ein `Store`
 * (LocalBusiness) mit `openingHoursSpecification` — dieselben Zeiten wie im
 * Google-Unternehmensprofil, sonst widerspricht sich der Betrieb selbst.
 * Ohne bekannte Zeiten (`PICKUP.hours === null`) bleibt der `Store`-Typ weg:
 * ein LocalBusiness ohne Öffnungszeiten ist für Google ein halber Eintrag.
 */
export function organizationJsonLd({
  domain,
  storeName,
}: SiteIdentity): JsonLdObject {
  const base = origin(domain);
  const own = domain === STORE.domain;
  const hours = own && PICKUP.enabled ? openingHoursSpecification(PICKUP.hours) : undefined;

  return prune({
    "@type": hours ? ["Organization", "OnlineStore", "Store"] : ["Organization", "OnlineStore"],
    "@id": organizationId(domain),
    name: storeName,
    url: base,
    description: STORE.tagline,
    areaServed: { "@type": "Country", name: BUSINESS.countryCode },
    // Kein `currenciesAccepted`/`paymentAccepted`: Zahlarten stehen auf
    // /service/zahlungsarten und gehören nicht ins Schema, solange sie nicht
    // als Enum sauber abbildbar sind (TWINT ist keins).
    // `logo` fehlt absichtlich — es gibt noch keine Logodatei, nur den
    // Platzhalter in components/Logo.tsx. Sobald sie unter public/ liegt:
    // logo: `${base}/logo.png` (Google will mindestens 112 × 112 px).
    openingHoursSpecification: hours,
    legalName: own ? BUSINESS.legalName : undefined,
    founder: own ? { "@type": "Person", name: BUSINESS.owner } : undefined,
    email: own ? BUSINESS.email : undefined,
    telephone: own ? BUSINESS.telephone : undefined,
    address: own
      ? {
          "@type": "PostalAddress",
          streetAddress: BUSINESS.street,
          postalCode: BUSINESS.postalCode,
          addressLocality: BUSINESS.city,
          addressCountry: BUSINESS.countryCode,
        }
      : undefined,
    // Beide Regeln hängen an der Organisation — dort will Google die
    // «globale» Fassung haben; die Angebote verweisen per `@id` (Rückgabe)
    // bzw. tragen den genaueren Satz je Packung (Versand). Bei Google schlägt
    // das Angebot die Organisation, Merchant Center/Search Console beide.
    hasMerchantReturnPolicy: own ? returnPolicyJsonLd(domain) : undefined,
    hasShippingService: own ? shippingServiceJsonLd(domain) : undefined,
  });
}

/**
 * Die Website selbst.
 *
 * Die `SearchAction` beschreibt /suche. Google hat die Sitelinks-Suchbox
 * 2024 eingestellt, wertlos ist das Markup damit aber nicht: es ist die
 * einzige maschinenlesbare Auskunft darüber, wie man diesen Katalog abfragt
 * — und genau das lesen inzwischen die Einkaufsassistenten.
 */
export function webSiteJsonLd({
  domain,
  storeName,
}: SiteIdentity): JsonLdObject {
  const base = origin(domain);
  return {
    "@type": "WebSite",
    "@id": websiteId(domain),
    url: base,
    name: storeName,
    inLanguage: STORE.locale,
    publisher: { "@id": organizationId(domain) },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${base}/suche?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/* ─── Produkt ────────────────────────────────────────────────────── */

export interface ProductJsonLdOptions {
  product: ProductView;
  /** Öffentliche Domain des Mandanten (TenantTheme.domain). */
  domain: string;
  /** Normalisierter Host des Mandanten — für die Bildproxy-Pfade. */
  host: string;
  /** Anzeigename der Kategorie, wenn bekannt. */
  categoryName?: string;
  /** Nur für `priceValidUntil`. Injizierbar, damit Tests nicht altern. */
  now?: Date;
}

/**
 * Bis wann der Preis gilt.
 *
 * Google mag das Feld an Angeboten; ein Datum in der Vergangenheit lässt ein
 * Angebot als veraltet gelten. Ein Jahr ist die übliche und hier ehrliche
 * Angabe: die Preise hängen an Mengenstaffeln, nicht an einem Enddatum —
 * die Zusage lautet «mindestens so lange», nicht «nur bis dahin».
 */
export function priceValidUntil(now: Date): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()),
  );
  return d.toISOString().slice(0, 10);
}

/**
 * Bild-URLs, absolut und über die eigene Domain.
 *
 * Die URL aus Medusa zeigt auf die Backend-Adresse des Mandanten, die von
 * aussen meist gar nicht erreichbar ist (im Compose `http://medusa:9000`).
 * Ein Crawler, der ihr folgt, bekommt nichts. Siehe lib/media.ts.
 *
 * Exportiert, weil der Merchant-Center-Feed (lib/seo/merchant-feed.ts)
 * dieselben Adressen führen muss: Google gleicht `image_link` im Feed mit
 * dem `image` der Landingpage ab.
 */
export function absoluteImages(
  urls: string[],
  domain: string,
  host: string,
): string[] {
  return urls
    .map((url) => toMediaSrc(url, host).src)
    .map((src) => (src.startsWith("/") ? `${origin(domain)}${src}` : src));
}

/**
 * Die Bilder EINER Packung, noch relativ (Backend-URLs).
 *
 * Hat die Packung ein eigenes (Display -> die Box), steht NUR das da; das
 * Bild des Einzelstücks am Display wäre das falsche Produktfoto. Ohne
 * eigenes Bild: die Produktbilder — aber nicht die, die einer ANDEREN
 * Packung gehören. Bleibt nichts übrig, dann lieber alle als keines
 * (`image` ist für Händlereinträge Pflicht).
 *
 * Eine Funktion für JSON-LD und Feed, damit beide dasselbe Bild nennen.
 */
export function imagesForVariant(
  product: ProductView,
  variant: ProductVariantView,
): string[] {
  const foreign = new Set(
    product.variants.filter((v) => v.id !== variant.id).map((v) => v.image),
  );
  const neutral = product.images.filter((src) => !foreign.has(src));
  return variant.image
    ? [variant.image]
    : neutral.length
      ? neutral
      : product.images;
}

/** Was jeder Knoten einer Produktseite wissen muss. */
interface ProductContext {
  product: ProductView;
  /** Kanonische Adresse der Seite — ohne Variantenparameter. */
  url: string;
  currency: string;
  domain: string;
  host: string;
  validUntil: string;
}

/**
 * Mengenrabatte als `UnitPriceSpecification` mit `eligibleQuantity`.
 *
 * Das ist der Teil, den kein Standard-Shop-Schema mitbringt und der bei
 * jibbit das halbe Sortiment erklärt: ein Angebot hat nicht EINEN Preis,
 * sondern einen pro Menge. schema.org sieht dafür genau diese Form vor
 * (`eligibleQuantity` an der `PriceSpecification`: «ordering quantities for
 * which the … price specification is valid»; `maxValue` fehlt in der
 * obersten Stufe — die ist nach oben offen).
 *
 * WAS GOOGLE DAMIT MACHT: nichts, und das ist Absicht. Google kennt genau
 * drei Preise — aktiv, durchgestrichen, Mitgliederpreis — und liest den
 * aktiven aus `Offer.price`; stehen `price` UND `priceSpecification` da,
 * gewinnt `price` («…and ignore the offers.priceSpecification property»).
 * Damit das auch dann stimmt, wenn ein Leser es anders hält:
 *
 *   - Die ERSTE Stufe (ab 1 Stück) steht NICHT hier, sondern nur an
 *     `Offer.price`. Es gibt also keinen zweiten «aktiven» Preis ohne
 *     Mengenbedingung, der dem ersten widersprechen könnte.
 *   - Jede Stufe hier trägt `eligibleQuantity.minValue >= 2`.
 *   - Kein `referenceQuantity`: Google liest das Feld als Grundpreisangabe
 *     (ml, g, m … mit `valueReference`) und kennt «Stück» (H87) dort nicht.
 *     «Pro Stück» sagt stattdessen `unitCode` an der Preisangabe selbst.
 *
 * `valueAddedTaxIncluded: true` heisst hier: es kommt nichts mehr dazu. Der
 * Betrieb ist nicht mehrwertsteuerpflichtig (siehe /impressum), der
 * angezeigte Betrag ist der Endbetrag.
 */
function tierSpecs(
  variant: ProductVariantView,
  currency: string,
): JsonLdObject[] {
  return variant.tiers
    .filter((t) => t.minQuantity > 1)
    .map((t) =>
      prune({
        "@type": "UnitPriceSpecification",
        price: money(t.price),
        priceCurrency: currency,
        valueAddedTaxIncluded: true,
        unitCode: PIECE,
        eligibleQuantity: quantity(t.minQuantity, t.maxQuantity, PIECE),
      }),
    );
}

/**
 * Der durchgestrichene «statt»-Preis, falls es einen gibt.
 *
 * `StrikethroughPrice` ist der einzige `priceType`, den Google liest
 * (`ListPrice` nur noch «for a transition period»). Der aktive Preis trägt
 * KEINEN `priceType` — er steht an `Offer.price`.
 */
function strikethroughSpec(
  variant: ProductVariantView,
  currency: string,
): JsonLdObject | undefined {
  if (!variant.compareAt || variant.compareAt <= variant.price) return undefined;
  return {
    "@type": "UnitPriceSpecification",
    priceType: `${SCHEMA}/StrikethroughPrice`,
    price: money(variant.compareAt),
    priceCurrency: currency,
  };
}

/**
 * `{ gtin13: "…" }` — die zur Länge passende, genaueste Eigenschaft, wie
 * Google sie empfiehlt («use the most specific GTIN»). Ungültig oder nicht
 * gepflegt -> `{}`: lieber keine Kennung als eine, die auf einen fremden
 * Artikel zeigt. Der Adapter prüft bereits; hier noch einmal, weil ein
 * ProductView auch anderswo entstehen kann (Mock-Katalog, Tests) und diese
 * Zeile die letzte vor Google ist.
 *
 * Die Nummer steht IMMER am `Product` der Packung, nie am `Offer`: Googles
 * Händlereintrags-Doku führt `gtin*` nur unter `Product`. Genau deshalb ist
 * jede Packung jetzt ein eigenes `Product` — Einzelstück und Display sind
 * zwei Handelsartikel mit zwei Nummern.
 */
function gtinNode(raw: string | undefined): JsonLdObject {
  const gtin = normalizeGtin(raw);
  return gtin ? { [gtinProperty(gtin)]: gtin } : {};
}

/**
 * Die Kennung EINER Packung — `sku` im JSON-LD und `id` im Merchant-Feed.
 *
 * Beide MÜSSEN derselbe Wert sein: stehen mehrere Angebote auf einer Seite
 * (Einzeln + Display), ordnet Google die Feed-Zeile dem Angebot über genau
 * diese Kennung zu («each offer present on the page is annotated with a SKU
 * or a GTIN and the respective offer in your product data … has the same
 * SKU or GTIN»). Vorher trug das Schema die Medusa-ID und der Feed die
 * Artikelnummer — zwei Kennungen für denselben Artikel.
 *
 * Die Artikelnummer aus Medusa, wenn gepflegt (stabil über Umbenennungen,
 * sprechend); sonst die Varianten-ID. Leerraum fällt weg: Google verlangt
 * die Kennung ohne.
 */
export function offerId(variant: Pick<ProductVariantView, "id" | "sku">): string {
  return (variant.sku ?? "").replace(/\s+/g, "") || variant.id;
}

/**
 * Die Marke eines Produkts — für JSON-LD und Feed dieselbe.
 *
 * `metadata.brand` aus dem Admin gewinnt. Ist es leer (Stand 2026-09-29: bei
 * allen Produkten), greift die Herstellerliste aus lib/placeholder.ts — aber
 * nur, wenn der Titel mit einem Hersteller daraus BEGINNT. Kein Raten aus dem
 * ersten Wort: «Silikon Dose» hat keine Marke und bekommt keine. Google:
 * «When in doubt don't provide a brand».
 */
export function brandOf(product: Pick<ProductView, "brand" | "title">): string {
  return product.brand.trim() || knownBrand(product.title) || "";
}

const variantNodeId = (ctx: ProductContext, variant: ProductVariantView) =>
  `${ctx.url}#variant-${variant.id}`;

/**
 * Das Angebot EINER Packung.
 *
 * `price` ist der Preis für ein Stück dieser Packung — dieselbe Zahl, die
 * die Seite beim Öffnen von `url` zeigt. Das ist die Zahl, die Google liest
 * und gegen die Seite abgleicht; die Rabattstufen darunter sagen, was bei
 * mehr gilt, ohne ihr zu widersprechen (siehe `tierSpecs`).
 */
function offerFor(
  variant: ProductVariantView,
  ctx: ProductContext,
  url: string,
): JsonLdObject {
  const unit = unitPriceFor(variant.tiers, 1, variant.price);
  // Was im Display steckt: das Einzelstück DIESES Produkts, wenn es eines
  // gibt — sonst nur der Name. Nie ein Verweis auf sich selbst.
  const single = ctx.product.variants.find(
    (v) => v.unitsPerPack === 1 && v.id !== variant.id,
  );

  return prune({
    "@type": "Offer",
    "@id": `${ctx.url}#offer-${variant.id}`,
    url,
    price: money(unit),
    priceCurrency: ctx.currency,
    priceValidUntil: ctx.validUntil,
    availability: availability(variant.inStock),
    itemCondition: `${SCHEMA}/NewCondition`,
    seller: { "@id": organizationId(ctx.domain) },
    priceSpecification: [
      ...tierSpecs(variant, ctx.currency),
      strikethroughSpec(variant, ctx.currency),
    ],
    // Ein Display ist EIN Angebot über 34 Stück, nicht ein Angebot über ein
    // Stück zum 34-fachen Preis. Google liest das nicht (Herstellergebinde
    // erkennt es an der eigenen GTIN), andere Leser schon.
    includesObject:
      variant.unitsPerPack > 1
        ? {
            "@type": "TypeAndQuantityNode",
            amountOfThisGood: variant.unitsPerPack,
            unitCode: PIECE,
            typeOfGood: single
              ? { "@id": variantNodeId(ctx, single) }
              : { "@type": "Product", name: ctx.product.title },
          }
        : undefined,
    shippingDetails: shippingDetailsJsonLd(ctx.currency, unit),
    // Paketversand UND Abholung im Laden. Google liest das Feld nicht
    // (Händlereinträge kennen nur `shippingDetails`), schema.org kennt es als
    // `DeliveryMethod`-Aufzählung — und es ist die einzige maschinenlesbare
    // Stelle, die sagt, dass man hier auch abholen kann. Die Versanddetails
    // bleiben unverändert: Google hat kein Markup für Abholung.
    availableDeliveryMethod: deliveryMethods(ctx.domain),
    // Nur der Verweis — die Regel selbst hängt an der Organisation. Genau
    // diese Form («using only the @id keyword») beschreibt Google.
    hasMerchantReturnPolicy: { "@id": returnPolicyId(ctx.domain) },
  });
}

/** schema.org `DeliveryMethod`: Post immer; Abholung nur auf jibbits Domain. */
export function deliveryMethods(domain: string): string[] {
  const methods = [`${SCHEMA}/ParcelService`];
  if (domain === STORE.domain && PICKUP.enabled) methods.push(`${SCHEMA}/OnSitePickup`);
  return methods;
}

/** Marke, Kategorie, Altershinweis — was für ALLE Packungen gleich ist. */
function sharedProperties(
  ctx: ProductContext,
  categoryName: string | undefined,
): JsonLdObject {
  const { product } = ctx;
  return {
    brand: brandOf(product)
      ? { "@type": "Brand", name: brandOf(product) }
      : undefined,
    category: categoryName,
    // 18+. Bewusst NICHT `TobaccoNicotineConsideration`: jibbit führt weder
    // Tabak noch Nikotin (siehe /impressum) — die Altersgrenze gilt trotzdem.
    // Google wertet an diesem Feld nur `SexualContentConsideration` aus und
    // übergeht den Rest; der Wert steht hier für alle anderen Leser.
    hasAdultConsideration: `${SCHEMA}/ReducedRelevanceForChildrenConsideration`,
    additionalProperty: product.subtitle
      ? {
          "@type": "PropertyValue",
          name: "Ausführung",
          value: product.subtitle,
        }
      : undefined,
  };
}

/**
 * EINE Packung als `Product` innerhalb der Gruppe.
 *
 * Google verlangt je Variante eine eindeutige Kennung (`sku` oder `gtin`),
 * einen Namen, der GENAUER ist als der der Gruppe, und eine eigene URL.
 * `size` trägt die Packungseinheit («Einzeln», «Display (34 Stk.)») — siehe
 * `productJsonLd` zur Wahl von `variesBy`.
 *
 * Bild: hat die Packung ein eigenes (Display -> die Box), steht NUR das da;
 * das Bild des Einzelstücks am Display wäre das falsche Produktfoto.
 */
function variantNode(
  variant: ProductVariantView,
  ctx: ProductContext,
): JsonLdObject {
  const { product } = ctx;
  const base = product.description || product.subtitle;
  const images = imagesForVariant(product, variant);
  return prune({
    "@type": "Product",
    "@id": variantNodeId(ctx, variant),
    name: `${product.title} – ${variant.title}`,
    description: base ? `${variant.title}: ${base}` : undefined,
    sku: offerId(variant),
    ...gtinNode(variant.gtin),
    // Dieselbe Gruppe wie `productGroupID` oben und `item_group_id` im Feed.
    inProductGroupWithID: product.handle,
    image: absoluteImages(images, ctx.domain, ctx.host),
    size: variant.title,
    offers: offerFor(
      variant,
      ctx,
      variantUrl(ctx.domain, product.handle, variant.id),
    ),
  });
}

/**
 * Die strukturierten Daten einer Produktseite.
 *
 * ZWEI FORMEN, je nach Sortiment:
 *
 *   - Mehrere Packungen («Einzeln» + «Display (34 Stk.)») -> `ProductGroup`
 *     mit `hasVariant`: je Packung ein `Product` mit eigener `sku`, eigener
 *     GTIN, eigenem Bild und eigenem `Offer`, dessen `url` die Packung
 *     vorauswählt (`?variant=<id>`). Das ist Googles «single-page»-Modell:
 *     EINE kanonische Seite (`ProductGroup.url`, ohne Parameter), Varianten
 *     über Query-Parameter. Gemeinsames (Marke, Beschreibung, Kategorie)
 *     steht einmal an der Gruppe.
 *   - Genau eine Packung -> blankes `Product` mit GTIN und einem `Offer`.
 *
 * `variesBy` = `size`. Google liest dort eine GESCHLOSSENE Liste (color,
 * size, suggestedAge, suggestedGender, material, pattern); die
 * Verpackungseinheit ist davon einzig als Grösse sinnvoll lesbar — so führt
 * sie auch Merchant Center bei Nicht-Bekleidung («sizes … often aren't
 * standardized … still submit each variant … same item group ID»).
 *
 * `productGroupID` = Handle: stabil, ohne Leerzeichen, und derselbe Wert,
 * den ein späterer Merchant-Center-Feed als `item_group_id` führen muss.
 *
 * Kein `AggregateOffer`: Google — «Don't use AggregateOffer to describe a
 * set of product variants», und Händlereinträge verlangen ein `Offer`.
 * Kein `aggregateRating` und keine `review`: es gibt noch keine Bewertungen.
 * Erfundene Sterne sind der kürzeste Weg zu einer manuellen Massnahme.
 */
export function productJsonLd({
  product,
  domain,
  host,
  categoryName,
  now = new Date(),
}: ProductJsonLdOptions): JsonLdObject {
  const url = productUrl(domain, product.handle);
  const ctx: ProductContext = {
    product,
    url,
    currency: product.currency || STORE.currency,
    domain,
    host,
    validUntil: priceValidUntil(now),
  };

  const common = {
    "@id": `${url}#product`,
    name: product.title,
    description: product.description || product.subtitle || undefined,
    url,
    image: absoluteImages(product.images, domain, host),
    ...sharedProperties(ctx, categoryName),
  };

  if (product.variants.length > 1) {
    return prune({
      "@type": "ProductGroup",
      ...common,
      productGroupID: product.handle,
      variesBy: [`${SCHEMA}/size`],
      hasVariant: product.variants.map((v) => variantNode(v, ctx)),
    });
  }

  // Eine Packung (oder — im Mock-Katalog denkbar — gar keine): Produkt und
  // Packung sind dasselbe, Kennungen und Angebot gehören direkt ans Produkt.
  // Die kanonische Adresse IST hier die Adresse des Angebots.
  const [only] = product.variants;
  return prune({
    "@type": "Product",
    ...common,
    sku: only ? offerId(only) : product.handle,
    ...gtinNode(only?.gtin),
    offers: only ? offerFor(only, ctx, url) : undefined,
  });
}

/* ─── Navigation & Listen ────────────────────────────────────────── */

export interface Crumb {
  name: string;
  /** Absolut. Der letzte Eintrag (die aktuelle Seite) darf ihn weglassen. */
  url?: string;
}

export function breadcrumbJsonLd(items: Crumb[]): JsonLdObject {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) =>
      prune({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: c.url,
      }),
    ),
  };
}

/**
 * Die Katalogansicht als Liste.
 *
 * Sagt einem Crawler, dass die Startseite eine Auswahl von Produkten ZEIGT,
 * statt selbst ein Produkt zu sein — und in welcher Reihenfolge. Die
 * Einträge verweisen nur; die Produktdaten stehen auf den Produktseiten und
 * werden hier nicht ein zweites Mal gepflegt.
 */
export function itemListJsonLd({
  products,
  domain,
  name,
}: {
  products: ProductView[];
  domain: string;
  name: string;
}): JsonLdObject {
  return {
    "@type": "ItemList",
    name,
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.title,
      url: productUrl(domain, p.handle),
    })),
  };
}

/* ─── Ausgabe ────────────────────────────────────────────────────── */

/** Mehrere Knoten einer Seite in EINEM Block — `@id` verbindet sie. */
export function graph(...nodes: (JsonLdObject | undefined)[]): JsonLdObject {
  return {
    "@context": SCHEMA,
    "@graph": nodes.filter((n): n is JsonLdObject => Boolean(n)),
  };
}

/**
 * JSON für ein `<script type="application/ld+json">`.
 *
 * `<` wird escaped, und das ist kein Zierrat: in den Daten stehen frei
 * gepflegte Produkttexte aus dem Admin. Enthält einer die Zeichenfolge
 * `</script>`, beendet der Browser das Skript-Element mitten im JSON — der
 * Rest landet als HTML im Dokument. Das ist die Standardform von XSS über
 * JSON-LD, und Nexts eigene Anleitung schreibt genau diesen Ersatz vor.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
