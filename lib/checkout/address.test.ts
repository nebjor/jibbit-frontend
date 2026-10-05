import { describe, expect, it } from "vitest";
import {
  EMPTY_ADDRESS,
  hasErrors,
  normalizeAddress,
  validateAddress,
  validateEmail,
  validatePickupContact,
} from "./address";
import type { CheckoutAddress } from "@/lib/cart/types";

const VALID: CheckoutAddress = {
  firstName: "Max",
  lastName: "Muster",
  address1: "Bahnhofstrasse 1",
  postalCode: "8001",
  city: "Zürich",
  countryCode: "ch",
};

describe("validateEmail", () => {
  it("accepts ordinary and awkward-but-valid addresses", () => {
    for (const email of [
      "gast@example.ch",
      "max.muster+jibbit@example.co.uk",
      "o'brien@example.ch",
    ]) {
      expect(validateEmail(email)).toBeUndefined();
    }
  });

  it("rejects what is obviously not an address", () => {
    expect(validateEmail("")).toBeDefined();
    expect(validateEmail("   ")).toBeDefined();
    expect(validateEmail("max.muster")).toBeDefined();
    expect(validateEmail("max@muster")).toBeDefined();
  });
});

describe("validateAddress", () => {
  it("accepts a complete Swiss address — no account required", () => {
    expect(validateAddress(VALID, "gast@example.ch")).toEqual({});
  });

  it("names every missing field, so the form can mark them all at once", () => {
    const errors = validateAddress(EMPTY_ADDRESS, "");
    expect(hasErrors(errors)).toBe(true);
    for (const key of [
      "email",
      "firstName",
      "lastName",
      "address1",
      "city",
      "postalCode",
    ] as const) {
      expect(errors[key]).toBeTruthy();
    }
    // The default country is valid, so it must NOT be flagged.
    expect(errors.countryCode).toBeUndefined();
  });

  it("insists on a four-digit postal code for CH and LI", () => {
    expect(validateAddress({ ...VALID, postalCode: "801" }, "g@e.ch").postalCode)
      .toBeTruthy();
    expect(validateAddress({ ...VALID, postalCode: "80011" }, "g@e.ch").postalCode)
      .toBeTruthy();
    expect(
      validateAddress({ ...VALID, countryCode: "li", postalCode: "9490" }, "g@e.ch"),
    ).toEqual({});
  });

  it("refuses countries the shop does not ship to", () => {
    expect(
      validateAddress({ ...VALID, countryCode: "de" }, "g@e.ch").countryCode,
    ).toBeTruthy();
  });

  it("uses Swiss spelling in its messages — ss, never sharp s", () => {
    const all = Object.values(validateAddress(EMPTY_ADDRESS, "")).join(" ");
    expect(all).not.toMatch(/ß/);
  });
});

describe("validatePickupContact — Abholung im Laden", () => {
  it("braucht Name, E-Mail und Telefon, aber keine Adresse", () => {
    expect(
      validatePickupContact(
        { firstName: "Max", lastName: "Muster", phone: "076 414 08 90" },
        "max@example.ch",
      ),
    ).toEqual({});
    expect(
      validatePickupContact({ ...EMPTY_ADDRESS, firstName: "Max", lastName: "Muster", phone: "+41 76 414 08 90" }, "max@example.ch"),
    ).toEqual({});
  });

  it("nennt, was fehlt — das Telefon ist hier Pflicht", () => {
    const errors = validatePickupContact({ firstName: "", lastName: "", phone: "" }, "");
    expect(errors.email).toBeDefined();
    expect(errors.firstName).toBe("Vorname fehlt.");
    expect(errors.lastName).toBe("Nachname fehlt.");
    expect(errors.phone).toMatch(/Telefonnummer fehlt/);
    expect(errors.address1).toBeUndefined();
    expect(errors.postalCode).toBeUndefined();
    expect(errors.city).toBeUndefined();
    expect(errors.countryCode).toBeUndefined();
  });

  it("weist eine offensichtlich unvollständige Nummer zurück", () => {
    expect(
      validatePickupContact({ firstName: "Max", lastName: "Muster", phone: "0764" }, "max@example.ch").phone,
    ).toMatch(/nicht vollständig/);
    const all = Object.values(validatePickupContact({ firstName: "", lastName: "", phone: "" }, "")).join(" ");
    expect(all).not.toMatch(/ß/);
  });
});

describe("normalizeAddress", () => {
  it("trims and drops empty optionals so Medusa stores no blank strings", () => {
    const normalized = normalizeAddress({
      ...VALID,
      firstName: "  Max  ",
      company: "   ",
      address2: "",
      countryCode: "CH",
    });
    expect(normalized.firstName).toBe("Max");
    expect(normalized.company).toBeUndefined();
    expect(normalized.address2).toBeUndefined();
    // Medusa expects a lowercase ISO-2 country code.
    expect(normalized.countryCode).toBe("ch");
  });
});
