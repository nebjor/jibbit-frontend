import { describe, expect, it } from "vitest";
import {
  availableQuantityOf,
  clampToStock,
  exceedsStock,
  isSoldOut,
  isTierDisabled,
  lineStockHint,
  stockNote,
  tierDisabledLabel,
} from "./stock";

describe("availableQuantityOf", () => {
  it("ist unbegrenzt ohne Bestandsführung, auch bei Bestand 0", () => {
    expect(
      availableQuantityOf({ manage_inventory: false, inventory_quantity: 0 }),
    ).toBeNull();
  });

  it("ist unbegrenzt bei erlaubter Nachbestellung", () => {
    expect(
      availableQuantityOf({
        manage_inventory: true,
        allow_backorder: true,
        inventory_quantity: 0,
      }),
    ).toBeNull();
  });

  it("ist der Bestand, sobald die Bestandsführung läuft", () => {
    expect(
      availableQuantityOf({ manage_inventory: true, inventory_quantity: 7 }),
    ).toBe(7);
    expect(
      availableQuantityOf({ manage_inventory: true, inventory_quantity: 0 }),
    ).toBe(0);
  });

  it("macht aus fehlendem oder negativem Bestand 0", () => {
    expect(availableQuantityOf({ manage_inventory: true })).toBe(0);
    expect(
      availableQuantityOf({ manage_inventory: true, inventory_quantity: -3 }),
    ).toBe(0);
  });
});

describe("Bestand und Menge", () => {
  it("isSoldOut gilt nur für 0", () => {
    expect(isSoldOut(0)).toBe(true);
    expect(isSoldOut(3)).toBe(false);
    expect(isSoldOut(null)).toBe(false);
    expect(isSoldOut(undefined)).toBe(false);
  });

  it("clampToStock kappt auf den Bestand, unbegrenzt bleibt unberührt", () => {
    expect(clampToStock(50, 7)).toBe(7);
    expect(clampToStock(5, 7)).toBe(5);
    expect(clampToStock(50, null)).toBe(50);
    // Bestand 0: Menge bleibt mindestens 1 (der Knopf ist ohnehin gesperrt).
    expect(clampToStock(5, 0)).toBe(1);
  });

  it("fällt bei zu grosser Vorauswahl auf die grösste erlaubte Menge", () => {
    expect(clampToStock(24, 7)).toBe(7);
  });

  it("isTierDisabled sperrt Stufen über dem Bestand", () => {
    expect(isTierDisabled(10, 7)).toBe(true);
    expect(isTierDisabled(7, 7)).toBe(false);
    expect(isTierDisabled(1, 7)).toBe(false);
    expect(isTierDisabled(50, null)).toBe(false);
  });

  it("nennt die verfügbare Menge im Tooltip", () => {
    expect(tierDisabledLabel(7)).toBe("Nur noch 7 Stück verfügbar");
  });

  it("exceedsStock vergleicht Warenkorbmenge und Bestand", () => {
    expect(exceedsStock(8, 7)).toBe(true);
    expect(exceedsStock(7, 7)).toBe(false);
    expect(exceedsStock(8, null)).toBe(false);
    expect(exceedsStock(8, undefined)).toBe(false);
    expect(exceedsStock(1, 0)).toBe(true);
  });

  it("lineStockHint unterscheidet knapp und weg", () => {
    expect(lineStockHint(3)).toBe("Nur noch 3 verfügbar – Menge anpassen");
    expect(lineStockHint(0)).toMatch(/nicht mehr verfügbar/i);
  });
});

describe("stockNote", () => {
  const chips = 50; // grösste Stufe ab 50

  it("erscheint, wenn der Bestand unter 10 liegt", () => {
    expect(stockNote(7, 0)).toBe("Nur noch 7 verfügbar");
  });

  it("erscheint, wenn der Bestand unter der grössten Stufe liegt", () => {
    expect(stockNote(30, chips)).toBe("Nur noch 30 verfügbar");
  });

  it("erscheint nicht bei reichlich Bestand, unbegrenzt oder 0", () => {
    expect(stockNote(50, chips)).toBeNull();
    expect(stockNote(500, chips)).toBeNull();
    expect(stockNote(null, chips)).toBeNull();
    expect(stockNote(0, chips)).toBeNull();
  });
});
