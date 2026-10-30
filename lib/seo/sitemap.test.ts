import { describe, expect, it } from "vitest";
import handleData from "./handle-redirects.data.json";
import type { CategoryView, ProductView } from "../types";
import { SITEMAP_STATIC_PATHS, sitemapEntries, xmlEscape } from "./sitemap";

/**
 * Was in der Sitemap steht, ist eine Aussage an Google: «diese Adressen gibt
 * es, sie sind kanonisch, und so alt ist ihr Inhalt». Geprüft wird genau das.
 */

const NOW = new Date("2026-09-29T12:00:00.000Z");

function product(over: Partial<ProductView> = {}): ProductView {
  return {
    id: "prod_1",
    handle: "ocb-premium-kurz",
    title: "OCB Premium kurz",
    brand: "",
    subtitle: "",
    description: "",
    categoryHandle: "papers",
    currency: "CHF",
    price: 1.8,
    variants: [],
    images: [],
    featured: false,
    ...over,
  };
}

const CATEGORIES: CategoryView[] = [
  { id: "c1", handle: "papers", name: "Papers", description: "" },
  { id: "c2", handle: "filter-tips", name: "Filter & Tips", description: "" },
  { id: "c3", handle: "filter", name: "Filter", description: "" },
];

function build(products: ProductView[], categories = CATEGORIES) {
  return sitemapEntries({
    domain: "jibbit.ch",
    host: "jibbit.ch",
    products,
    categories,
    now: NOW,
  });
}

describe("sitemapEntries", () => {
  it("listet keine Kategorie, für die es eine Umleitungsregel gibt", () => {
    const urls = build([]).map((e) => e.url);
    for (const alt of Object.keys(handleData.kategorien)) {
      expect(urls).not.toContain(`https://jibbit.ch/?kategorie=${alt}`);
    }
  });

  it("führt Startseite, Rechtliches, Service, jede Kategorie und jedes Produkt", () => {
    const urls = build([
      product(),
      product({ id: "prod_2", handle: "raw-classic-rolls-slim" }),
    ]).map((e) => e.url);

    for (const path of SITEMAP_STATIC_PATHS) {
      expect(urls).toContain(`https://jibbit.ch${path}`);
    }
    expect(urls).toContain("https://jibbit.ch/?kategorie=papers");
    expect(urls).toContain("https://jibbit.ch/?kategorie=filter-tips");
    // «filter» ist umbenannt (301) und gehört nicht in die Sitemap.
    expect(urls).not.toContain("https://jibbit.ch/?kategorie=filter");
    expect(urls).toContain("https://jibbit.ch/products/ocb-premium-kurz");
    expect(urls).toContain("https://jibbit.ch/products/raw-classic-rolls-slim");
    expect(urls).toHaveLength(SITEMAP_STATIC_PATHS.length + 2 + 2);
  });

  it("nennt nur absolute https-Adressen der Mandantendomain", () => {
    for (const { url } of build([product()])) {
      expect(url.startsWith("https://jibbit.ch")).toBe(true);
    }
  });

  it("führt keine noindex-Bereiche, keine Umleitung und keine Varianten-Adressen", () => {
    const urls = build([product()]).map((e) => e.url);
    for (const url of urls) {
      const { pathname, searchParams } = new URL(url);
      expect(pathname).not.toMatch(/^\/(shop|suche|checkout|konto)(\/|$)/);
      expect(searchParams.has("variant")).toBe(false);
      // Der einzige erlaubte Parameter ist die Kategorie der Startseite.
      expect([...searchParams.keys()].filter((k) => k !== "kategorie")).toEqual([]);
    }
  });

  it("führt jede Adresse genau einmal — auch bei doppelt geliefertem Produkt", () => {
    const urls = build([product(), product()]).map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("trägt 250 Produkte vollständig — keine stille Obergrenze", () => {
    const many = Array.from({ length: 250 }, (_, i) =>
      product({ id: `prod_${i}`, handle: `produkt-${i}` }),
    );
    const urls = build(many).map((e) => e.url);
    expect(urls.filter((u) => u.includes("/products/"))).toHaveLength(250);
    expect(urls).toContain("https://jibbit.ch/products/produkt-249");
  });

  it("kodiert Kategorie-Handles mit Sonderzeichen", () => {
    const urls = build(
      [],
      [{ id: "c", handle: "filter-&-tips", name: "Filter & Tips", description: "" }],
    ).map((e) => e.url);
    expect(urls).toContain("https://jibbit.ch/?kategorie=filter-%26-tips");
  });
});

describe("sitemapEntries: lastmod", () => {
  const entry = (p: ProductView) =>
    build([p]).find((e) => e.url.includes("/products/"));

  it("übernimmt das Änderungsdatum des Produkts", () => {
    const e = entry(product({ updatedAt: "2026-09-20T08:30:00.000Z" }));
    expect(e?.lastModified).toEqual(new Date("2026-09-20T08:30:00.000Z"));
  });

  it("lässt es weg, wenn keines bekannt ist — nie «jetzt»", () => {
    expect(entry(product())).not.toHaveProperty("lastModified");
  });

  it("lässt ein unlesbares oder künftiges Datum weg", () => {
    expect(entry(product({ updatedAt: "gestern" }))).not.toHaveProperty("lastModified");
    expect(
      entry(product({ updatedAt: "2027-01-01T00:00:00.000Z" })),
    ).not.toHaveProperty("lastModified");
  });

  it("erfindet für Startseite, Kategorien und Rechtliches kein Datum", () => {
    const rest = build([product({ updatedAt: "2026-09-20T08:30:00.000Z" })]).filter(
      (e) => !e.url.includes("/products/"),
    );
    for (const e of rest) expect(e).not.toHaveProperty("lastModified");
  });
});

describe("sitemapEntries: Bilder", () => {
  const images = (p: ProductView) =>
    build([p]).find((e) => e.url.includes("/products/"))?.images;

  it("nennt Produktbilder absolut über den eigenen Bildproxy", () => {
    expect(
      images(product({ images: ["https://api.jibbit.ch/static/1788-ocb.jpg"] })),
    ).toEqual(["https://jibbit.ch/media/jibbit.ch/1788-ocb.jpg"]);
  });

  it("maskiert XML-Sonderzeichen in Bildadressen", () => {
    expect(
      images(product({ images: ["https://cdn.example.com/a.jpg?w=1&h=2"] })),
    ).toEqual(["https://cdn.example.com/a.jpg?w=1&amp;h=2"]);
  });

  it("lässt das Feld weg, wenn das Produkt kein Bild hat", () => {
    expect(
      build([product()]).find((e) => e.url.includes("/products/")),
    ).not.toHaveProperty("images");
  });
});

describe("xmlEscape", () => {
  it("maskiert die fünf XML-Zeichen", () => {
    expect(xmlEscape("a&b<c>d\"e'f")).toBe("a&amp;b&lt;c&gt;d&quot;e&apos;f");
  });
});
