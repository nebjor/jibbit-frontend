import { afterEach, describe, expect, it, vi } from "vitest";
import type { CategoryView, ProductView } from "@/lib/types";

/**
 * Die Startseite IST der Katalog («shop ist die neue startseite»):
 *
 *   - Produktraster direkt unter «/».
 *   - Das Erstbesuchs-Intro bleibt eingehängt — gleiche Choreografie, es
 *     liegt als Overlay über dem Katalog statt über der Landingpage.
 *   - Kein interner Link zeigt mehr auf /shop; die Adresse ist nur noch
 *     eine Umleitung für Links von aussen (app/shop/page.test.ts).
 *   - Kategorien haben eigene Seiten (app/kategorie/[handle]); die alte
 *     Form `/?kategorie=x` ist eine dauerhafte Umleitung dorthin.
 *   - Für die innere Verlinkung: Kategorie-Links mit beschreibendem Text und
 *     Links auf beliebte Produkte.
 */

const mocks = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getCategories: vi.fn(),
  getAktionen: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  getProducts: mocks.getProducts,
  getCategories: mocks.getCategories,
  getAktionen: mocks.getAktionen,
}));

// Die Seite zeichnet den Katalog als ItemList aus und braucht dafür die
// Domain des Mandanten. `getTenantContext` liest den Request-Header —
// ausserhalb eines Requests wirft das, also hier auflösen.
vi.mock("@/lib/tenant/context", () => ({
  getTenantContext: vi.fn().mockResolvedValue({
    id: "jibbit",
    host: "test.jibbit.ch",
    theme: { domain: "test.jibbit.ch", storeName: "jibbit" },
  }),
}));

const { default: HomePage, generateMetadata } = await import("./page");
const { ProductCard } = await import("@/components/ProductCard");
const { AktionsHero } = await import("@/components/AktionsHero");
const { HomeIntro } = await import("@/components/intro/HomeIntro");
const { default: NextLink } = await import("next/link");
const { CategoryLinks, HomeText } = await import("@/components/HomeLinks");

const PAPERS: CategoryView = {
  id: "c2",
  handle: "papers",
  name: "Papers",
  description: "Papes in allen Grössen.",
};

const FILTER: CategoryView = {
  id: "c3",
  handle: "filter-tips",
  name: "Filter & Tips",
  description: "",
};

const PRODUKT = {
  id: "p1",
  handle: "elements-ultra-thin",
  title: "Elements Ultra Thin",
  featured: true,
} as ProductView;

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Alle Elemente eines Typs im Baum — folgt nur `props.children`. */
function findAll(el: any, type: unknown): any[] {
  if (el == null || typeof el !== "object") return [];
  if (Array.isArray(el)) return el.flatMap((c) => findAll(c, type));
  const self = el.type === type ? [el] : [];
  return [...self, ...findAll(el.props?.children, type)];
}

/** Die beiden Link-Blöcke der Startseite, einmal ausgewertet. */
function linkBlocks(el: any) {
  return [
    ...findAll(el, CategoryLinks).map((c) => CategoryLinks(c.props)),
    ...findAll(el, HomeText).map((c) => HomeText(c.props)),
  ];
}

/** Der gesamte sichtbare Text des Baums, für Wortlaut-Prüfungen. */
function textOf(el: any): string {
  if (el == null || typeof el === "boolean") return "";
  if (typeof el === "string" || typeof el === "number") return String(el);
  if (Array.isArray(el)) return el.map(textOf).join("");
  return textOf(el.props?.children);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const AKTION = {
  code: "EROEFFNUNG20",
  titel: "Eröffnung 20 %",
  prozent: 20,
  giltAb: null,
  giltBis: "2026-10-30T18:30:00.000Z",
  nurTeilsortiment: false,
  aufArtikel: true,
};

async function render(
  products: ProductView[],
  aktionen: unknown[] = [],
  searchParams: Record<string, string> = {},
) {
  mocks.getAktionen.mockResolvedValue(aktionen);
  mocks.getCategories.mockResolvedValue([PAPERS, FILTER]);
  mocks.getProducts.mockResolvedValue(products);
  const page = await HomePage({ searchParams: Promise.resolve(searchParams) });
  const catalog = page.props.children[1].props.children;
  return [page, await catalog.type(catalog.props)];
}

afterEach(() => vi.clearAllMocks());

describe("Startseite — der Katalog liegt auf «/»", () => {
  it("zeigt das Produktraster direkt, ohne Landingpage dazwischen", async () => {
    const el = await render([PRODUKT]);
    expect(findAll(el, ProductCard)).toHaveLength(1);
    // Kein «Zum Shop»-Umweg mehr: die alte Landing-CTA existiert nicht.
    expect(textOf(el)).not.toContain("Zum Shop");
    expect(mocks.getProducts).toHaveBeenCalledWith();
  });

  it("hält das Erstbesuchs-Intro eingehängt — genau einmal", async () => {
    const el = await render([PRODUKT]);
    expect(findAll(el, HomeIntro)).toHaveLength(1);
  });

  it("verlinkt intern nirgends mehr auf /shop", async () => {
    const el = await render([PRODUKT]);
    const links = findAll(linkBlocks(el), NextLink);
    expect(
      links.filter((l) => String(l.props.href).startsWith("/shop")),
    ).toHaveLength(0);
  });

  it("bei leerem Sortiment der nüchterne Block", async () => {
    const el = await render([]);
    expect(textOf(el)).toContain("Nichts gefunden");
  });
});

describe("Startseite — innere Verlinkung", () => {
  it("verlinkt die Kategorien mit beschreibendem Linktext auf /kategorie/<handle>", async () => {
    const el = await render([PRODUKT]);
    const links = findAll(linkBlocks(el), NextLink);
    const hrefs = links.map((l) => String(l.props.href));
    expect(hrefs).toContain("/kategorie/papers");
    expect(hrefs).toContain("/kategorie/filter-tips");
    const papers = links.filter((l) => l.props.href === "/kategorie/papers");
    expect(papers.map((l) => textOf(l))).toContain("Papers kaufen");
    const filter = links.filter((l) => l.props.href === "/kategorie/filter-tips");
    expect(filter.map((l) => textOf(l))).toContain("Filter Tips kaufen");
    // Kein Link auf die alte Parameterform.
    expect(hrefs.filter((h) => h.includes("kategorie="))).toHaveLength(0);
  });

  it("verlinkt beliebte Produkte mit dem Produktnamen als Linktext", async () => {
    const el = await render([PRODUKT]);
    const link = findAll(linkBlocks(el), NextLink).find(
      (l) => l.props.href === "/products/elements-ultra-thin",
    );
    expect(link && textOf(link)).toBe("Elements Ultra Thin");
  });

  it("hat eine beschreibende H1", async () => {
    const el = await render([PRODUKT]);
    expect(textOf(el)).toContain("Online Headshop Schweiz");
  });
});

describe("Startseite — alte Kategorieadresse", () => {
  const redirectOf = async (searchParams: Record<string, string>) => {
    try {
      await render([PRODUKT], [], searchParams);
    } catch (e) {
      return (e as { digest?: string }).digest;
    }
    return undefined;
  };

  it("leitet /?kategorie=x dauerhaft auf /kategorie/x", async () => {
    const digest = await redirectOf({ kategorie: "papers" });
    expect(digest).toMatch(/^NEXT_REDIRECT;replace;\/kategorie\/papers;308/);
  });

  it("nimmt für die zusammengelegte Kategorie gleich das heutige Handle", async () => {
    const digest = await redirectOf({ kategorie: "filter" });
    expect(digest).toContain("/kategorie/filter-tips");
  });
});

describe("Startseite — Canonical", () => {
  it("zeigt auf «/»", async () => {
    const meta = await generateMetadata();
    expect(meta.alternates?.canonical).toBe("/");
  });
});

describe("Startseite — Hero zur laufenden Aktion", () => {
  it("zeigt den Hero über dem Katalog, mit Ende in Schweizer Zeit", async () => {
    const el = await render([PRODUKT], [AKTION]);
    const [hero] = findAll(el, AktionsHero);
    expect(hero.props.aktion.code).toBe("EROEFFNUNG20");
    expect(hero.props.bis).toBe("30. Oktober, 19:30 Uhr");
  });

  it("zeigt keinen Hero ohne Aktion oder bei Teilsortiment", async () => {
    expect(findAll(await render([PRODUKT], []), AktionsHero)).toHaveLength(0);
    const teil = { ...AKTION, nurTeilsortiment: true };
    expect(findAll(await render([PRODUKT], [teil]), AktionsHero)).toHaveLength(0);
  });
});
