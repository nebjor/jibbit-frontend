import { afterEach, describe, expect, it, vi } from "vitest";
import type { CategoryView, ProductView } from "@/lib/types";

/**
 * Die Kategorieseite (PLP) unter /kategorie/<handle>: eigener Titel, eigene
 * Beschreibung, H1, Kurztext über dem Raster, Ratgebertext und FAQ darunter,
 * Brotkrümel, Canonical, FAQPage-Schema — und das Verhalten leerer und
 * unbekannter Kategorien.
 */

const mocks = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getCategories: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  getProducts: mocks.getProducts,
  getCategories: mocks.getCategories,
}));

vi.mock("@/lib/tenant/context", () => ({
  getTenantContext: vi.fn().mockResolvedValue({
    id: "jibbit",
    host: "test.jibbit.ch",
    theme: { domain: "test.jibbit.ch", storeName: "jibbit" },
  }),
}));

const { default: CategoryPage, generateMetadata } = await import("./page");
const { CategoryComingSoon } = await import("@/app/CategoryComingSoon");
const { ProductCard } = await import("@/components/ProductCard");
const { CategoryText } = await import("@/components/CategoryText");
const { JsonLd } = await import("@/components/JsonLd");
const { default: NextLink } = await import("next/link");

const PAPERS: CategoryView = { id: "c1", handle: "papers", name: "Papers", description: "" };
const FILTER: CategoryView = { id: "c2", handle: "filter-tips", name: "Filter & Tips", description: "" };
const KRAEUTER: CategoryView = {
  id: "c3",
  handle: "kraeutermischungen",
  name: "Kräutermischungen",
  description: "",
};

const PRODUKT = { id: "p1", handle: "elements-ultra-thin", title: "Elements Ultra Thin" } as ProductView;

/* eslint-disable @typescript-eslint/no-explicit-any */
function findAll(el: any, type: unknown): any[] {
  if (el == null || typeof el !== "object") return [];
  if (Array.isArray(el)) return el.flatMap((c) => findAll(c, type));
  const self = el.type === type ? [el] : [];
  return [...self, ...findAll(el.props?.children, type)];
}

function textOf(el: any): string {
  if (el == null || typeof el === "boolean") return "";
  if (typeof el === "string" || typeof el === "number") return String(el);
  if (Array.isArray(el)) return el.map(textOf).join("");
  return textOf(el.props?.children);
}

/** Rendert Seite -> Suspense -> Inhalt und gibt den Elementbaum zurück. */
async function render(handle: string, products: ProductView[]) {
  mocks.getCategories.mockResolvedValue([PAPERS, FILTER, KRAEUTER]);
  mocks.getProducts.mockResolvedValue(products);
  const page = await CategoryPage({ params: Promise.resolve({ handle }) });
  const listing = page.props.children;
  return listing.type(listing.props);
}

/** CategoryText ist eine Funktionskomponente: einmal auswerten. */
function expand(el: any) {
  const [text] = findAll(el, CategoryText);
  return CategoryText(text.props);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

afterEach(() => vi.clearAllMocks());

describe("Kategorieseite — Inhalt", () => {
  it("lädt die Produkte der Kategorie und zeigt sie als Raster", async () => {
    const el = await render("papers", [PRODUKT]);
    expect(mocks.getProducts).toHaveBeenCalledWith({ category: "papers" });
    expect(findAll(el, ProductCard)).toHaveLength(1);
  });

  it("hat eine H1 und einen Kurztext mit dem Suchbegriff", async () => {
    const el = await render("papers", [PRODUKT]);
    const text = textOf(el);
    expect(text).toContain("Papers kaufen in der Schweiz");
    expect(text).toContain("Papers in allen gängigen Formaten");
  });

  it("zeigt Ratgebertext und FAQ unter dem Raster", async () => {
    const el = await render("papers", [PRODUKT]);
    const below = textOf(expand(el));
    expect(below).toContain("Welches Papers-Format passt zu dir?");
    expect(below).toContain("Häufige Fragen");
  });

  it("hat Brotkrümel Shop / Kategorie", async () => {
    const el = await render("papers", [PRODUKT]);
    const links = findAll(el, NextLink);
    expect(links.some((l) => l.props.href === "/" && textOf(l) === "Shop")).toBe(true);
    expect(textOf(el)).toContain("Papers");
  });

  it("verlinkt die anderen Kategorien mit beschreibendem Linktext", async () => {
    const el = await render("papers", [PRODUKT]);
    const links = findAll(expand(el), NextLink);
    const hrefs = links.map((l) => l.props.href);
    expect(hrefs).toContain("/kategorie/filter-tips");
    expect(hrefs).not.toContain("/kategorie/papers");
    const filter = links.find((l) => l.props.href === "/kategorie/filter-tips");
    expect(textOf(filter)).toBe("Filter Tips kaufen");
  });
});

describe("Kategorieseite — strukturierte Daten", () => {
  it("enthält BreadcrumbList, ItemList und FAQPage in einem @graph", async () => {
    const el = await render("papers", [PRODUKT]);
    const [ld] = findAll(el, JsonLd);
    const types = ld.props.data["@graph"].map((n: { "@type": string }) => n["@type"]);
    expect(types).toEqual(["ItemList", "BreadcrumbList", "FAQPage"]);
  });

  it("FAQPage und sichtbare FAQ sind dieselben Fragen", async () => {
    const el = await render("papers", [PRODUKT]);
    const [ld] = findAll(el, JsonLd);
    const faq = ld.props.data["@graph"].find((n: { "@type": string }) => n["@type"] === "FAQPage");
    const visible = textOf(expand(el));
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(3);
    for (const q of faq.mainEntity) {
      expect(visible).toContain(q.name);
      expect(visible).toContain(q.acceptedAnswer.text);
    }
  });

  it("Brotkrümel: Shop mit Adresse, Kategorie als letzter Eintrag ohne item", async () => {
    const el = await render("papers", [PRODUKT]);
    const [ld] = findAll(el, JsonLd);
    const crumbs = ld.props.data["@graph"].find(
      (n: { "@type": string }) => n["@type"] === "BreadcrumbList",
    );
    expect(crumbs.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Shop", item: "https://test.jibbit.ch/" },
      { "@type": "ListItem", position: 2, name: "Papers" },
    ]);
  });
});

describe("Kategorieseite — leer und unbekannt", () => {
  it("zeigt «bald verfügbar» für jede Kategorie ohne Produkte", async () => {
    const el = await render("kraeutermischungen", []);
    const hints = findAll(el, CategoryComingSoon);
    expect(hints).toHaveLength(1);
    expect(hints[0].props.categoryName).toBe("Kräutermischungen");
    expect(findAll(el, ProductCard)).toHaveLength(0);
    expect(textOf(el)).not.toContain("0 Produkte");
  });

  it("unbekanntes Handle ist ein 404", async () => {
    await expect(render("gibts-nicht", [PRODUKT])).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("kaputt kodiertes Handle ist ein 404", async () => {
    await expect(render("%E0%A4%A", [PRODUKT])).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});

describe("Kategorieseite — Metadaten", () => {
  const meta = async (handle: string) => {
    mocks.getCategories.mockResolvedValue([PAPERS, FILTER, KRAEUTER]);
    return generateMetadata({ params: Promise.resolve({ handle }) });
  };

  it("hat Titel und Beschreibung je Kategorie", async () => {
    const papers = await meta("papers");
    const filter = await meta("filter-tips");
    expect(papers.title).toMatch(/Papers kaufen/);
    expect(filter.title).toMatch(/Filter Tips kaufen/);
    expect(papers.description).not.toBe(filter.description);
  });

  it("Canonical ist die eigene Pfadadresse, kodiert", async () => {
    expect((await meta("papers")).alternates?.canonical).toBe("/kategorie/papers");
    mocks.getCategories.mockResolvedValue([{ ...PAPERS, handle: "a&b" }]);
    const m = await generateMetadata({ params: Promise.resolve({ handle: "a%26b" }) });
    expect(m.alternates?.canonical).toBe("/kategorie/a%26b");
  });

  it("unbekannte Kategorie: 404 auch in den Metadaten", async () => {
    await expect(meta("gibts-nicht")).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});
