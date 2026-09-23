import { describe, expect, it } from "vitest";
import type {
  StoreProduct,
  StoreProductCategory,
  StoreProductVariant,
} from "@medusajs/types";
import { toCategoryView, toProductView, toVariantView } from "./adapters";

const cat = (id: string, name: string, handle: string): StoreProductCategory =>
  ({ id, name, handle }) as StoreProductCategory;

/**
 * Regressionsfall aus dem Live-Befund: Der Adapter hat jedes unbekannte
 * Backend-Handle auf "zubehoer" gezwungen. Drei Admin-Kategorien behielten
 * ihre Namen, verlinkten aber alle auf `?kategorie=zubehoer` — daher kam
 * jeder Kategorielink im HTML mehrfach vor und mehrere Reiter waren
 * gleichzeitig „aktiv".
 */
describe("toCategoryView", () => {
  it("lässt unbekannte Handles unverändert durch — jede Kategorie behält ihren eigenen Link", () => {
    const views = [
      cat("c1", "Filter & Tips", "filter-tips"),
      cat("c2", "Aschenbecher", "aschenbecher"),
      cat("c3", "Kräutermischungen", "krautermischungen"),
    ].map(toCategoryView);

    expect(views.map((v) => v.handle)).toEqual([
      "filter-tips",
      "aschenbecher",
      "krautermischungen",
    ]);
    // Kein Kollabieren: alle Handles paarweise verschieden.
    expect(new Set(views.map((v) => v.handle)).size).toBe(3);
  });

  it("normalisiert nur Schreibweise: Umlaut und Grossschreibung", () => {
    expect(toCategoryView(cat("c1", "Zubehör", "Zubehör")).handle).toBe(
      "zubehoer",
    );
    expect(toCategoryView(cat("c2", "Papers", "PAPERS")).handle).toBe("papers");
  });

  it("behält Name und Beschreibung des Backends", () => {
    const view = toCategoryView({
      ...cat("c1", "Filter & Tips", "filter-tips"),
      description: "Tips aus Papier.",
    } as StoreProductCategory);
    expect(view.name).toBe("Filter & Tips");
    expect(view.description).toBe("Tips aus Papier.");
  });
});

/**
 * Felder für den Merchant-Center-Feed: SKU, Farbe (nur aus einer Option, die
 * «Farbe» heisst — die Packungsoption ist keine), Material.
 */
describe("toVariantView: SKU, Farbe, Material", () => {
  const options: StoreProduct["options"] = [
    { id: "opt_pack", title: "Packung" },
    { id: "opt_color", title: "Farbe" },
  ] as StoreProduct["options"];

  const v = (extra: Partial<StoreProductVariant>): StoreProductVariant =>
    ({ id: "variant_1", title: "Einzeln", ...extra }) as StoreProductVariant;

  it("übernimmt SKU und Material, leer -> undefined", () => {
    expect(toVariantView(v({ sku: "RAW-KRI-ASC-RUB-EA", material: "Kristallglas" }))).toMatchObject({
      sku: "RAW-KRI-ASC-RUB-EA",
      material: "Kristallglas",
    });
    const bare = toVariantView(v({ sku: "  ", material: null }));
    expect(bare.sku).toBeUndefined();
    expect(bare.material).toBeUndefined();
  });

  it("liest die Farbe nur aus der Option «Farbe», nicht aus «Packung»", () => {
    const colored = toVariantView(
      v({
        options: [
          { id: "ov1", option_id: "opt_pack", value: "Einzeln" },
          { id: "ov2", option_id: "opt_color", value: "Rot" },
        ] as StoreProductVariant["options"],
      }),
      [],
      options,
    );
    expect(colored.color).toBe("Rot");

    const packOnly = toVariantView(
      v({
        options: [
          { id: "ov1", option_id: "opt_pack", value: "Einzeln" },
        ] as StoreProductVariant["options"],
      }),
      [],
      options,
    );
    expect(packOnly.color).toBeUndefined();
  });

  it("toProductView reicht die Produktoptionen und das Produktmaterial durch", () => {
    const view = toProductView({
      id: "prod_1",
      handle: "x",
      title: "X",
      material: "Silikon",
      options,
      variants: [
        v({
          options: [
            { id: "ov2", option_id: "opt_color", value: "Hellgrün" },
          ] as StoreProductVariant["options"],
        }),
      ],
    } as StoreProduct);
    expect(view.material).toBe("Silikon");
    expect(view.variants[0].color).toBe("Hellgrün");
  });
});
