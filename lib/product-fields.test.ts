import { describe, expect, it } from "vitest";
import { PRODUCT_FIELDS } from "./data";
import { toVariantView } from "./adapters";

/**
 * Regression: der Shop zeigte JEDEN Artikel als «ausverkauft», obwohl im Admin
 * tausend Stueck lagen.
 *
 * Ursache war keine falsche Logik, sondern eine Luecke in der Feldliste:
 * Medusa v2 liefert `inventory_quantity`, `manage_inventory` und
 * `allow_backorder` nur, wenn man sie ausdruecklich anfordert. Fehlen sie,
 * liest `toVariantView()` `undefined`, macht daraus 0 — und der Laden ist
 * leer. Ohne Warnung, ohne Fehlermeldung.
 *
 * Diese Tests halten beide Haelften fest: dass die Felder angefordert werden,
 * und was passiert, wenn sie es nicht werden.
 */
describe("PRODUCT_FIELDS", () => {
  it("fordert die drei Felder an, an denen die Verfuegbarkeit haengt", () => {
    expect(PRODUCT_FIELDS).toContain("variants.inventory_quantity");
    expect(PRODUCT_FIELDS).toContain("variants.manage_inventory");
    expect(PRODUCT_FIELDS).toContain("variants.allow_backorder");
  });

  it("fordert weiterhin Preise, Bilder, Kategorien und Metadaten an", () => {
    for (const f of [
      "variants.calculated_price",
      "images",
      "categories",
      "tags",
      "metadata",
    ]) {
      expect(PRODUCT_FIELDS).toContain(f);
    }
  });
});

describe("Verfuegbarkeit einer Variante", () => {
  const variant = (extra: Record<string, unknown>) =>
    toVariantView({ id: "v", title: "Standard", ...extra } as never, []);

  it("ist vorraetig, wenn die Bestandsfuehrung aus ist", () => {
    expect(variant({ manage_inventory: false }).inStock).toBe(true);
  });

  it("ist vorraetig bei Nachbestellung trotz Bestand null", () => {
    expect(
      variant({ manage_inventory: true, allow_backorder: true, inventory_quantity: 0 })
        .inStock,
    ).toBe(true);
  });

  it("ist vorraetig bei positivem Bestand", () => {
    expect(
      variant({ manage_inventory: true, inventory_quantity: 1000 }).inStock,
    ).toBe(true);
  });

  it("ist ausverkauft bei Bestand null", () => {
    expect(
      variant({ manage_inventory: true, inventory_quantity: 0 }).inStock,
    ).toBe(false);
  });

  it("GENAU DIESER FALL war der Fehler: gar keine Bestandsfelder", () => {
    // So sah die Antwort aus, solange die Felder nicht angefordert wurden.
    expect(variant({}).inStock).toBe(false);
  });
});
