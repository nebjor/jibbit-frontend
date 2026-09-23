import { describe, expect, it } from "vitest";
import { orderImagesForTier, savingAt, tierChips } from "./pricing";
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
