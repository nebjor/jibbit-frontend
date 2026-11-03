import { describe, expect, it } from "vitest";
import { BUSINESS, PICKUP } from "@/lib/config";
import {
  deliveryChoiceOf,
  formatOpeningHours,
  isPickup,
  isPickupMethod,
  isPickupOption,
  openingHoursSpecification,
  pickupAddressLines,
  pickupHoursText,
  pickupMedusaAddress,
} from "./pickup";

describe("isPickupOption — Marker, nie der Name", () => {
  it("erkennt metadata.pickup, data.pickup und type.code", () => {
    expect(isPickupOption({ metadata: { pickup: true } })).toBe(true);
    expect(isPickupOption({ data: { pickup: true } })).toBe(true);
    expect(isPickupOption({ data: { pickup: "true" } })).toBe(true);
    expect(isPickupOption({ type: { code: "pickup" } })).toBe(true);
  });

  it("lässt sich vom Namen nicht beeindrucken", () => {
    expect(isPickupOption({ ...({ name: "Abholung im Laden" } as object) })).toBe(false);
    expect(isPickupOption({ type: { code: "standard" }, data: { id: "swiss-standard" } })).toBe(false);
    expect(isPickupOption({ metadata: { pickup: false } })).toBe(false);
    expect(isPickupOption(null)).toBe(false);
    expect(isPickupOption(undefined)).toBe(false);
  });
});

describe("isPickup / deliveryChoiceOf — Cart und Bestellung", () => {
  it("eine vorhandene Methode entscheidet", () => {
    expect(isPickup({ shipping_methods: [{ data: { pickup: true } }], metadata: null })).toBe(true);
    // Methode ohne Marker schlägt ein Metadatum, das noch «pickup» sagt.
    expect(isPickup({ shipping_methods: [{ data: {} }], metadata: { pickup: true } })).toBe(false);
    expect(isPickupMethod({ data: null })).toBe(false);
  });

  it("ohne Methode zählt die gespeicherte Wahl", () => {
    expect(isPickup({ shipping_methods: [], metadata: { pickup: true } })).toBe(true);
    expect(isPickup({ shipping_methods: null, metadata: { pickup: false } })).toBe(false);
    expect(isPickup({})).toBe(false);
    expect(deliveryChoiceOf({ metadata: { pickup: true } })).toBe("pickup");
    expect(deliveryChoiceOf({})).toBe("shipping");
  });
});

describe("Öffnungszeiten", () => {
  it("fasst aufeinanderfolgende Tage zusammen", () => {
    expect(formatOpeningHours([{ days: ["Mo", "Di", "Mi", "Do", "Fr", "Sa"], opens: "09:00", closes: "17:00" }])).toBe(
      "Mo–Sa 09:00–17:00",
    );
    expect(
      formatOpeningHours([
        { days: ["Mo", "Di", "Mi", "Do", "Fr"], opens: "09:00", closes: "18:30" },
        { days: ["Sa"], opens: "09:00", closes: "12:00" },
      ]),
    ).toBe("Mo–Fr 09:00–18:30, Sa 09:00–12:00");
    expect(formatOpeningHours([{ days: ["Mo", "Mi", "Fr"], opens: "10:00", closes: "12:00" }])).toBe(
      "Mo, Mi, Fr 10:00–12:00",
    );
  });

  it("die konfigurierten Zeiten sind die des Google-Unternehmensprofils", () => {
    expect(formatOpeningHours(PICKUP.hours)).toBe("Mo–Fr 09:00–17:00");
    expect(pickupHoursText()).toBe("Abholzeiten: Mo–Fr 09:00–17:00");
  });

  it("ohne Zeiten: leer bzw. «nach Vereinbarung», kein Schema", () => {
    expect(formatOpeningHours(null)).toBe("");
    expect(formatOpeningHours([])).toBe("");
    expect(openingHoursSpecification(null)).toBeUndefined();
  });

  it("schema.org OpeningHoursSpecification mit englischen Wochentagen", () => {
    expect(openingHoursSpecification(PICKUP.hours)).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "17:00",
      },
    ]);
  });
});

describe("Adresse", () => {
  it("der Laden ist die Adresse der Anbieterkennzeichnung", () => {
    expect(pickupAddressLines()).toEqual([
      "jibbit",
      BUSINESS.street,
      `${BUSINESS.postalCode} ${BUSINESS.city}`,
    ]);
    expect(pickupAddressLines()).toContain("Unterwegli 1");
    expect(pickupAddressLines()).toContain("8404 Winterthur");
  });

  it("Medusa bekommt Name und Telefon der Kundin, aber die Ladenadresse", () => {
    expect(
      pickupMedusaAddress({ firstName: "Jana", lastName: "Muster", phone: "076 414 08 90" }),
    ).toEqual({
      first_name: "Jana",
      last_name: "Muster",
      company: undefined,
      address_1: "Unterwegli 1",
      address_2: "Abholung im Laden",
      postal_code: "8404",
      city: "Winterthur",
      country_code: "ch",
      phone: "076 414 08 90",
    });
  });
});
