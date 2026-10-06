/**
 * GOOGLE KUNDENREZENSIONEN — die Nutzlast für das Opt-in-Modul, als reine
 * Logik. Kein DOM, kein `window.gapi`, kein Next — testbar unter Vitest
 * (environment: node), dasselbe Muster wie lib/consent/state.ts und
 * lib/analytics/gate.ts. Die Verdrahtung mit Googles Skript steckt in
 * components/GoogleKundenrezensionen.tsx.
 *
 * WAS GOOGLE ERWARTET (Merchant-Center-Hilfe, «Opt-in-Modul für Umfragen
 * einbinden», support.google.com/merchants/answer/7106244):
 *
 *   merchant_id              Merchant-Center-ID (Zahl)
 *   order_id                 «Eine eindeutige ID für die Bestellung»
 *   email                    E-Mail der Kundin, name@domain.com
 *   delivery_country         ISO 3166-1 alpha-2, nie «ZZ»
 *   estimated_delivery_date  YYYY-MM-DD — Google schickt die Umfrage ERST
 *                            nach diesem Datum, darum muss er realistisch
 *                            sein («Order details must be accurate to the
 *                            best of your ability»)
 *   products[].gtin          optional (Hilfe 14632920, «Produktrezensionen
 *                            erfassen»): nur mit GTIN wird nach dem Produkt
 *                            gefragt; wer die Zeile weglässt, sammelt nur
 *                            Shop-Bewertungen. Produktbewertungen zeigt
 *                            Google ab drei Rezensionen je Produkt.
 *
 * ENTSCHEIDUNGEN
 *
 *  - order_id = die Bestellnummer (`display_id`, «Bestellung 2»), nicht die
 *    ULID: Sie ist pro Shop eindeutig und ist das, was Inhaber und Kundin in
 *    Mail, Konto und Medusa-Admin sehen — im Merchant Center steht zu jeder
 *    Rezension die order_id, und dort will man nicht nach `order_01J…`
 *    suchen. Fehlt sie (0), fällt der Code auf die ULID zurück.
 *
 *  - Lieferdatum = Bestelldatum + Bearbeitung (max.) + Transport (max.) in
 *    WERKTAGEN, aus `DELIVERY` in lib/config.ts — dieselben Zahlen, die
 *    /service/versand und das Produkt-Schema (OfferShippingDetails)
 *    versprechen. Lieber das obere Ende: eine Umfrage, die vor dem Paket
 *    eintrifft, erzeugt eine schlechte Bewertung für ein Problem, das es
 *    nicht gibt. Werktag = Montag bis Freitag; Feiertage werden bewusst
 *    nicht gerechnet (die Post stellt an den meisten kantonalen Feiertagen
 *    zu, und eine Schätzung, die einen Tag zu früh liegt, ist verzeihlich).
 *
 *  - Abholung im Laden: kein Transport, also Bestelldatum + Bearbeitung
 *    (max.) — der Tag, an dem die Ware spätestens bereitliegt. Das
 *    `delivery_country` bleibt CH; Google kennt keinen Abholbegriff, und
 *    der Laden steht in der Schweiz.
 *
 *  - Liegt das so berechnete Datum bereits in der Vergangenheit (die
 *    Bestätigungsseite wird Wochen später aus der Mail wieder geöffnet),
 *    gilt «heute»: Google soll kein vergangenes Datum bekommen, und die
 *    Umfrage darf dann sofort raus — geliefert ist ja.
 *
 *  - Ohne E-Mail keine Nutzlast (`null`): das Modul kann ohne Adresse
 *    niemanden einladen, und Google würde den Aufruf mit Fehler quittieren.
 */

import type { DELIVERY } from "@/lib/config";
import { normalizeGtin } from "@/lib/gtin";

export interface GcrOptInPayload {
  merchant_id: number;
  order_id: string;
  email: string;
  delivery_country: string;
  estimated_delivery_date: string;
  products?: { gtin: string }[];
}

/** Das Wenige, das die Bestätigungsseite dafür zum Client reicht. */
export interface GcrOrderInput {
  /** Medusa-ULID — Rückfall, falls `displayId` fehlt. */
  id: string;
  /** Bestellnummer (`display_id`); 0 = unbekannt. */
  displayId: number;
  email: string;
  /** ISO-2 der Lieferadresse, Gross- oder Kleinschreibung egal; leer = CH. */
  countryCode: string | null | undefined;
  /** Bestellzeitpunkt, ISO-8601 (Medusas `created_at`). */
  createdAt: string;
  /** Abholung im Laden: nur Bearbeitungszeit, kein Transport. */
  pickup?: boolean;
  /** Rohe GTIN-Kandidaten je Position — werden hier geprüft, nicht vorher. */
  gtins: ReadonlyArray<string | null | undefined>;
}

/** Die beiden Obergrenzen aus `DELIVERY` (lib/config.ts), in Werktagen. */
export type DeliveryWindow = {
  [K in keyof Pick<typeof DELIVERY, "handlingDaysMax" | "transitDaysMax">]: number;
};

/** Lieferland, auf das zurückgefallen wird — der Shop liefert nur dorthin. */
export const DEFAULT_DELIVERY_COUNTRY = "CH";

/** Ist die Merchant-Center-ID aus der Umgebung brauchbar? Nur Ziffern. */
export function parseMerchantId(raw: string | undefined | null): number | null {
  const trimmed = raw?.trim() ?? "";
  if (!/^\d{1,20}$/.test(trimmed)) return null;
  const id = Number(trimmed);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** `Date` -> `YYYY-MM-DD`, in UTC — Tagesgenauigkeit reicht Google. */
export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * `days` Werktage (Mo–Fr) zu `start` addieren. Fällt `start` selbst auf ein
 * Wochenende, zählt der erste Werktag danach als Tag 1 — eine Bestellung vom
 * Samstag wird frühestens am Montag bearbeitet.
 */
export function addBusinessDays(start: Date, days: number): Date {
  const date = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return date;
}

/**
 * Voraussichtliches Lieferdatum: Bestelldatum + Bearbeitung + Transport,
 * beides am oberen Ende und in Werktagen; nie in der Vergangenheit (`now`).
 * Bei Abholung (`pickup`) entfällt der Transport.
 */
export function geschaetztesLieferdatum(
  orderDate: Date,
  delivery: DeliveryWindow,
  now: Date = new Date(),
  pickup = false,
): string {
  const estimated = addBusinessDays(
    orderDate,
    delivery.handlingDaysMax + (pickup ? 0 : delivery.transitDaysMax),
  );
  const today = formatIsoDate(now);
  const estimatedIso = formatIsoDate(estimated);
  return estimatedIso < today ? today : estimatedIso;
}

/**
 * Lieferland für Google: ISO-2 in Grossbuchstaben. Leer, ungültig oder
 * «ZZ» (von Google ausdrücklich verboten) -> Schweiz, denn nur dorthin wird
 * geliefert.
 */
export function deliveryCountry(raw: string | null | undefined): string {
  const code = raw?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(code) || code === "ZZ") return DEFAULT_DELIVERY_COUNTRY;
  return code;
}

/**
 * Die Nutzlast für `gapi.surveyoptin.render(...)` — oder `null`, wenn sie
 * nicht gebaut werden kann (keine E-Mail, kein Bestelldatum).
 *
 * GTINs: nur gültige (Prüfziffer, lib/gtin.ts), ohne Doppelte, und der
 * Schlüssel `products` fehlt ganz, wenn keine übrig bleibt — Google soll
 * dann nur nach dem Shop fragen, nicht nach «undefined».
 */
export function kundenrezensionenPayload(
  order: GcrOrderInput,
  options: { merchantId: number; delivery: DeliveryWindow; now?: Date },
): GcrOptInPayload | null {
  const email = order.email.trim();
  if (!email.includes("@")) return null;

  const createdAt = new Date(order.createdAt);
  if (Number.isNaN(createdAt.getTime())) return null;

  const orderId =
    order.displayId > 0 ? String(order.displayId) : order.id.trim();
  if (!orderId) return null;

  const gtins = [
    ...new Set(
      order.gtins
        .map((raw) => normalizeGtin(raw))
        .filter((g): g is string => g !== undefined),
    ),
  ];

  const payload: GcrOptInPayload = {
    merchant_id: options.merchantId,
    order_id: orderId,
    email,
    delivery_country: deliveryCountry(order.countryCode),
    estimated_delivery_date: geschaetztesLieferdatum(
      createdAt,
      options.delivery,
      options.now,
      order.pickup === true,
    ),
  };
  if (gtins.length > 0) payload.products = gtins.map((gtin) => ({ gtin }));
  return payload;
}
