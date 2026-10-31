import { BUSINESS, FEATURES, PAYMENT_METHODS, SHIPPING, SHOP } from "./config";
import { formatPrice } from "./format";

/**
 * VERTRAUENSZEILE IM SHOP-KOPF — die eine Stelle für ihre Texte.
 *
 * Im Kopf des Katalogs (components/ShopTrust.tsx, eingebaut in app/page.tsx
 * und app/suche/page.tsx) steht die Google-Bewertung des Ladenlokals und
 * daneben drei Fakten, die Vertrauen schaffen, so wie es die grossen
 * Schweizer Shops tun. Jede Zeile ist eine ZUSAGE gegenüber der Kundin und
 * muss wahr bleiben — UWG Art. 3 Abs. 1 lit. b (keine unrichtigen oder
 * irreführenden Angaben). Deshalb steht neben jeder Zeile, woher sie
 * kommt, und lib/trust.test.ts prüft, dass die Angabe zur Quelle passt:
 *
 *  - «★★★★★ 5.0 bei Google · 26 Bewertungen»: das GOOGLE-UNTERNEHMENSPROFIL
 *    von jibbit (Ladenlokal «Jibbit .ch - Headshop», Unterwegli 1, 8404
 *    Winterthur — dieselbe Adresse wie BUSINESS), öffentlich auf Google
 *    Maps. Die ZAHLEN kommen AUSSCHLIESSLICH live von der Places API
 *    (lib/google-profil.ts, 6 h gecacht); ohne Schlüssel oder Place-ID wird
 *    OHNE Zahl gerendert («Bewertungen auf Google», Link aufs Profil), damit
 *    nie eine veraltete oder abgeschriebene Zahl steht. Das ist NICHT
 *    «Google Kundenrezensionen» aus dem Merchant Center
 *    (docs/google-kundenrezensionen.md) — dort hat jibbit noch keine
 *    Bewertung, und die darf auch nicht angedeutet werden.
 *  - «Versand aus der Schweiz»: BUSINESS.countryCode (lib/config.ts) ist
 *    "CH"; der Shop versendet ab eigenem Lager (app/service/faq, «Wie lange
 *    dauert die Lieferung?»; app/service/versand).
 *  - «Gratisversand ab CHF 69»: SHIPPING.freeThreshold — derselbe Wert wie im
 *    Promo-Streifen des Headers, im Footer, im Warenkorb (FreeShippingMeter)
 *    und im Backend-Versandprofil.
 *  - «Sichere Zahlung»: PAYMENT_METHODS; die Zahlung läuft komplett auf der
 *    gehosteten Bezahlseite von zahls.ch, die Kartendaten berühren den Shop
 *    nie (app/service/zahlungsarten, «Sicherheit»). «Sicher» meint genau
 *    das — kein Gütesiegel, kein Versprechen über Dritte hinaus.
 *
 * KEIN `aggregateRating` im JSON-LD (lib/seo/jsonld.ts): Google erlaubt es
 * nicht, Bewertungen, die Google selbst erhoben hat, als eigene
 * strukturierte Daten auszuzeichnen (Richtlinie Rezensions-Snippets). Die
 * Zahl steht sichtbar auf der Seite und verlinkt zur Quelle — das reicht.
 * trust.test.ts wacht darüber.
 *
 * Wer eine Zeile ändert, ändert zuerst die Tatsache (Konstante, Seite) und
 * dann den Text — nie umgekehrt.
 */

/**
 * Google-Unternehmensprofil «Jibbit .ch - Headshop» — nur Identität und
 * Link, KEINE Zahlen (die kommen live, siehe oben).
 */
export const GOOGLE_PROFIL = SHOP.googleProfile ?? {
  name: SHOP.brand.name,
  textQuery: `${SHOP.brand.name} ${BUSINESS.street} ${BUSINESS.city}`,
  url: "",
};

/** Bewertungszeile nur mit eingeschalteter Integration UND Unternehmensprofil. */
export const GOOGLE_PROFIL_ACTIVE: boolean =
  FEATURES.googleReviews && SHOP.googleProfile !== null;

/** Bewertung des Unternehmensprofils, wie sie gerendert wird. */
export interface GoogleProfil {
  /** Öffentliche Profil-URL (Google Maps). */
  url: string;
  /** 1.0–5.0, oder `null` = keine Zahl anzeigen. */
  rating: number | null;
  /** Anzahl Rezensionen (≥ 1), oder `null`. */
  count: number | null;
  /** ISO-Datum des Abrufs, oder `null`. */
  stand: string | null;
  /** Herkunft — Log und Tests: live, aus dem Speicher nach API-Fehler, ohne. */
  source: "places" | "letzter-wert" | "ohne";
}

/** Das Profil ohne Zahl — wenn kein Schlüssel/keine Place-ID gesetzt ist. */
export function profilOhneZahl(): GoogleProfil {
  return {
    url: GOOGLE_PROFIL.url,
    rating: null,
    count: null,
    stand: null,
    source: "ohne",
  };
}

export type TrustIcon = "truck" | "check" | "lock";

export interface TrustFact {
  /** Stabiler Schlüssel (React key, E2E-Selektor `data-trust`). */
  id: string;
  icon: TrustIcon;
  text: string;
  /** Interne Seite, die die Aussage belegt oder erklärt. */
  href: string;
}

/** Die drei Fakten neben der Bewertung, in Anzeigereihenfolge. */
export const TRUST_FACTS: readonly TrustFact[] = [
  {
    id: "schweiz",
    icon: "truck",
    text: "Versand aus der Schweiz",
    href: "/service/versand",
  },
  {
    id: "gratisversand",
    icon: "check",
    text: `Gratisversand ab ${formatPrice(SHIPPING.freeThreshold)}`,
    href: "/service/versand",
  },
  {
    id: "zahlung",
    icon: "lock",
    text: "Sichere Zahlung",
    href: "/service/zahlungsarten",
  },
];

/** «5.0» — eine Nachkommastelle, Punkt (de-CH). */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/** «26 Bewertungen» / «1 Bewertung». */
export function formatReviewCount(count: number): string {
  return `${count} ${count === 1 ? "Bewertung" : "Bewertungen"}`;
}

/** Der Google-Eintrag — Sichttext und vorlesbare Langform. */
export interface GoogleTrustItem {
  text: string;
  ariaLabel: string;
  href: string;
  /** Anzahl ganzer/anteiliger Sterne, 0–5; `null` = keine Sterne zeigen. */
  rating: number | null;
}

export function googleTrustItem(profil: GoogleProfil): GoogleTrustItem {
  if (profil.rating === null || profil.count === null) {
    return {
      text: "Bewertungen auf Google",
      ariaLabel: `Bewertungen von ${GOOGLE_PROFIL.name} auf Google Maps öffnen`,
      href: profil.url,
      rating: null,
    };
  }
  const r = formatRating(profil.rating);
  const c = formatReviewCount(profil.count);
  return {
    text: `${r} bei Google · ${c}`,
    ariaLabel: `${r} von 5 Sternen bei Google, ${c} — Unternehmensprofil auf Google Maps öffnen`,
    href: profil.url,
    rating: profil.rating,
  };
}

/**
 * Für den Test: «Sichere Zahlung» und die Zahlungsarten-Seite setzen voraus,
 * dass es die Zahlungsarten gibt — fällt die Liste leer aus, fällt der Test.
 */
export function paymentMethodsOffered(): boolean {
  return PAYMENT_METHODS.length > 0;
}

/** Für den Test: «aus der Schweiz» setzt den Firmensitz in CH voraus. */
export const SHIPS_FROM_COUNTRY: string = BUSINESS.countryCode;
