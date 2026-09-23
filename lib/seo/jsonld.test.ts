import { describe, expect, it } from "vitest";
import {
  breadcrumbJsonLd,
  graph,
  itemListJsonLd,
  money,
  organizationJsonLd,
  priceValidUntil,
  productJsonLd,
  serializeJsonLd,
  shippingServiceJsonLd,
  variantUrl,
  webSiteJsonLd,
} from "./jsonld";
import { BUSINESS, SHIPPING, STORE } from "../config";
import type { ProductVariantView, ProductView } from "../types";

/**
 * Was hier geprüft wird, ist nicht die Form, sondern die AUSSAGE.
 *
 * Ein Schema ist eine Zusage an Google: dieser Preis, diese Verfügbarkeit,
 * diese Rückgabe. Hält sie nicht, kostet das Sichtbarkeit — und zwar ohne
 * Fehlermeldung irgendwo im Shop. Deshalb liegen die Testfälle auf den
 * Stellen, an denen eine falsche Zahl teuer wird: gerechnete Staffelpreise,
 * ausverkaufte Varianten, die Rückgaberegel, und die Frage, welcher Betrieb
 * auf einer fremden Mandantendomain überhaupt genannt werden darf.
 */

const DOMAIN = STORE.domain; // jibbit.ch — die eigene Domain
const HOST = "jibbit.ch";
const NOW = new Date("2026-09-20T10:00:00Z");

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
    variant("v_single", {
      title: "Einzeln",
      tiers: [
        { minQuantity: 1, maxQuantity: 9, price: 1.4 },
        { minQuantity: 10, maxQuantity: 33, price: 1.3 },
        { minQuantity: 34, maxQuantity: null, price: 1.2 },
      ],
    }),
    variant("v_display", {
      title: "Display (34 Stk.)",
      price: 40.8,
      packType: "display",
      unitsPerPack: 34,
      tiers: [
        { minQuantity: 1, maxQuantity: 1, price: 40.8 },
        { minQuantity: 2, maxQuantity: null, price: 38 },
      ],
    }),
  ],
  ...extra,
});

/* eslint-disable @typescript-eslint/no-explicit-any */
const build = (extra: Partial<ProductView> = {}): any =>
  productJsonLd({ product: product(extra), domain: DOMAIN, host: HOST, now: NOW });

/** Eine Packung = ein `Product`: die Varianten der Gruppe oder das Produkt selbst. */
const packsOf = (node: any): any[] => node.hasVariant ?? [node];

const pack = (node: any, sku: string): any =>
  packsOf(node).find((p) => p.sku === sku);

const offer = (node: any, sku: string): any => pack(node, sku).offers;

const gtinKeys = (o: object) => Object.keys(o).filter((k) => k.startsWith("gtin"));
/* eslint-enable @typescript-eslint/no-explicit-any */

const PAGE = "https://jibbit.ch/products/angel-slim-filters-6mm-120stk";

describe("Produkt — Form", () => {
  it("mehrere Packungen: ProductGroup mit je einem Product pro Packung", () => {
    const node = build();
    expect(node["@type"]).toBe("ProductGroup");
    expect(node.productGroupID).toBe("angel-slim-filters-6mm-120stk");
    // Googles geschlossene Liste — die Packungseinheit läuft als Grösse.
    expect(node.variesBy).toEqual(["https://schema.org/size"]);
    expect(node.hasVariant.map((v: { "@type": string }) => v["@type"])).toEqual([
      "Product",
      "Product",
    ]);
    // Die Gruppe selbst ist kein Angebot und trägt keine Artikelkennung.
    expect(node.offers).toBeUndefined();
    expect(node.sku).toBeUndefined();
  });

  it("jede Packung hat Kennung, genaueren Namen, Grösse, Bild und EIN Offer", () => {
    const display = pack(build(), "v_display");
    expect(display.name).toBe("Angel Slim Filters 6mm 120stk – Display (34 Stk.)");
    expect(display.size).toBe("Display (34 Stk.)");
    expect(display.image).toEqual([
      "https://jibbit.ch/media/jibbit.ch/angel-slim.jpg",
    ]);
    expect(display.offers["@type"]).toBe("Offer");
    // Pflichtfelder eines Händlereintrags.
    expect(display.offers.price).toBe("40.80");
    expect(display.offers.priceCurrency).toBe("CHF");
  });

  it("zeigt an der Packung ihr EIGENES Bild, wenn sie eines hat", () => {
    const [a, b] = product().variants;
    const node = build({
      images: [
        "https://api.jibbit.ch/static/angel-slim.jpg",
        "https://api.jibbit.ch/static/angel-box.jpg",
      ],
      variants: [a, { ...b, image: "https://api.jibbit.ch/static/angel-box.jpg" }],
    });
    expect(pack(node, "v_display").image).toEqual([
      "https://jibbit.ch/media/jibbit.ch/angel-box.jpg",
    ]);
    // Ohne eigenes Bild: die Produktbilder — ohne das der ANDEREN Packung.
    expect(pack(node, "v_single").image).toEqual([
      "https://jibbit.ch/media/jibbit.ch/angel-slim.jpg",
    ]);
    // Die Gruppe zeigt alle.
    expect(node.image).toHaveLength(2);
  });

  it("eine einzelne Packung bleibt ein blankes Product mit einem Offer", () => {
    const node = build({ variants: [variant("v_only")] });
    expect(node["@type"]).toBe("Product");
    expect(node.hasVariant).toBeUndefined();
    expect(node.variesBy).toBeUndefined();
    expect(node.productGroupID).toBeUndefined();
    expect(node.sku).toBe("v_only");
    expect(node.offers["@type"]).toBe("Offer");
    expect(node.offers.price).toBe("1.40");
  });

  it("verwendet nirgends ein AggregateOffer — Google will es für Varianten nicht", () => {
    expect(JSON.stringify(build())).not.toContain("AggregateOffer");
  });
});

describe("Produkt — URLs", () => {
  it("die Gruppe trägt die kanonische Adresse, jede Packung ihre eigene", () => {
    const node = build();
    expect(node.url).toBe(PAGE);
    expect(offer(node, "v_single").url).toBe(`${PAGE}?variant=v_single`);
    expect(offer(node, "v_display").url).toBe(`${PAGE}?variant=v_display`);
  });

  it("kodiert die Varianten-ID in der URL", () => {
    expect(variantUrl("jibbit.ch", "raw", "a b&c")).toBe(
      "https://jibbit.ch/products/raw?variant=a%20b%26c",
    );
  });

  it("eine einzelne Packung wird unter der kanonischen Adresse angeboten", () => {
    const node = build({ variants: [variant("v_only")] });
    expect(node.offers.url).toBe(PAGE);
  });
});

describe("Produkt — Preise", () => {
  it("nennt je Packung den Preis für EIN Stück, als Zeichenkette mit zwei Stellen", () => {
    const node = build();
    expect(offer(node, "v_single").price).toBe("1.40");
    expect(offer(node, "v_display").price).toBe("40.80");
  });

  it("rundet gerechnete Beträge, statt Gleitkommareste auszuliefern", () => {
    // 40.8 / 34 ist in IEEE-754 nicht 1.2 — käme das ungerundet raus, stünde
    // «1.2000000000000002» als Preis im Schema.
    expect(money(40.8 / 34)).toBe("1.20");
  });

  it("führt die Rabattstufen mit Mengenfenster, oben offen", () => {
    const specs = offer(build(), "v_single").priceSpecification;
    expect(specs.map((s: { price: string }) => s.price)).toEqual(["1.30", "1.20"]);
    expect(specs[0].eligibleQuantity).toMatchObject({
      minValue: 10,
      maxValue: 33,
      unitCode: "H87",
    });
    // Oberste Stufe: kein maxValue — nicht `null`, sondern gar nicht da.
    expect(specs[1].eligibleQuantity.minValue).toBe(34);
    expect("maxValue" in specs[1].eligibleQuantity).toBe(false);
  });

  it("lässt Google nur EINEN aktiven Preis finden: den für ein Stück", () => {
    // Google liest `Offer.price` und übergeht `priceSpecification`. Damit das
    // auch für strengere Leser stimmt: keine Stufe ohne Mengenbedingung, keine
    // ab 1 Stück, kein `priceType` an einer Stufe, kein `referenceQuantity`
    // (das liest Google als Grundpreis und kennt «Stück» dort nicht).
    for (const p of packsOf(build())) {
      expect(p.offers.priceSpecification.length).toBeGreaterThan(0);
      for (const spec of p.offers.priceSpecification) {
        expect(spec.eligibleQuantity.minValue).toBeGreaterThan(1);
        expect(spec.priceType).toBeUndefined();
        expect(spec.referenceQuantity).toBeUndefined();
        expect(Number(spec.price)).toBeLessThan(Number(p.offers.price));
      }
    }
  });

  it("ohne Staffel keine Staffel — ein Preis ist keine Preisliste", () => {
    const node = build({ variants: [variant("v_only")] });
    expect(node.offers.priceSpecification).toBeUndefined();
  });

  it("zeichnet einen durchgestrichenen «statt»-Preis als StrikethroughPrice aus", () => {
    const node = build({
      variants: [variant("v_sale", { price: 1.4, compareAt: 1.95 })],
    });
    expect(node.offers.priceSpecification).toEqual([
      {
        "@type": "UnitPriceSpecification",
        priceType: "https://schema.org/StrikethroughPrice",
        price: "1.95",
        priceCurrency: "CHF",
      },
    ]);
    // Der aktive Preis bleibt am Offer.
    expect(node.offers.price).toBe("1.40");
  });

  it("sagt, wie viele Stück WOVON in einer Packung stecken", () => {
    expect(offer(build(), "v_display").includesObject).toMatchObject({
      amountOfThisGood: 34,
      unitCode: "H87",
      // Das Einzelstück desselben Produkts — nicht die Packung selbst.
      typeOfGood: { "@id": `${PAGE}#variant-v_single` },
    });
    // Ein Einzelstück braucht die Angabe nicht.
    expect(offer(build(), "v_single").includesObject).toBeUndefined();
  });

  it("eine Box ohne Einzelstück im Sortiment verweist nicht auf sich selbst", () => {
    const node = build({
      variants: [variant("v_box", { packType: "box", unitsPerPack: 50, price: 12 })],
    });
    expect(node.offers.includesObject.typeOfGood).toEqual({
      "@type": "Product",
      name: "Angel Slim Filters 6mm 120stk",
    });
  });

  it("gibt dem Preis ein Gültigkeitsdatum ein Jahr voraus", () => {
    expect(priceValidUntil(NOW)).toBe("2027-09-20");
    expect(offer(build(), "v_single").priceValidUntil).toBe("2027-09-20");
  });
});

describe("Produkt — Verfügbarkeit", () => {
  it("meldet die Verfügbarkeit je Packung, nicht gemittelt", () => {
    const node = build({
      variants: [
        variant("v_single", { inStock: false }),
        variant("v_display", { inStock: true, unitsPerPack: 34 }),
      ],
    });
    expect(offer(node, "v_single").availability).toBe(
      "https://schema.org/OutOfStock",
    );
    expect(offer(node, "v_display").availability).toBe(
      "https://schema.org/InStock",
    );
  });
});

describe("Produkt — Versand und Rückgabe", () => {
  it("ein Versandpreis für jede Packung, in die Schweiz", () => {
    for (const id of ["v_single", "v_display"]) {
      const shipping = offer(build(), id).shippingDetails;
      expect(shipping.shippingRate).toEqual({
        "@type": "MonetaryAmount",
        value: money(SHIPPING.rate),
        currency: "CHF",
      });
      expect(shipping.shippingDestination.addressCountry).toBe("CH");
    }
    expect(
      offer(build(), "v_single").shippingDetails.deliveryTime.handlingTime,
    ).toMatchObject({ minValue: 1, maxValue: 3, unitCode: "DAY" });
  });

  it("eine Packung über der Gratisversand-Schwelle: Versand 0", () => {
    const node = build({
      variants: [
        variant("v_single"),
        variant("v_display", { price: 72, unitsPerPack: 50, packType: "box" }),
      ],
    });
    expect(offer(node, "v_display").shippingDetails.shippingRate.value).toBe("0.00");
    expect(offer(node, "v_single").shippingDetails.shippingRate.value).toBe(
      money(SHIPPING.rate),
    );
  });

  it("verspricht KEIN Rückgaberecht bei Sinneswandel", () => {
    // jibbit gewährt keines (/service/rueckgabe). Ein Schema, das eines
    // behauptet, ist ein Abgleichsfehler im Merchant Center — kein Vorteil.
    const policy = organizationJsonLd({ domain: DOMAIN, storeName: "jibbit" })
      .hasMerchantReturnPolicy as Record<string, unknown>;
    expect(policy.returnPolicyCategory).toBe(
      "https://schema.org/MerchantReturnNotPermitted",
    );
    expect(policy.applicableCountry).toBe("CH");
    // Das Angebot verweist nur — eine Regel, ein Ort.
    for (const p of packsOf(build())) {
      expect(p.offers.hasMerchantReturnPolicy).toEqual({
        "@id": "https://jibbit.ch/#returnpolicy",
      });
    }
  });
});

describe("Produkt — GTIN", () => {
  const GTIN8 = "85966789";
  const GTIN12 = "716165280293";
  const GTIN13 = "8595134501285";

  const withGtins = (single?: string, display?: string) => {
    const [a, b] = product().variants;
    return build({
      variants: [
        { ...a, gtin: single },
        { ...b, gtin: display },
      ],
    });
  };

  it("hängt die Nummer an das PRODUCT dieser Packung, mit der zur Länge passenden Eigenschaft", () => {
    const node = withGtins(GTIN8, GTIN13);
    expect(pack(node, "v_single").gtin8).toBe(GTIN8);
    expect(pack(node, "v_display").gtin13).toBe(GTIN13);
    // Nie das allgemeine `gtin` daneben, nie die Eigenschaft der anderen Länge.
    expect(gtinKeys(pack(node, "v_single"))).toEqual(["gtin8"]);
    expect(gtinKeys(pack(node, "v_display"))).toEqual(["gtin13"]);
  });

  it("nie am Offer — dort liest Google sie nicht — und nie an der Gruppe", () => {
    const node = withGtins(GTIN8, GTIN13);
    expect(gtinKeys(node)).toEqual([]);
    for (const p of packsOf(node)) expect(gtinKeys(p.offers)).toEqual([]);
  });

  it("gibt eine UPC-A als gtin12 aus", () => {
    expect(pack(withGtins(GTIN12), "v_single").gtin12).toBe(GTIN12);
  });

  it("nur eine Packung hat eine Nummer: die andere bleibt ohne, statt sie zu erben", () => {
    const node = withGtins(GTIN8, undefined);
    expect(pack(node, "v_single").gtin8).toBe(GTIN8);
    expect(gtinKeys(pack(node, "v_display"))).toEqual([]);
  });

  it("genau eine Packung: die Nummer steht am Produkt", () => {
    const node = build({ variants: [variant("v_only", { gtin: GTIN12 })] });
    expect(node.gtin12).toBe(GTIN12);
    expect(gtinKeys(node.offers)).toEqual([]);
  });

  it("falsche Prüfziffer, Buchstaben, falsche Länge: es geht NICHTS raus", () => {
    for (const bad of ["8595134501286", "85966A89", "859513450128", "123", ""]) {
      const only = build({ variants: [variant("v_only", { gtin: bad })] });
      expect(JSON.stringify(only)).not.toContain("gtin");
      expect(JSON.stringify(withGtins(bad, bad))).not.toContain("gtin");
    }
  });

  it("ohne GTIN bleibt jede Packung über ihre sku eindeutig", () => {
    const node = build();
    expect(JSON.stringify(node)).not.toContain("gtin");
    expect(packsOf(node).map((p) => p.sku)).toEqual(["v_single", "v_display"]);
  });
});

describe("Produkt — Rest", () => {
  it("macht Bild-URLs absolut und leitet sie über die eigene Domain", () => {
    // Die Medusa-URL zeigt auf das Backend; ein Crawler käme dort nicht hin.
    expect(build().image).toEqual([
      "https://jibbit.ch/media/jibbit.ch/angel-slim.jpg",
    ]);
  });

  it("markiert die Ware als nichts für Kinder — aber nicht als Tabak", () => {
    expect(build().hasAdultConsideration).toBe(
      "https://schema.org/ReducedRelevanceForChildrenConsideration",
    );
  });

  it("erfindet keine Bewertungen", () => {
    const node = build();
    expect(node.aggregateRating).toBeUndefined();
    expect(node.review).toBeUndefined();
  });

  it("lässt die Marke weg, statt sie leer zu setzen", () => {
    expect("brand" in build({ brand: "" })).toBe(false);
  });

  it("führt Gemeinsames einmal an der Gruppe, nicht an jeder Packung", () => {
    const node = build();
    expect(node.brand).toEqual({ "@type": "Brand", name: "Angel" });
    for (const p of packsOf(node)) expect(p.brand).toBeUndefined();
  });

  it("verknüpft Gruppe, Packung, Angebot und Verkäufer über stabile Kennungen", () => {
    const node = build();
    expect(node["@id"]).toBe(`${PAGE}#product`);
    expect(pack(node, "v_single")["@id"]).toBe(`${PAGE}#variant-v_single`);
    expect(offer(node, "v_single")["@id"]).toBe(`${PAGE}#offer-v_single`);
    expect(offer(node, "v_single").seller).toEqual({
      "@id": "https://jibbit.ch/#organization",
    });
  });
});

describe("Organisation", () => {
  it("nennt auf der eigenen Domain die volle Anbieterkennzeichnung", () => {
    const org = organizationJsonLd({ domain: DOMAIN, storeName: "jibbit" });
    expect(org.legalName).toBe(BUSINESS.legalName);
    expect(org.telephone).toBe(BUSINESS.telephone);
    expect(org.address).toMatchObject({
      streetAddress: BUSINESS.street,
      postalCode: BUSINESS.postalCode,
      addressCountry: "CH",
    });
  });

  it("nennt sie auf einer FREMDEN Mandantendomain nicht", () => {
    // Sonst trüge der Shop eines anderen Betreibers maschinenlesbar jibbits
    // Adresse, Telefonnummer und Rückgaberegel.
    const org = organizationJsonLd({
      domain: "shop.example",
      storeName: "Beispielshop",
    });
    expect(org.legalName).toBeUndefined();
    expect(org.address).toBeUndefined();
    expect(org.telephone).toBeUndefined();
    expect(org.hasMerchantReturnPolicy).toBeUndefined();
    expect(org.hasShippingService).toBeUndefined();
    // Name und Adresse der Website bleiben natürlich die des Mandanten.
    expect(org.name).toBe("Beispielshop");
    expect(org.url).toBe("https://shop.example");
  });

  it("führt die Versandregel mit Gratisversand-Schwelle — ohne Überlappung", () => {
    const org = organizationJsonLd({ domain: DOMAIN, storeName: "jibbit" });
    expect(org.hasShippingService).toEqual(shippingServiceJsonLd(DOMAIN));
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const [below, free] = (org.hasShippingService as any).shippingConditions;
    // Google nimmt bei Überlappung das Günstigste — die Fenster dürfen sich
    // deshalb nicht berühren.
    expect(below.orderValue.maxValue).toBe("68.99");
    expect(below.shippingRate.value).toBe(money(SHIPPING.rate));
    expect(free.orderValue.minValue).toBe(money(SHIPPING.freeThreshold));
    expect("maxValue" in free.orderValue).toBe(false);
    expect(free.shippingRate.value).toBe("0.00");
    for (const c of [below, free]) {
      expect(c.shippingDestination.addressCountry).toBe("CH");
      expect(c.transitTime.duration).toMatchObject({ minValue: 1, maxValue: 3 });
    }
  });

  it("trägt keine LocalBusiness-Felder — der schema.org-Validator streicht sie an", () => {
    const org = organizationJsonLd({ domain: DOMAIN, storeName: "jibbit" });
    expect(org["@type"]).toEqual(["Organization", "OnlineStore"]);
    expect("paymentAccepted" in org).toBe(false);
    expect("currenciesAccepted" in org).toBe(false);
  });

  it("führt kein Logo, solange es keins gibt", () => {
    expect("logo" in organizationJsonLd({ domain: DOMAIN, storeName: "jibbit" })).toBe(
      false,
    );
  });
});

describe("Website", () => {
  it("beschreibt die Suche unter ihrer echten Adresse", () => {
    const site = webSiteJsonLd({ domain: DOMAIN, storeName: "jibbit" });
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    expect((site.potentialAction as any).target.urlTemplate).toBe(
      "https://jibbit.ch/suche?q={search_term_string}",
    );
    expect(site.publisher).toEqual({ "@id": "https://jibbit.ch/#organization" });
  });
});

describe("Brotkrümel und Listen", () => {
  it("zählt ab 1 und lässt die aktuelle Seite ohne Link", () => {
    const crumbs = breadcrumbJsonLd([
      { name: "Shop", url: "https://jibbit.ch/" },
      { name: "Filter & Tips", url: "https://jibbit.ch/?kategorie=filter" },
      { name: "Angel Slim" },
    ]);
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const items = crumbs.itemListElement as any[];
    expect(items.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(items[2].item).toBeUndefined();
  });

  it("listet Produkte in der angezeigten Reihenfolge, nur als Verweis", () => {
    const list = itemListJsonLd({
      products: [product(), product({ handle: "raw-classic", title: "RAW" })],
      domain: DOMAIN,
      name: "Sortiment",
    });
    expect(list.numberOfItems).toBe(2);
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const items = list.itemListElement as any[];
    expect(items[1]).toMatchObject({
      position: 2,
      url: "https://jibbit.ch/products/raw-classic",
    });
    // Keine Preise in der Liste — die stehen auf der Produktseite.
    expect(items[0].offers).toBeUndefined();
  });
});

describe("Ausgabe", () => {
  it("bündelt mehrere Knoten unter einem @context", () => {
    const g = graph(build(), breadcrumbJsonLd([{ name: "Shop" }]), undefined);
    expect(g["@context"]).toBe("https://schema.org");
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    expect((g["@graph"] as any[]).map((n) => n["@type"])).toEqual([
      "ProductGroup",
      "BreadcrumbList",
    ]);
  });

  it("escapt `<`, damit ein Produkttext das Skript nicht beenden kann", () => {
    const html = serializeJsonLd(
      build({ description: "Achtung </script><img src=x onerror=alert(1)>" }),
    );
    expect(html).not.toContain("</script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<");
    expect(html).toContain("\\u003c/script");
    // Und es bleibt gültiges JSON mit unverändertem Text — an der Gruppe UND
    // an jeder Packung, die die Beschreibung übernimmt.
    const parsed = JSON.parse(html);
    expect(parsed["@graph"] === undefined).toBe(true);
    expect(parsed.description).toContain("</script>");
    expect(parsed.hasVariant[0].description).toContain("</script>");
  });

  it("escapt auch Varianten-Titel und -IDs, die in Namen und URLs landen", () => {
    const [a, b] = product().variants;
    const html = serializeJsonLd(
      build({
        variants: [{ ...a, id: "v<1>", title: "</script><b>Einzeln" }, b],
      }),
    );
    expect(html).not.toContain("<");
    // In der URL ist die ID zusätzlich prozentkodiert.
    expect(JSON.parse(html).hasVariant[0].offers.url).toBe(
      `${PAGE}?variant=v%3C1%3E`,
    );
  });
});
