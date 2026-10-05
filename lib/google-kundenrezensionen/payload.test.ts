import { describe, expect, it } from "vitest";
import { DELIVERY } from "@/lib/config";
import {
  addBusinessDays,
  deliveryCountry,
  formatIsoDate,
  geschaetztesLieferdatum,
  kundenrezensionenPayload,
  parseMerchantId,
  type GcrOrderInput,
} from "./payload";

/**
 * Die Zusagen der Nutzlast für Googles Opt-in-Modul:
 *
 *  1. Das Lieferdatum zählt WERKTAGE (Wochenenden übersprungen) und liegt
 *     nie in der Vergangenheit.
 *  2. `products` enthält nur geprüfte GTINs — und fehlt ganz, wenn keine da.
 *  3. Lieferland ISO-2 gross, Rückfall CH.
 *  4. Ohne E-Mail (oder Datum) gibt es KEINE Nutzlast.
 */

const DELIVERY_6 = { handlingDaysMax: 3, transitDaysMax: 3 };

const bestellung: GcrOrderInput = {
  id: "order_01JABCDEF",
  displayId: 42,
  email: "kundin@example.ch",
  countryCode: "ch",
  // Montag, 5. Oktober 2026, 14:30 Uhr Zürich (12:30 UTC).
  createdAt: "2026-10-05T12:30:00.000Z",
  gtins: [],
};

const now = new Date("2026-10-05T13:00:00.000Z");

describe("addBusinessDays — Werktage, keine Wochenenden", () => {
  it("Montag + 6 Werktage = Dienstag der Folgewoche", () => {
    const start = new Date("2026-10-05T12:30:00.000Z"); // Mo
    expect(formatIsoDate(addBusinessDays(start, 6))).toBe("2026-10-13"); // Di
  });

  it("Freitag + 1 Werktag = Montag", () => {
    const start = new Date("2026-10-09T08:00:00.000Z"); // Fr
    expect(formatIsoDate(addBusinessDays(start, 1))).toBe("2026-10-12");
  });

  it("Samstagsbestellung: der erste Werktag danach zählt als Tag 1", () => {
    const start = new Date("2026-10-10T20:00:00.000Z"); // Sa
    expect(formatIsoDate(addBusinessDays(start, 1))).toBe("2026-10-12"); // Mo
    expect(formatIsoDate(addBusinessDays(start, 6))).toBe("2026-10-19"); // Mo
  });

  it("0 Tage lässt das Datum stehen; negative Werte zählen als 0", () => {
    const start = new Date("2026-10-07T23:59:00.000Z");
    expect(formatIsoDate(addBusinessDays(start, 0))).toBe("2026-10-07");
    expect(formatIsoDate(addBusinessDays(start, -3))).toBe("2026-10-07");
  });
});

describe("geschaetztesLieferdatum", () => {
  it("Bestelldatum + Bearbeitung (max) + Transport (max) in Werktagen", () => {
    expect(
      geschaetztesLieferdatum(new Date(bestellung.createdAt), DELIVERY_6, now),
    ).toBe("2026-10-13");
  });

  it("nimmt die Zahlen aus lib/config.ts — heute 6 Werktage", () => {
    expect(DELIVERY.handlingDaysMax + DELIVERY.transitDaysMax).toBe(6);
    expect(
      geschaetztesLieferdatum(new Date(bestellung.createdAt), DELIVERY, now),
    ).toBe("2026-10-13");
  });

  it("liegt nie in der Vergangenheit — Seite Wochen später geöffnet", () => {
    const spaeter = new Date("2026-11-20T09:00:00.000Z");
    expect(
      geschaetztesLieferdatum(new Date(bestellung.createdAt), DELIVERY_6, spaeter),
    ).toBe("2026-11-20");
  });

  it("gibt YYYY-MM-DD aus", () => {
    expect(
      geschaetztesLieferdatum(new Date(bestellung.createdAt), DELIVERY_6, now),
    ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("Abholung im Laden: nur die Bearbeitung, kein Transport", () => {
    // Montag + 3 Werktage = Donnerstag.
    expect(
      geschaetztesLieferdatum(new Date(bestellung.createdAt), DELIVERY_6, now, true),
    ).toBe("2026-10-08");
  });
});

describe("deliveryCountry", () => {
  it("ISO-2 in Grossbuchstaben", () => {
    expect(deliveryCountry("ch")).toBe("CH");
    expect(deliveryCountry(" de ")).toBe("DE");
  });

  it("Rückfall CH bei leer, ungültig oder ZZ", () => {
    expect(deliveryCountry(undefined)).toBe("CH");
    expect(deliveryCountry(null)).toBe("CH");
    expect(deliveryCountry("")).toBe("CH");
    expect(deliveryCountry("CHE")).toBe("CH");
    expect(deliveryCountry("zz")).toBe("CH");
  });
});

describe("parseMerchantId", () => {
  it("liest die Merchant-Center-ID als Zahl", () => {
    expect(parseMerchantId("5618479597")).toBe(5618479597);
    expect(parseMerchantId("  5618479597\n")).toBe(5618479597);
  });

  it("alles andere ist null — nichts raten", () => {
    expect(parseMerchantId(undefined)).toBeNull();
    expect(parseMerchantId("")).toBeNull();
    expect(parseMerchantId("0")).toBeNull();
    expect(parseMerchantId("abc")).toBeNull();
    expect(parseMerchantId("56 18")).toBeNull();
  });
});

describe("kundenrezensionenPayload", () => {
  const options = { merchantId: 5618479597, delivery: DELIVERY_6, now };

  it("baut genau die Felder, die Google erwartet — ohne products", () => {
    expect(kundenrezensionenPayload(bestellung, options)).toEqual({
      merchant_id: 5618479597,
      order_id: "42",
      email: "kundin@example.ch",
      delivery_country: "CH",
      estimated_delivery_date: "2026-10-13",
    });
    expect(
      kundenrezensionenPayload(bestellung, options),
    ).not.toHaveProperty("products");
  });

  it("Abholung im Laden: Datum ohne Transport, Lieferland bleibt CH", () => {
    expect(kundenrezensionenPayload({ ...bestellung, pickup: true }, options)).toMatchObject({
      delivery_country: "CH",
      estimated_delivery_date: "2026-10-08",
    });
  });

  it("products: nur gültige GTINs, ohne Doppelte, Leerzeichen bereinigt", () => {
    const payload = kundenrezensionenPayload(
      {
        ...bestellung,
        gtins: [
          "4260000000000", // ungültige Prüfziffer
          "8 595134 501285", // gültig, mit Leerzeichen wie auf der Packung
          "8595134501285", // Doppelt
          undefined,
          null,
          "LAGER-123", // hauseigener Code
          "00000000", // Platzhalter
          "96385074", // gültige GTIN-8
        ],
      },
      options,
    );
    expect(payload?.products).toEqual([
      { gtin: "8595134501285" },
      { gtin: "96385074" },
    ]);
  });

  it("Lieferland aus der Adresse, Rückfall CH", () => {
    expect(
      kundenrezensionenPayload({ ...bestellung, countryCode: "li" }, options)
        ?.delivery_country,
    ).toBe("LI");
    expect(
      kundenrezensionenPayload({ ...bestellung, countryCode: null }, options)
        ?.delivery_country,
    ).toBe("CH");
  });

  it("order_id: Bestellnummer als String, ULID als Rückfall", () => {
    expect(kundenrezensionenPayload(bestellung, options)?.order_id).toBe("42");
    expect(
      kundenrezensionenPayload({ ...bestellung, displayId: 0 }, options)
        ?.order_id,
    ).toBe("order_01JABCDEF");
  });

  it("ohne E-Mail: null", () => {
    expect(kundenrezensionenPayload({ ...bestellung, email: "" }, options)).toBeNull();
    expect(
      kundenrezensionenPayload({ ...bestellung, email: "   " }, options),
    ).toBeNull();
    expect(
      kundenrezensionenPayload({ ...bestellung, email: "keine-adresse" }, options),
    ).toBeNull();
  });

  it("ohne brauchbares Bestelldatum: null", () => {
    expect(
      kundenrezensionenPayload({ ...bestellung, createdAt: "" }, options),
    ).toBeNull();
    expect(
      kundenrezensionenPayload({ ...bestellung, createdAt: "gestern" }, options),
    ).toBeNull();
  });
});
