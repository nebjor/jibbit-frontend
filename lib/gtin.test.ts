import { describe, expect, it } from "vitest";
import { gtinProperty, isValidGtin, normalizeGtin } from "./gtin";

/**
 * Eine GTIN mit falscher Prüfziffer im Schema ist schlimmer als keine: sie
 * ordnet das Angebot einem fremden Artikel zu. Deshalb wird hier vor allem
 * geprüft, was NICHT durchgeht.
 */

const GTIN8 = "85966789"; // Greengo Slim Rolls, Einzelstück
const GTIN12 = "716165280293"; // RAW Classic Rolls (UPC-A)
const GTIN13 = "8595134501285"; // Greengo Slim Rolls, Display
const GTIN14 = "18595134501282";

describe("isValidGtin", () => {
  it("akzeptiert gültige GTIN-8, -12, -13 und -14", () => {
    for (const gtin of [GTIN8, GTIN12, GTIN13, GTIN14, "036000291452"]) {
      expect(isValidGtin(gtin)).toBe(true);
    }
  });

  it("lehnt eine falsche Prüfziffer ab", () => {
    expect(isValidGtin("85966780")).toBe(false);
    expect(isValidGtin("716165280294")).toBe(false);
    expect(isValidGtin("8595134501286")).toBe(false);
  });

  it("lehnt alles ab, was nicht nur aus Ziffern besteht", () => {
    expect(isValidGtin("85966A89")).toBe(false);
    expect(isValidGtin("8595134501285 ")).toBe(false);
    expect(isValidGtin("")).toBe(false);
  });

  it("lehnt falsche Längen ab — auch wenn die Prüfziffer aufginge", () => {
    // Führende Nullen ändern die Prüfziffer nicht — die Länge schon.
    expect(isValidGtin("085966789")).toBe(false);
    expect(isValidGtin("0085966789")).toBe(false);
    expect(isValidGtin("008595134501285")).toBe(false);
    expect(isValidGtin("8596678")).toBe(false);
  });

  it("lehnt Zahlen, null und undefined ab", () => {
    expect(isValidGtin(85966789)).toBe(false);
    expect(isValidGtin(null)).toBe(false);
    expect(isValidGtin(undefined)).toBe(false);
  });

  it("lehnt den Nullen-Platzhalter ab", () => {
    expect(isValidGtin("0000000000000")).toBe(false);
  });
});

describe("normalizeGtin", () => {
  it("lässt eine gültige Nummer unverändert durch", () => {
    expect(normalizeGtin(GTIN13)).toBe(GTIN13);
  });

  it("entfernt Leerzeichen und Bindestriche, wie sie auf der Packung stehen", () => {
    expect(normalizeGtin("8 595134 501285")).toBe(GTIN13);
    expect(normalizeGtin(" 7-16165-28029-3 ")).toBe(GTIN12);
  });

  it("repariert nichts: ungültig oder fehlend -> undefined", () => {
    expect(normalizeGtin("8595134501286")).toBeUndefined();
    expect(normalizeGtin("LAGER-0042")).toBeUndefined();
    expect(normalizeGtin("")).toBeUndefined();
    expect(normalizeGtin(null)).toBeUndefined();
    expect(normalizeGtin(undefined)).toBeUndefined();
  });
});

describe("gtinProperty", () => {
  it("wählt die zur Länge passende schema.org-Eigenschaft", () => {
    expect(gtinProperty(GTIN8)).toBe("gtin8");
    expect(gtinProperty(GTIN12)).toBe("gtin12");
    expect(gtinProperty(GTIN13)).toBe("gtin13");
    expect(gtinProperty(GTIN14)).toBe("gtin14");
  });
});
