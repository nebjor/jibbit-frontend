import { describe, expect, it } from "vitest";
import { brandLabel, kindLabel } from "./placeholder";

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
    expect(kindLabel("Elements King Slim Size Ultra Thin", "papers")).toBe("Papers");
    expect(kindLabel("Etwas ganz Neues", "zubehoer")).toBe("Zubehör");
  });
});
