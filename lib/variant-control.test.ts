import { describe, expect, it } from "vitest";
import { defaultVariant, preselectedVariant } from "./pricing";
import { variantControl, variantLabel, variantOptionText } from "./variant-control";
import type { ProductVariantView } from "./types";

const v = (id: string, extra: Partial<ProductVariantView> = {}): ProductVariantView => ({
  id,
  title: id,
  price: 1,
  inStock: true,
  tiers: [],
  unitsPerPack: 1,
  packType: "single",
  ...extra,
});

const sizes = [v("100 g"), v("250 g"), v("500 g"), v("1 kg")];
const packs = [v("Einzeln"), v("Display", { packType: "display", unitsPerPack: 24 })];

describe("variantControl", () => {
  it("eine Variante: kein Element", () => {
    expect(variantControl([v("a")], "Grösse")).toBe("none");
    expect(variantControl([], undefined)).toBe("none");
  });
  it("mehrere Grössen: Auswahlliste", () => {
    expect(variantControl(sizes, "Grösse")).toBe("select");
  });
  it("Verpackungseinheit bleibt bei den Knöpfen", () => {
    expect(variantControl(packs, "Verpackungseinheit")).toBe("buttons");
    expect(variantControl(sizes, " verpackungseinheit ")).toBe("buttons");
  });
  it("ohne Optionsname entscheiden die Gebinde-Daten", () => {
    expect(variantControl(packs, undefined)).toBe("buttons");
    expect(variantControl(sizes, undefined)).toBe("select");
  });
});

describe("Beschriftung", () => {
  it("Optionsname oder Rückfall", () => {
    expect(variantLabel("Grösse")).toBe("Grösse");
    expect(variantLabel(" ")).toBe("Variante");
    expect(variantLabel(undefined)).toBe("Variante");
  });
  it("Zeile mit Preis bzw. ausverkauft", () => {
    const f = (n: number) => `CHF ${n.toFixed(2)}`;
    expect(variantOptionText(v("100 g", { price: 6.9 }), f)).toBe("100 g – CHF 6.90");
    expect(variantOptionText(v("1 kg", { inStock: false }), f)).toBe("1 kg – ausverkauft");
  });
});

describe("Vorauswahl bei Grössen", () => {
  it("die erste lieferbare Grösse", () => {
    const list = [v("100 g", { inStock: false }), v("250 g"), v("500 g")];
    expect(defaultVariant(list)?.id).toBe("250 g");
  });
  it("?variant= gewinnt, auch ausverkauft", () => {
    const list = [v("100 g", { inStock: false }), v("250 g")];
    expect(preselectedVariant(list, "100 g")?.id).toBe("100 g");
    expect(preselectedVariant(list, "unbekannt")?.id).toBe("250 g");
  });
});
