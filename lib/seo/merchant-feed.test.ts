import { describe, expect, it } from "vitest";
import {
  MERCHANT_FEED_COLUMNS,
  buildMerchantFeed,
  feedPrice,
  merchantFeedRows,
  renderMerchantFeed,
  sanitize,
} from "./merchant-feed";
import { productJsonLd } from "./jsonld";
import type { CategoryView, ProductVariantView, ProductView } from "../types";

/**
 * Geprüft wird, was im Merchant Center teuer ist, wenn es falsch ist: eine
 * Zeile, die die Datei zerreisst (Tab im Titel), ein Preis mit Komma, eine
 * GTIN mit falscher Prüfziffer, ein `identifier_exists=no` bei einem
 * Markenartikel, ein Bild, das auf das Docker-Netz zeigt — und eine
 * Kategorie, die nicht stimmt.
 */

const DOMAIN = "jibbit.ch";
const HOST = "jibbit.ch";

const variant = (
  id: string,
  extra: Partial<ProductVariantView> = {},
): ProductVariantView => ({
  id,
  title: id,
  price: 1.4,
  inStock: true,
  tiers: [],
  unitsPerPack: 1,
  packType: "single",
  ...extra,
});

const product = (extra: Partial<ProductView> = {}): ProductView => ({
  id: "prod_1",
  handle: "angel-slim-filters-6mm-120stk",
  title: "Angel Slim Filters 6mm 120stk",
  brand: "Angel",
  subtitle: "6mm Slim Filter",
  description: "Slim-Filter mit 6 mm Durchmesser, 120 Filter pro Packung.",
  categoryHandle: "filter",
  currency: "CHF",
  price: 1.4,
  featured: false,
  images: ["https://api.jibbit.ch/static/angel-slim.jpg"],
  variants: [
    variant("variant_single", {
      title: "Einzeln",
      sku: "ANG-SLI-FIL-6MM-120-EA",
      tiers: [
        { minQuantity: 1, maxQuantity: 9, price: 1.4 },
        { minQuantity: 10, maxQuantity: 33, price: 1.3 },
        { minQuantity: 34, maxQuantity: null, price: 1.2 },
      ],
    }),
    variant("variant_display", {
      title: "Display (34 Stk.)",
      sku: "ANG-SLI-FIL-6MM-120-D34",
      price: 40.8,
      packType: "display",
      unitsPerPack: 34,
      image: "https://api.jibbit.ch/static/angel-display.jpg",
      tiers: [
        { minQuantity: 1, maxQuantity: 1, price: 40.8 },
        { minQuantity: 2, maxQuantity: null, price: 38 },
      ],
    }),
  ],
  ...extra,
});

const CATEGORIES: CategoryView[] = [
  { id: "c1", handle: "filter", name: "Filter", description: "" },
  { id: "c2", handle: "papers", name: "Papers", description: "" },
  { id: "c3", handle: "aschenbecher", name: "Aschenbecher", description: "" },
  { id: "c4", handle: "zubehoer", name: "Zubehör", description: "" },
];

const rowsOf = (products: ProductView[]) =>
  merchantFeedRows({ products, categories: CATEGORIES, domain: DOMAIN, host: HOST });

describe("Zeilen je Variante", () => {
  it("eine Zeile je Variante, id = SKU, Titel um die Packung ergänzt", () => {
    const rows = rowsOf([product()]);
    expect(rows.map((r) => r.id)).toEqual([
      "ANG-SLI-FIL-6MM-120-EA",
      "ANG-SLI-FIL-6MM-120-D34",
    ]);
    expect(rows[0].title).toBe("Angel Slim Filters 6mm 120stk – Einzeln");
    expect(rows[1].title).toBe("Angel Slim Filters 6mm 120stk – Display (34 Stk.)");
    expect(rows[1].custom_label_1).toBe("display");
    expect(rows[0].custom_label_1).toBe("einzeln");
  });

  it("Varianten-URL wie im JSON-LD (`?variant=<id>`)", () => {
    const rows = rowsOf([product()]);
    expect(rows[0].link).toBe(
      "https://jibbit.ch/products/angel-slim-filters-6mm-120stk?variant=variant_single",
    );
    expect(rows[1].link).toBe(
      "https://jibbit.ch/products/angel-slim-filters-6mm-120stk?variant=variant_display",
    );
  });

  it("ein Produkt mit einer Variante: eine Zeile, kanonische URL, blanker Titel", () => {
    const p = product({ variants: [product().variants[0]] });
    const rows = rowsOf([p]);
    expect(rows).toHaveLength(1);
    expect(rows[0].link).toBe("https://jibbit.ch/products/angel-slim-filters-6mm-120stk");
    expect(rows[0].title).toBe("Angel Slim Filters 6mm 120stk");
    expect(rows[0].description).toBe(
      "Slim-Filter mit 6 mm Durchmesser, 120 Filter pro Packung.",
    );
  });

  it("ohne SKU die Medusa-Varianten-ID — nie eine leere id", () => {
    const p = product({ variants: [variant("variant_x", { sku: undefined })] });
    expect(rowsOf([p])[0].id).toBe("variant_x");
  });
});

describe("Preis", () => {
  it("Preis für Menge 1 aus der ersten Staffel, Format `12.34 CHF`", () => {
    const rows = rowsOf([product()]);
    expect(rows[0].price).toBe("1.40 CHF");
    expect(rows[1].price).toBe("40.80 CHF");
  });

  it("ohne Staffeln der Variantenpreis; Gleitkomma wird gerundet", () => {
    const p = product({
      variants: [variant("v", { price: 17.900000000000002, tiers: [] })],
    });
    expect(rowsOf([p])[0].price).toBe("17.90 CHF");
    expect(feedPrice(0.5, "CHF")).toBe("0.50 CHF");
  });

  it("nennt dieselbe Zahl wie `Offer.price` im JSON-LD", () => {
    const p = product();
    const rows = rowsOf([p]);
    const ld = productJsonLd({ product: p, domain: DOMAIN, host: HOST }) as {
      hasVariant: { offers: { price: string; url: string }; image: string[] }[];
    };
    ld.hasVariant.forEach((node, i) => {
      expect(rows[i].price).toBe(`${node.offers.price} CHF`);
      expect(rows[i].link).toBe(node.offers.url);
      expect(rows[i].image_link).toBe(node.image[0]);
    });
  });
});

describe("Verfügbarkeit", () => {
  it("in_stock / out_of_stock nach der Entscheidung der Produktseite", () => {
    const p = product({
      variants: [variant("a", { inStock: true }), variant("b", { inStock: false })],
    });
    expect(rowsOf([p]).map((r) => r.availability)).toEqual([
      "in_stock",
      "out_of_stock",
    ]);
  });
});

describe("GTIN und identifier_exists", () => {
  it("gültige GTIN wird übernommen, identifier_exists = yes", () => {
    const p = product({ variants: [variant("v", { gtin: "9120089700019" })] });
    const [row] = rowsOf([p]);
    expect(row.gtin).toBe("9120089700019");
    expect(row.identifier_exists).toBe("yes");
  });

  it("ungültige Prüfziffer: keine GTIN — lieber keine als eine fremde", () => {
    const p = product({ variants: [variant("v", { gtin: "9120089700018" })] });
    expect(rowsOf([p])[0].gtin).toBe("");
  });

  it("Markenartikel ohne GTIN: identifier_exists = yes, nie `no`", () => {
    const [row] = rowsOf([product({ variants: [variant("v")] })]);
    expect(row.gtin).toBe("");
    expect(row.brand).toBe("Angel");
    expect(row.identifier_exists).toBe("yes");
  });

  it("ohne Marke und ohne GTIN bleibt identifier_exists leer", () => {
    const [row] = rowsOf([product({ brand: "", variants: [variant("v")] })]);
    expect(row.brand).toBe("");
    expect(row.identifier_exists).toBe("");
  });

  it("GTIN ohne Marke: trotzdem yes — die Nummer ist eine Kennung", () => {
    const p = product({ brand: "", variants: [variant("v", { gtin: "9120089700019" })] });
    expect(rowsOf([p])[0].identifier_exists).toBe("yes");
  });
});

describe("Bilder", () => {
  it("absolute URL über den eigenen Bildproxy, nicht die Backend-Adresse", () => {
    const [row] = rowsOf([product({ variants: [variant("v")] })]);
    expect(row.image_link).toBe("https://jibbit.ch/media/jibbit.ch/angel-slim.jpg");
  });

  it("Variante mit eigenem Bild zeigt NUR dieses (Display -> die Box)", () => {
    const rows = rowsOf([product()]);
    expect(rows[1].image_link).toBe("https://jibbit.ch/media/jibbit.ch/angel-display.jpg");
    // Das Einzelstück bekommt nicht das Bild des Displays.
    expect(rows[0].image_link).toBe("https://jibbit.ch/media/jibbit.ch/angel-slim.jpg");
  });

  it("ohne Bild bleibt image_link leer — die Zeile fällt nicht weg", () => {
    const p = product({ images: [], variants: [variant("v")] });
    const rows = rowsOf([p]);
    expect(rows).toHaveLength(1);
    expect(rows[0].image_link).toBe("");
  });

  it("fremde Bild-URLs (kein Medusa-Upload) laufen unverändert durch", () => {
    const p = product({
      images: ["https://cdn.example.com/x.jpg"],
      variants: [variant("v")],
    });
    expect(rowsOf([p])[0].image_link).toBe("https://cdn.example.com/x.jpg");
  });
});

describe("Kategorien", () => {
  const one = (extra: Partial<ProductView>) =>
    rowsOf([product({ variants: [variant("v")], ...extra })])[0];

  it("Filter und Papers: 600 Rauchzubehör, Richtlinien-Label je Gruppe", () => {
    const f = one({ categoryHandle: "filter" });
    expect(f.google_product_category).toBe("600");
    expect(f.product_type).toBe("Filter");
    expect(f.custom_label_0).toBe("tabakzubehoer-filter");

    const p = one({ categoryHandle: "papers" });
    expect(p.google_product_category).toBe("600");
    expect(p.product_type).toBe("Papers");
    expect(p.custom_label_0).toBe("tabakzubehoer-papers");
  });

  it("Aschenbecher: 4082, unkritisch", () => {
    const a = one({ categoryHandle: "aschenbecher", title: "RAW Aschenbecher Ruby" });
    expect(a.google_product_category).toBe("4082");
    expect(a.product_type).toBe("Aschenbecher");
    expect(a.custom_label_0).toBe("zubehoer-unkritisch");
  });

  it("ein Aschenbecher unter «Zubehör» wird am Titel erkannt", () => {
    const a = one({
      categoryHandle: "zubehoer",
      title: "RAW Kristallglas Aschenbecher Darkside",
    });
    expect(a.google_product_category).toBe("4082");
    expect(a.product_type).toBe("Zubehör");
  });

  it("unbekannte Kategorie: keine Google-Kategorie, kein Label — nichts erfinden", () => {
    const z = one({ categoryHandle: "zubehoer", title: "Silikon Dose ø 22mm" });
    expect(z.google_product_category).toBe("");
    expect(z.custom_label_0).toBe("");
    expect(z.product_type).toBe("Zubehör");

    const u = one({ categoryHandle: "neu-im-admin" });
    expect(u.google_product_category).toBe("");
    expect(u.product_type).toBe("");
  });
});

describe("Farbe und Material", () => {
  it("nur wenn vorhanden; Variantenmaterial vor Produktmaterial", () => {
    const rows = rowsOf([
      product({
        material: "Kristallglas",
        variants: [
          variant("a", { color: "Rot" }),
          variant("b", { material: "Silikon" }),
        ],
      }),
    ]);
    expect(rows[0].color).toBe("Rot");
    expect(rows[0].material).toBe("Kristallglas");
    expect(rows[1].color).toBe("");
    expect(rows[1].material).toBe("Silikon");
  });
});

describe("Bereinigung", () => {
  it("entfernt Tabs, Zeilenumbrüche und gerade Anführungszeichen", () => {
    expect(sanitize('Ein\tTitel\r\nmit "Zitat"  und\u000bRest')).toBe(
      "Ein Titel mit Zitat und Rest",
    );
    expect(sanitize(undefined)).toBe("");
  });

  it("Titel über 150 Zeichen wird gekürzt", () => {
    const [row] = rowsOf([product({ title: "x".repeat(200), variants: [variant("v")] })]);
    expect(row.title).toHaveLength(150);
  });

  it("eine bereinigte Zeile hat genau so viele Felder wie die Kopfzeile", () => {
    const tsv = buildMerchantFeed({
      products: [
        product({
          title: "Tab\there",
          description: 'Zeile 1\nZeile 2 "zitiert"',
          brand: "Marke\tX",
          variants: [variant("v", { title: "Ein\tzeln" })],
        }),
      ],
      categories: CATEGORIES,
      domain: DOMAIN,
      host: HOST,
    });
    const lines = tsv.split("\n");
    expect(lines[0]).toBe(MERCHANT_FEED_COLUMNS.join("\t"));
    expect(lines[1].split("\t")).toHaveLength(MERCHANT_FEED_COLUMNS.length);
    expect(lines[1]).not.toContain('"');
    expect(lines.at(-1)).toBe("");
  });
});

describe("Ausgabe", () => {
  it("Kopfzeile mit Googles Attributnamen, ohne shipping/sale_price/item_group_id", () => {
    const header = renderMerchantFeed([]).trimEnd();
    expect(header.split("\t")).toEqual([...MERCHANT_FEED_COLUMNS]);
    expect(MERCHANT_FEED_COLUMNS).not.toContain("shipping");
    expect(MERCHANT_FEED_COLUMNS).not.toContain("shipping_label");
    expect(MERCHANT_FEED_COLUMNS).not.toContain("sale_price");
    expect(MERCHANT_FEED_COLUMNS).not.toContain("item_group_id");
    expect(MERCHANT_FEED_COLUMNS).not.toContain("multipack");
  });

  it("condition ist immer new", () => {
    expect(rowsOf([product()]).every((r) => r.condition === "new")).toBe(true);
  });
});
