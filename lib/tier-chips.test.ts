import { describe, expect, it } from "vitest";
import {
  MAX_QUANTITY,
  normalizeQuantity,
  orderImagesForTier,
  sanitizeQuantityInput,
  savingAt,
  tierChips,
  tierForQuantity,
} from "./pricing";
import type { PriceTier } from "./types";

const tiers: PriceTier[] = [
  { minQuantity: 1, maxQuantity: 9, price: 1.95 },
  { minQuantity: 10, maxQuantity: 23, price: 1.85 },
  { minQuantity: 24, maxQuantity: 49, price: 1.4 },
  { minQuantity: 50, maxQuantity: null, price: 1.3 },
];

describe("tierChips", () => {
  it("eine Chip je Stufe, mit Bezeichnung, Foto und Ersparnis", () => {
    const chips = tierChips(tiers, { 24: { label: "24er Display", image: "/b.jpg" } });
    expect(chips.map((c) => c.label)).toEqual(["1 Stück", "10 Stück", "24er Display", "50 Stück"]);
    expect(chips.map((c) => c.savePercent)).toEqual([0, 5, 28, 33]);
    expect(chips[2].image).toBe("/b.jpg");
  });

  it("ohne Staffel keine Chips", () => {
    expect(tierChips([])).toEqual([]);
  });
});

describe("savingAt", () => {
  it("rechnet die Ersparnis gegenüber dem Einzelpreis", () => {
    expect(savingAt(tiers, 24)).toEqual({ amount: 13.2, percent: 28 });
    expect(savingAt(tiers, 30)).toEqual({ amount: 16.5, percent: 28 });
    expect(savingAt(tiers, 3)).toEqual({ amount: 0, percent: 0 });
  });
});

describe("orderImagesForTier", () => {
  const images = ["/a.jpg", "/b.jpg", "/c.jpg"];
  it("zieht das Stufenfoto nach vorn, der Rest bleibt in Reihenfolge", () => {
    expect(orderImagesForTier(images, "/c.jpg")).toEqual(["/c.jpg", "/a.jpg", "/b.jpg"]);
  });
  it("ohne oder mit fremdem Foto: normale Reihenfolge", () => {
    expect(orderImagesForTier(images, undefined)).toBe(images);
    expect(orderImagesForTier(images, "/x.jpg")).toBe(images);
  });
});

describe("Menge frei eintippen", () => {
  it("normalizeQuantity: leer, 0, führende Nullen, Maximum, Nicht-Ziffern", () => {
    expect(normalizeQuantity("")).toBe(1);
    expect(normalizeQuantity("0")).toBe(1);
    expect(normalizeQuantity("007")).toBe(7);
    expect(normalizeQuantity("5000")).toBe(MAX_QUANTITY);
    expect(normalizeQuantity("9999999999")).toBe(MAX_QUANTITY);
    expect(normalizeQuantity("1a2-3")).toBe(123);
    expect(normalizeQuantity("abc")).toBe(1);
    expect(normalizeQuantity(49.7)).toBe(49);
    expect(normalizeQuantity(NaN)).toBe(1);
  });

  it("sanitizeQuantityInput: Ziffern, ohne führende Nullen, gedeckelt", () => {
    expect(sanitizeQuantityInput("")).toBe("");
    expect(sanitizeQuantityInput("0")).toBe("0");
    expect(sanitizeQuantityInput("007")).toBe("7");
    expect(sanitizeQuantityInput("4 9x")).toBe("49");
    expect(sanitizeQuantityInput("12345")).toBe(String(MAX_QUANTITY));
  });

  it("tierForQuantity: getippte Menge landet in der richtigen Stufe", () => {
    const chips = tierChips(tiers);
    expect(tierForQuantity(chips, 1)).toBe(1);
    expect(tierForQuantity(chips, 9)).toBe(1);
    expect(tierForQuantity(chips, 10)).toBe(10);
    expect(tierForQuantity(chips, 49)).toBe(24);
    expect(tierForQuantity(chips, 50)).toBe(50);
    expect(tierForQuantity(chips, 999)).toBe(50);
    expect(tierForQuantity([], 5)).toBe(1);
  });
});
