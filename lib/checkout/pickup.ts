/**
 * Abholung im Laden — reine Logik, kein Netz, kein React.
 *
 * ERKENNUNG: Die Abholung ist in Medusa eine gewöhnliche Shipping Option
 * (flat, CHF 0) auf derselben Service-Zone wie der Versand. Erkannt wird sie
 * an drei Markern, die das Backend setzt (medusa-ecom, docs/abholung-im-laden.md):
 *
 *   - an der OPTION:  `metadata.pickup === true` oder `data.pickup === true`
 *                     oder `type.code === "pickup"`,
 *   - an der METHODE auf Cart/Bestellung: `data.pickup === true` — der
 *     swiss-shipping-Provider stempelt das beim Hinzufügen, und diese
 *     Storefront schickt es zusätzlich mit (`addShippingMethod`, data),
 *   - am CART/der BESTELLUNG: `metadata.pickup === true`, gesetzt von hier.
 *
 * Nie am Namen: Der ist im Admin frei änderbar, und «Abholung» könnte
 * irgendwann auch in einer Versandart vorkommen.
 *
 * ADRESSE: Medusa verlangt für jede Shipping Option eine Lieferadresse im
 * Liefergebiet. Bei Abholung füllt die Storefront sie mit Name und Telefon
 * der Kundin und der LADENADRESSE (`pickupMedusaAddress`). Folge, bewusst
 * in Kauf genommen: Im Admin steht als Lieferadresse der Laden, und die
 * Rechnungsadresse ist dieselbe — eine zweite Adresse abzufragen, die
 * niemand braucht (keine Rechnung, keine MWST), kostet mehr Bestellungen als
 * sie Buchhaltung spart. Bestellseite, Konto und Mails zeigen diese Adresse
 * deshalb nie als «Lieferadresse», sondern als Abholort.
 */

import { PICKUP } from "@/lib/config";

/** Was die Kundin in der Kasse wählt. */
export type DeliveryChoice = "shipping" | "pickup";

/** Der Teil einer Store-API-Shipping-Option, der für die Erkennung zählt. */
export interface PickupOptionLike {
  metadata?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
  type?: { code?: string | null } | null;
}

/** Eine Versandmethode auf Cart oder Bestellung. */
export interface PickupMethodLike {
  data?: Record<string, unknown> | null;
}

function flag(record: Record<string, unknown> | null | undefined): boolean {
  const value = record?.pickup;
  return value === true || value === "true";
}

/** Ist diese Shipping Option die Abholung im Laden? */
export function isPickupOption(option: PickupOptionLike | null | undefined): boolean {
  if (!option) return false;
  return flag(option.metadata) || flag(option.data) || option.type?.code === "pickup";
}

/** Trägt diese Versandmethode (Cart/Bestellung) den Abhol-Marker? */
export function isPickupMethod(method: PickupMethodLike | null | undefined): boolean {
  return flag(method?.data);
}

/** Ist das Cart-/Bestell-Metadatum auf Abholung gestellt? */
export function hasPickupMetadata(
  entity: { metadata?: Record<string, unknown> | null } | null | undefined,
): boolean {
  return flag(entity?.metadata);
}

/**
 * Abholung ja/nein für eine Entität mit Versandmethoden und Metadaten.
 * Eine vorhandene Methode entscheidet (sie ist das, was Medusa berechnet);
 * ohne Methode zählt die gespeicherte Wahl (`metadata.pickup`) — so weiss die
 * Kasse nach einem Neuladen noch, was gewählt war.
 */
export function isPickup(entity: {
  shipping_methods?: ReadonlyArray<PickupMethodLike | null> | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  const method = (entity.shipping_methods ?? []).find(Boolean);
  if (method) return isPickupMethod(method);
  return hasPickupMetadata(entity);
}

/** Welche Wahl auf dem Cart gespeichert ist — Vorgabe Versand. */
export function deliveryChoiceOf(entity: {
  shipping_methods?: ReadonlyArray<PickupMethodLike | null> | null;
  metadata?: Record<string, unknown> | null;
}): DeliveryChoice {
  return isPickup(entity) ? "pickup" : "shipping";
}

/** Adresszeilen des Ladens, für Kasse, Bestellseite und Konto. */
export function pickupAddressLines(): string[] {
  const a = PICKUP.address;
  return [a.name, a.street, `${a.postalCode} ${a.city}`];
}

/** Die Öffnungszeiten-Blöcke aus der Konfiguration, typisiert. */
export type OpeningHoursBlock = {
  days: readonly string[];
  opens: string;
  closes: string;
};

const DAY_ORDER = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

/**
 * «Mo–Sa 09:00–17:00»: aufeinanderfolgende Tage werden zu einem Bereich,
 * Lücken mit Komma getrennt («Mo–Fr, Sa 09:00–12:00» bei zwei Blöcken).
 * `null` -> leerer String; der Aufrufer zeigt dann den Platzhalter.
 */
export function formatOpeningHours(
  hours: ReadonlyArray<OpeningHoursBlock> | null | undefined,
): string {
  if (!hours?.length) return "";
  return hours
    .map((block) => {
      const indices = block.days
        .map((d) => DAY_ORDER.indexOf(d as (typeof DAY_ORDER)[number]))
        .filter((i) => i >= 0)
        .sort((a, b) => a - b);
      const ranges: string[] = [];
      let start = -1;
      let prev = -1;
      for (const i of indices) {
        if (start < 0) {
          start = i;
        } else if (i !== prev + 1) {
          ranges.push(start === prev ? DAY_ORDER[start] : `${DAY_ORDER[start]}–${DAY_ORDER[prev]}`);
          start = i;
        }
        prev = i;
      }
      if (start >= 0) {
        ranges.push(start === prev ? DAY_ORDER[start] : `${DAY_ORDER[start]}–${DAY_ORDER[prev]}`);
      }
      return `${ranges.join(", ")} ${block.opens}–${block.closes}`;
    })
    .join(", ");
}

/** Text «Abholzeiten: …» für Kasse und Bestellseite; Platzhalter ohne Zeiten. */
export function pickupHoursText(): string {
  const formatted = formatOpeningHours(PICKUP.hours);
  return formatted
    ? `Abholzeiten: ${formatted}`
    : "Abholzeiten: nach Vereinbarung – wir melden uns, sobald die Bestellung bereit ist";
}

const SCHEMA_DAYS: Record<(typeof DAY_ORDER)[number], string> = {
  Mo: "Monday",
  Di: "Tuesday",
  Mi: "Wednesday",
  Do: "Thursday",
  Fr: "Friday",
  Sa: "Saturday",
  So: "Sunday",
};

/**
 * schema.org `OpeningHoursSpecification` je Block — für `Store` in
 * lib/seo/jsonld.ts. Ohne Zeiten `undefined`, damit `prune` das Feld streicht.
 */
export function openingHoursSpecification(
  hours: ReadonlyArray<OpeningHoursBlock> | null | undefined,
): Record<string, unknown>[] | undefined {
  if (!hours?.length) return undefined;
  return hours.map((block) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: block.days
      .map((d) => SCHEMA_DAYS[d as (typeof DAY_ORDER)[number]])
      .filter(Boolean),
    opens: block.opens,
    closes: block.closes,
  }));
}

/**
 * Die Lieferadresse, die Medusa bei Abholung bekommt: Name und Telefon der
 * Kundin, Adresse des Ladens (Begründung im Kopf dieser Datei).
 */
export function pickupMedusaAddress(contact: {
  firstName: string;
  lastName: string;
  company?: string;
  phone?: string;
}): {
  first_name: string;
  last_name: string;
  company?: string;
  address_1: string;
  address_2?: string;
  postal_code: string;
  city: string;
  country_code: string;
  phone?: string;
} {
  const a = PICKUP.address;
  return {
    first_name: contact.firstName,
    last_name: contact.lastName,
    company: contact.company,
    address_1: a.street,
    address_2: PICKUP.label,
    postal_code: a.postalCode,
    city: a.city,
    country_code: a.countryCode.toLowerCase(),
    phone: contact.phone,
  };
}
