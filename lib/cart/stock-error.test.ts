import { describe, expect, it } from "vitest";
import {
  describeInsufficientInventory,
  isInsufficientInventory,
} from "./stock-error";

const lines = [
  { variantId: "variant_A", title: "Kailar Filter", variantTitle: "", quantity: 9, availableQuantity: 7 },
  { variantId: "variant_B", title: "RAW Ruby", variantTitle: "", quantity: 1, availableQuantity: null },
];

describe("isInsufficientInventory", () => {
  it("erkennt Medusas Bestandsfehler", () => {
    expect(
      isInsufficientInventory(
        new Error("Variant with id: variant_A does not have the required inventory"),
      ),
    ).toBe(true);
    expect(isInsufficientInventory("Some items have insufficient inventory")).toBe(true);
  });

  it("lässt andere Fehler in Ruhe", () => {
    expect(isInsufficientInventory(new Error("Payment failed"))).toBe(false);
    expect(isInsufficientInventory(undefined)).toBe(false);
  });
});

describe("describeInsufficientInventory", () => {
  it("nennt Artikel und verfügbare Menge der genannten Variante", () => {
    const msg = describeInsufficientInventory(
      new Error("Variant with id: variant_A does not have the required inventory"),
      lines,
    );
    expect(msg).toContain("«Kailar Filter»");
    expect(msg).toContain("nur noch 7 Stück");
  });

  it("nimmt ohne Variantennamen die Positionen über dem Bestand", () => {
    const msg = describeInsufficientInventory("insufficient inventory", lines);
    expect(msg).toContain("«Kailar Filter»");
    expect(msg).not.toContain("RAW Ruby");
  });

  it("sagt ausverkauft bei Bestand 0", () => {
    const msg = describeInsufficientInventory("insufficient inventory", [
      { ...lines[0], availableQuantity: 0 },
    ]);
    expect(msg).toContain("ist ausverkauft");
  });

  it("fällt ohne Treffer auf eine allgemeine Meldung zurück", () => {
    const msg = describeInsufficientInventory("insufficient inventory", []);
    expect(msg).toMatch(/nicht mehr genug an Lager/);
  });

  it("ist null bei fremden Fehlern", () => {
    expect(describeInsufficientInventory(new Error("boom"), lines)).toBeNull();
  });
});
