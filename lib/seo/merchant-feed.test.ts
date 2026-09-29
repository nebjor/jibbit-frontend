import { describe, expect, it } from "vitest";
import {
  MERCHANT_FEED_COLUMNS,
  buildMerchantFeed,
  feedHeader,
  feedPrice,
  feedShipping,
  merchantFeedRows,
  renderMerchantFeed,
  sanitize,
} from "./merchant-feed";
import { productJsonLd, productUrl } from "./jsonld";
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

  it("nicht gepflegte Marke: der Hersteller, mit dem der Titel beginnt", () => {
    const [row] = rowsOf([product({ brand: "", variants: [variant("v")] })]);
    expect(row.brand).toBe("Angel");
    expect(row.identifier_exists).toBe("yes");
  });

  it("ohne Marke und ohne GTIN bleibt identifier_exists leer", () => {
    const [row] = rowsOf([
      product({ brand: "", title: "Silikon Dose ø 22mm", variants: [variant("v")] }),
    ]);
    expect(row.brand).toBe("");
    expect(row.identifier_exists).toBe("");
  });

  it("GTIN ohne Marke: trotzdem yes — die Nummer ist eine Kennung", () => {
    const p = product({
      brand: "",
      title: "Silikon Dose ø 22mm",
      variants: [variant("v", { gtin: "9120089700019" })],
    });
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
    expect(lines[0]).toBe(MERCHANT_FEED_COLUMNS.map(feedHeader).join("\t"));
    expect(lines[1].split("\t")).toHaveLength(MERCHANT_FEED_COLUMNS.length);
    expect(lines[1]).not.toContain('"');
    expect(lines.at(-1)).toBe("");
  });
});

describe("Ausgabe", () => {
  it("Kopfzeile mit Googles Attributnamen, ohne sale_price und multipack", () => {
    const header = renderMerchantFeed([]).trimEnd().split("\t");
    expect(header).toEqual(MERCHANT_FEED_COLUMNS.map(feedHeader));
    expect(MERCHANT_FEED_COLUMNS).not.toContain("shipping_label");
    expect(MERCHANT_FEED_COLUMNS).not.toContain("sale_price");
    expect(MERCHANT_FEED_COLUMNS).not.toContain("multipack");
  });

  it("führt alles, was Google für die Schweiz verlangt", () => {
    for (const required of [
      "id",
      "title",
      "description",
      "link",
      "image_link",
      "availability",
      "price",
      "brand",
      "gtin",
      "condition",
      "shipping",
    ] as const) {
      expect(MERCHANT_FEED_COLUMNS).toContain(required);
    }
  });

  it("nennt die Unterattribute von shipping in der Kopfzeile", () => {
    expect(feedHeader("shipping")).toBe(
      "shipping(country:price:min_handling_time:max_handling_time:min_transit_time:max_transit_time)",
    );
    expect(feedHeader("price")).toBe("price");
  });

  it("condition ist immer new", () => {
    expect(rowsOf([product()]).every((r) => r.condition === "new")).toBe(true);
  });
});

/**
 * Varianten: Google fasst die Packungen eines Produkts über `item_group_id`
 * zusammen und will wissen, worin sie sich unterscheiden.
 */
describe("Varianten als Gruppe", () => {
  it("mehrere Packungen: item_group_id = Handle, size = Packung", () => {
    const rows = rowsOf([product()]);
    expect(rows.map((r) => r.item_group_id)).toEqual([
      "angel-slim-filters-6mm-120stk",
      "angel-slim-filters-6mm-120stk",
    ]);
    expect(rows.map((r) => r.size)).toEqual(["Einzeln", "Display (34 Stk.)"]);
    // Jede Packung unterscheidet sich von den anderen ihrer Gruppe.
    expect(new Set(rows.map((r) => r.size)).size).toBe(rows.length);
  });

  it("eine Packung: keine Gruppe, keine Grösse", () => {
    const [row] = rowsOf([product({ variants: [variant("v")] })]);
    expect(row.item_group_id).toBe("");
    expect(row.size).toBe("");
  });

  it("canonical_link ist in jeder Zeile die kanonische Produktadresse", () => {
    const canonical = productUrl(DOMAIN, "angel-slim-filters-6mm-120stk");
    for (const row of rowsOf([product()])) {
      expect(row.canonical_link).toBe(canonical);
      expect(row.canonical_link).not.toContain("?");
      // Der Link selbst zeigt dieselbe Seite, nur mit vorgewählter Packung.
      expect(row.link.split("?")[0]).toBe(canonical);
    }
    const [single] = rowsOf([product({ variants: [variant("v")] })]);
    expect(single.link).toBe(single.canonical_link);
  });

  it("jede id kommt genau einmal vor — auch über 250 Produkte", () => {
    const many = Array.from({ length: 250 }, (_, i) =>
      product({
        id: `prod_${i}`,
        handle: `produkt-${i}`,
        variants: [
          variant(`v_${i}_a`, { sku: `SKU-${i}-EA` }),
          variant(`v_${i}_b`, { sku: `SKU-${i}-D24` }),
        ],
      }),
    );
    const rows = rowsOf(many);
    expect(rows).toHaveLength(500);
    expect(new Set(rows.map((r) => r.id)).size).toBe(500);
  });
});

describe("Versand", () => {
  it("der eine Versandpreis samt Lieferzeit, nur in die Schweiz", () => {
    expect(feedShipping(1.4, "CHF")).toBe("CH:4.50 CHF:1:3:1:3");
    expect(rowsOf([product()])[0].shipping).toBe("CH:4.50 CHF:1:3:1:3");
  });

  it("eine Packung ab CHF 69 versendet gratis — wie im JSON-LD", () => {
    expect(feedShipping(68.99, "CHF")).toBe("CH:4.50 CHF:1:3:1:3");
    expect(feedShipping(69, "CHF")).toBe("CH:0.00 CHF:1:3:1:3");
    expect(feedShipping(99, "CHF")).toBe("CH:0.00 CHF:1:3:1:3");
  });

  it("nennt die Gratisschwelle des Warenkorbs", () => {
    for (const row of rowsOf([product()])) {
      expect(row.free_shipping_threshold).toBe("CH:69.00 CHF");
    }
  });

  it("hat so viele Werte wie die Kopfzeile Unterattribute", () => {
    const names = /\((.*)\)/.exec(feedHeader("shipping"))?.[1].split(":") ?? [];
    expect(feedShipping(1.4, "CHF").split(":")).toHaveLength(names.length);
  });
});

describe("Beschreibung und Kategorie", () => {
  it("ohne gepflegte Beschreibung steht der Titel — nie ein leeres Pflichtfeld", () => {
    const bare = { description: "", subtitle: "" };
    const [single] = rowsOf([product({ ...bare, variants: [variant("v")] })]);
    expect(single.description).toBe("Angel Slim Filters 6mm 120stk");
    const rows = rowsOf([product(bare)]);
    expect(rows[1].description).toBe("Angel Slim Filters 6mm 120stk – Display (34 Stk.)");
    expect(rows.every((r) => r.description !== "")).toBe(true);
  });

  it("«Filter & Tips» ist Rauchzubehör wie «Filter»", () => {
    const [row] = rowsOf([product({ categoryHandle: "filter-tips" })]);
    expect(row.google_product_category).toBe("600");
    expect(row.custom_label_0).toBe("tabakzubehoer-filter");
  });
});

/**
 * Feed und Seite müssen denselben Artikel unter derselben Kennung
 * beschreiben — sonst kann Google die Zeile dem Angebot nicht zuordnen.
 */
describe("Feed und JSON-LD sagen dasselbe", () => {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const packs = (p: ProductView): any[] => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const node = productJsonLd({ product: p, domain: DOMAIN, host: HOST }) as any;
    return node.hasVariant ?? [node];
  };

  const withGtin = product({
    variants: [
      variant("variant_single", { title: "Einzeln", sku: "ANG-EA", gtin: "85966789" }),
      variant("variant_display", {
        title: "Display (34 Stk.)",
        sku: "ANG-D34",
        gtin: "8595134501285",
        price: 75,
        inStock: false,
      }),
    ],
  });

  it.each([
    ["mehrere Packungen", withGtin],
    ["eine Packung", product({ variants: [withGtin.variants[0]] })],
    ["ohne Artikelnummer", product({ variants: [variant("v_a"), variant("v_b")] })],
  ])("%s: id, Preis, Verfügbarkeit, GTIN, Link, Bild, Marke", (_name, p) => {
    const rows = rowsOf([p]);
    const nodes = packs(p);
    expect(rows).toHaveLength(nodes.length);

    rows.forEach((row, i) => {
      const node = nodes[i];
      expect(row.id).toBe(node.sku);
      expect(row.price).toBe(`${node.offers.price} ${node.offers.priceCurrency}`);
      expect(row.availability).toBe(
        node.offers.availability === "https://schema.org/InStock"
          ? "in_stock"
          : "out_of_stock",
      );
      expect(row.gtin).toBe(node.gtin13 ?? node.gtin8 ?? node.gtin12 ?? node.gtin14 ?? "");
      expect(row.link).toBe(node.offers.url);
      expect(row.image_link).toBe(node.image[0]);
      expect(row.item_group_id).toBe(node.inProductGroupWithID ?? "");
      expect(row.size).toBe(nodes.length > 1 ? node.size : "");
      expect(row.shipping.split(":")[1]).toBe(
        `${node.offers.shippingDetails.shippingRate.value} CHF`,
      );
    });

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const group = productJsonLd({ product: p, domain: DOMAIN, host: HOST }) as any;
    expect(rows[0].brand).toBe(group.brand.name);
    expect(rows[0].canonical_link).toBe(group.url);
  });
});
