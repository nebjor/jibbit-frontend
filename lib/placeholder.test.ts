import { describe, expect, it } from "vitest";
import { brandLabel, kindLabel, knownBrand } from "./placeholder";

describe("brandLabel", () => {
  it("nimmt die gepflegte Marke, wenn es eine gibt", () => {
    expect(brandLabel("Irgendwas", "PURIZE")).toBe("PURIZE");
    expect(brandLabel("Irgendwas", "  ")).not.toBe("  ");
  });

  it("erkennt bekannte Marken im Namen", () => {
    expect(brandLabel("Zig Zag Slim Filter 6mm 120stk")).toBe("Zig Zag");
    expect(brandLabel("OCB Premium KSS Papers mit Filter")).toBe("OCB");
    expect(brandLabel("dubi Aktivkohlefilter ø7mm")).toBe("dubi");
    expect(brandLabel("RAW Kristallglas Aschenbecher Ruby")).toBe("RAW");
  });

  it("erkennt die Marke auch abseits des ersten Wortes", () => {
    expect(brandLabel("Bio Slim Rolls von OCB")).toBe("OCB");
  });

  it("nimmt sonst das erste Wort", () => {
    expect(brandLabel("Irgendeine Neue Marke 42")).toBe("Irgendeine");
  });
});

describe("kindLabel", () => {
  /**
   * Reihenfolge-Falle, dieselbe wie im Katalogimporteur: der Name enthält
   * „Papers" UND „Filter" und ist ein Blättchen.
   */
  it("liest Papers vor Filter", () => {
    expect(kindLabel("OCB Premium KSS Papers mit Filter", "papers")).toBe("Papers");
  });

  it("hält Aktivkohlefilter von gewöhnlichen Filtern auseinander", () => {
    expect(kindLabel("PURIZE Aktivkohlefilter ø 9mm", "filter")).toBe(
      "Aktivkohlefilter",
    );
    expect(kindLabel("Kailar Filter 5.9mm 65stk pink", "filter")).toBe("Filter");
    expect(kindLabel("OCB Slim Filter Bio (120 Tips)", "filter")).toBe("Filter");
  });

  it("erkennt Rolls und Aschenbecher", () => {
    expect(kindLabel("RAW Classic Rolls Slim", "papers")).toBe("Rolls");
    expect(kindLabel("RAW Kristallglas Aschenbecher Ruby", "zubehoer")).toBe(
      "Aschenbecher",
    );
  });

  it("fällt auf die Kategorie zurück, wenn der Name nichts hergibt", () => {
    expect(kindLabel("Purize SUPER SLIM White ø5mm", "filter")).toBe("Filter");
    expect(kindLabel("Elements King Size Ultra Thin", "papers")).toBe("Papers");
    expect(kindLabel("Etwas ganz Neues", "zubehoer")).toBe("Zubehör");
  });
});

/** Dieser Wert geht als `brand` an Google — strenger als die Kachel. */
describe("knownBrand", () => {
  it("erkennt den Hersteller am Anfang des Titels", () => {
    expect(knownBrand("OCB Premium kurz")).toBe("OCB");
    expect(knownBrand("Zig Zag Slim Filter 6mm 120stk")).toBe("Zig Zag");
    expect(knownBrand("Zig-Zag Slim Filter")).toBe("Zig Zag");
    expect(knownBrand("dubi Aktivkohlefilter ø7mm")).toBe("dubi");
    expect(knownBrand("Purize SUPER SLIM White ø5mm")).toBe("PURIZE");
    expect(knownBrand("Black Leaf El Humeros Konische Hülsen KS 100X")).toBe("Black Leaf");
  });

  it("rät nicht: kein Hersteller am Anfang, keine Marke", () => {
    expect(knownBrand("Silikon Dose ø 22mm")).toBeUndefined();
    expect(knownBrand("Filter für RAW Papers")).toBeUndefined();
    expect(knownBrand("Rawlings Dose")).toBeUndefined();
    expect(knownBrand("")).toBeUndefined();
  });

  it("deckt jedes Produkt mit Hersteller auf test.jibbit.ch ab (Stand 2026-09-29)", () => {
    const titles = [
      "Angel Slim Filters 6mm",
      "Elements BLUE Rolls SW",
      "Gizeh DW Extra Fine",
      "Greengo Unbleached Slim Rolls",
      "Kailar Filter 5.9mm 65stk pink",
      "PURIZE Aktivkohlefilter 9 mm",
      "RAW Black Classic King Size Slim",
      "Smoking Brown kurz (double window)",
    ];
    for (const title of titles) expect(knownBrand(title), title).toBeDefined();
  });
});
