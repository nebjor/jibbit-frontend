import { BUSINESS, PAYMENT_METHODS, SHIPPING } from "./config";
import { formatPrice } from "./format";

/**
 * VERTRAUENSLEISTE — die eine Stelle für ihre Texte.
 *
 * Die Leiste ganz oben im Shop (components/TrustBar.tsx) nennt vier Fakten,
 * die Vertrauen schaffen, so wie es die grossen Schweizer Shops tun. Jede
 * Zeile hier ist eine ZUSAGE gegenüber der Kundin und muss wahr bleiben —
 * UWG Art. 3 Abs. 1 lit. b (keine unrichtigen oder irreführenden Angaben).
 * Deshalb steht neben jeder Zeile, woher sie kommt, und lib/trust.test.ts
 * prüft, dass die Angabe zur Quelle passt:
 *
 *  - «5.0 bei Google · 26 Bewertungen»: das GOOGLE-UNTERNEHMENSPROFIL von
 *    jibbit (Ladenlokal «Jibbit .ch - Headshop», Unterwegli 1, 8404
 *    Winterthur — dieselbe Adresse wie BUSINESS), öffentlich auf Google
 *    Maps. Zahlen aus GOOGLE_PROFIL unten (von Hand nachgeführt) oder live
 *    über die Places API (lib/google-profil.ts), wenn ein Schlüssel gesetzt
 *    ist. Das ist NICHT «Google Kundenrezensionen» aus dem Merchant Center
 *    (docs/google-kundenrezensionen.md) — dort hat jibbit noch keine
 *    Bewertung, und die darf auch nicht angedeutet werden. Die Zeile
 *    verlinkt direkt auf das Profil, damit jede Kundin die Zahl prüfen kann.
 *  - «Versand aus der Schweiz»: BUSINESS.countryCode (lib/config.ts) ist
 *    "CH"; der Shop versendet ab eigenem Lager (app/service/faq, «Wie lange
 *    dauert die Lieferung?»; app/service/versand).
 *  - «Gratisversand ab CHF 69»: SHIPPING.freeThreshold — derselbe Wert wie im
 *    Footer, im Warenkorb (FreeShippingMeter) und im Backend-Versandprofil.
 *  - «Sichere Zahlung: TWINT, Karte, PostFinance»: PAYMENT_METHODS; die
 *    Zahlung läuft komplett auf der gehosteten Bezahlseite von zahls.ch, die
 *    Kartendaten berühren den Shop nie (app/service/zahlungsarten,
 *    «Sicherheit»). «Sicher» meint genau das — kein Gütesiegel, kein
 *    Versprechen über Dritte hinaus.
 *
 * KEIN `aggregateRating` im JSON-LD (lib/seo/jsonld.ts): Google erlaubt es
 * nicht, Bewertungen, die Google selbst erhoben hat, als eigene
 * strukturierte Daten auszuzeichnen (Richtlinie Rezensions-Snippets:
 * «self-serving reviews» / Google-eigene Daten). Die Zahl steht sichtbar auf
 * der Seite und verlinkt zur Quelle — das reicht. trust.test.ts wacht darüber.
 *
 * Wer eine Zeile ändert, ändert zuerst die Tatsache (Konstante, Seite) und
 * dann den Text — nie umgekehrt.
 */

/**
 * Google-Unternehmensprofil «Jibbit .ch - Headshop», Stand laut Google Maps.
 *
 * ⚠️ VON HAND NACHGEFÜHRT, bis die Places-API-Anbindung (lib/google-profil.ts,
 * Umgebungsvariablen GOOGLE_PLACES_API_KEY + GOOGLE_PLACE_ID) in Betrieb ist.
 * Bis dahin: alle paar Wochen auf Google Maps nachsehen, `rating`, `count`
 * und `stand` anpassen. Eine veraltete Zahl ist nicht falsch, solange sie
 * nicht höher ist als die echte — nach unten korrigiert Google von selbst
 * nicht, also im Zweifel die Zahl nicht «aufrunden».
 */
export const GOOGLE_PROFIL = {
  rating: 5.0,
  count: 26,
  stand: "2026-10-05",
  url: "https://www.google.com/maps/place/Jibbit+.ch+-+Headshop/@47.5034579,8.7507617,17z/data=!4m6!3m5!1s0x479a99b97f037e55:0xb2d9dd525e314c6c!8m2!3d47.5034579!4d8.7507617!16s%2Fg%2F11p1f3mtw4",
} as const;

/** Eine Bewertung aus dem Unternehmensprofil — Konstante oder Places API. */
export interface GoogleProfilRating {
  /** 1.0–5.0 */
  rating: number;
  /** Anzahl Rezensionen, ≥ 1. */
  count: number;
  /** ISO-Datum (YYYY-MM-DD), auf das sich die Zahlen beziehen. */
  stand: string;
  /** Öffentliche Profil-URL (Google Maps). */
  url: string;
  /** Woher die Zahlen stammen — nur für Log und Tests. */
  source: "konstante" | "places";
}

export type TrustIcon = "star" | "truck" | "check" | "lock";

export interface TrustItem {
  /** Stabiler Schlüssel (React key, E2E-Selektor `data-trust`). */
  id: string;
  icon: TrustIcon;
  text: string;
  /** Seite, die die Aussage belegt oder erklärt. */
  href: string;
  /** Externe Quelle (öffnet in neuem Tab, rel="noopener"). */
  external?: boolean;
  /** Vorlesbare Langform, wenn der Sichttext allein nicht reicht. */
  ariaLabel?: string;
}

/** Kurzformen der Zahlungsarten, wie sie in die Leiste passen. */
const PAYMENT_SHORT = ["TWINT", "Karte", "PostFinance"] as const;

/** «5.0» — eine Nachkommastelle, Punkt (de-CH). */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/** «26 Bewertungen» / «1 Bewertung». */
export function formatReviewCount(count: number): string {
  return `${count} ${count === 1 ? "Bewertung" : "Bewertungen"}`;
}

/**
 * Die Einträge der Leiste, in Anzeigereihenfolge. Das Google-Profil steht
 * ZUERST: mobil sind nur die ersten zwei Einträge ohne Wischen zu sehen,
 * und die geprüfte Bewertung ist das stärkste Signal.
 */
export function trustItems(profil: GoogleProfilRating): readonly TrustItem[] {
  return [
    {
      id: "google",
      icon: "star",
      text: `${formatRating(profil.rating)} bei Google · ${formatReviewCount(profil.count)}`,
      href: profil.url,
      external: true,
      ariaLabel: `${formatRating(profil.rating)} von 5 Sternen bei Google, ${formatReviewCount(profil.count)} — Unternehmensprofil auf Google Maps öffnen`,
    },
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
      text: `Sichere Zahlung: ${PAYMENT_SHORT.join(", ")}`,
      href: "/service/zahlungsarten",
    },
  ];
}

/** Die Einträge mit den von Hand gepflegten Profilzahlen (ohne Places API). */
export const TRUST_ITEMS: readonly TrustItem[] = trustItems({
  ...GOOGLE_PROFIL,
  source: "konstante",
});

/**
 * Für den Test: jede Kurzform muss in einer angebotenen Zahlungsart stecken
 * («Karte» in «Kreditkarte (Visa/Mastercard)»). Fällt eine Zahlungsart weg,
 * fällt der Test — und mit ihm die Behauptung.
 */
export function paymentShortFormsCovered(): boolean {
  return PAYMENT_SHORT.every((short) =>
    PAYMENT_METHODS.some((m) =>
      m.label.toLowerCase().includes(short.toLowerCase()),
    ),
  );
}

/** Für den Test: «aus der Schweiz» setzt den Firmensitz in CH voraus. */
export const SHIPS_FROM_COUNTRY: string = BUSINESS.countryCode;
