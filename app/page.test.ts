import { afterEach, describe, expect, it, vi } from "vitest";
import type { CategoryView, ProductView } from "@/lib/types";

/**
 * Die Startseite IST der Katalog («shop ist die neue startseite»):
 *
 *   - Produktraster direkt unter «/», samt `kategorie`-Parameter.
 *   - Das Erstbesuchs-Intro bleibt eingehängt — gleiche Choreografie, es
 *     liegt als Overlay über dem Katalog statt über der Landingpage.
 *   - Kein interner Link zeigt mehr auf /shop; die Adresse ist nur noch
 *     eine Umleitung für Links von aussen (app/shop/page.test.ts).
 *
 * Dazu das Verhalten leerer Kategorien, unverändert von /shop übernommen.
 */

const mocks = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getCategories: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  getProducts: mocks.getProducts,
  getCategories: mocks.getCategories,
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
const { CategoryComingSoon } = await import("./CategoryComingSoon");
const { ProductCard } = await import("@/components/ProductCard");
const { HomeIntro } = await import("@/components/intro/HomeIntro");
const { default: NextLink } = await import("next/link");

const KRAEUTER: CategoryView = {
  id: "c1",
  handle: "kraeutermischungen",
  name: "Kräutermischungen",
  description: "",
};

const PAPERS: CategoryView = {
  id: "c2",
  handle: "papers",
  name: "Papers",
  description: "Papes in allen Grössen.",
};

const PRODUKT = {
  id: "p1",
  handle: "elements-ultra-thin",
  title: "Elements Ultra Thin",
} as ProductView;

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Alle Elemente eines Typs im Baum — folgt nur `props.children`. */
function findAll(el: any, type: unknown): any[] {
  if (el == null || typeof el !== "object") return [];
  if (Array.isArray(el)) return el.flatMap((c) => findAll(c, type));
  const self = el.type === type ? [el] : [];
  return [...self, ...findAll(el.props?.children, type)];
}

/** Der gesamte sichtbare Text des Baums, für Wortlaut-Prüfungen. */
function textOf(el: any): string {
  if (el == null || typeof el === "boolean") return "";
  if (typeof el === "string" || typeof el === "number") return String(el);
  if (Array.isArray(el)) return el.map(textOf).join("");
  return textOf(el.props?.children);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function render(kategorie: string | undefined, products: ProductView[]) {
  mocks.getCategories.mockResolvedValue([KRAEUTER, PAPERS]);
  mocks.getProducts.mockResolvedValue(products);
  return HomePage({ searchParams: Promise.resolve({ kategorie }) });
}

afterEach(() => vi.clearAllMocks());

describe("Startseite — der Katalog liegt auf «/»", () => {
  it("zeigt das Produktraster direkt, ohne Landingpage dazwischen", async () => {
    const el = await render(undefined, [PRODUKT]);
    expect(findAll(el, ProductCard)).toHaveLength(1);
    // Kein «Zum Shop»-Umweg mehr: die alte Landing-CTA existiert nicht.
    expect(textOf(el)).not.toContain("Zum Shop");
  });

  it("filtert über den kategorie-Parameter wie früher /shop", async () => {
    await render("papers", [PRODUKT]);
    expect(mocks.getProducts).toHaveBeenCalledWith({ category: "papers" });
  });

  it("hält das Erstbesuchs-Intro eingehängt — genau einmal", async () => {
    const el = await render(undefined, [PRODUKT]);
    expect(findAll(el, HomeIntro)).toHaveLength(1);
  });

  it("verlinkt intern nirgends mehr auf /shop", async () => {
    const el = await render(undefined, [PRODUKT]);
    const links = findAll(el, NextLink);
    expect(
      links.filter((l) => String(l.props.href).startsWith("/shop")),
    ).toHaveLength(0);
  });
});

describe("Startseite — leere Kategorie (übernommen von /shop)", () => {
  it("zeigt «bald verfügbar» als Standard für jede Kategorie ohne Produkte", async () => {
    const el = await render("kraeutermischungen", []);
    const hints = findAll(el, CategoryComingSoon);
    expect(hints).toHaveLength(1);
    expect(hints[0].props.categoryName).toBe("Kräutermischungen");
    expect(findAll(el, ProductCard)).toHaveLength(0);
  });

  it("unterdrückt daneben den «0 Produkte»-Zähler", async () => {
    const el = await render("kraeutermischungen", []);
    expect(textOf(el)).not.toContain("0 Produkte");
  });

  it("liest sich als Ankündigung und führt zurück zum ungefilterten Katalog", async () => {
    const hint = CategoryComingSoon({ categoryName: "Kräutermischungen" });
    const text = textOf(hint);
    expect(text).toContain("Bald verfügbar");
    expect(text).toContain("Kräutermischungen");
    expect(text).not.toContain("Keine Treffer");
    expect(text).not.toContain("Nichts gefunden");
    // Weg zurück ins Sortiment — das liegt jetzt auf der Startseite.
    const links = findAll(hint, NextLink);
    expect(links.some((l) => l.props.href === "/")).toBe(true);
  });

  it("gefüllte Kategorie: Produktraster wie bisher, kein Hinweis", async () => {
    const el = await render("papers", [PRODUKT]);
    expect(findAll(el, CategoryComingSoon)).toHaveLength(0);
    expect(findAll(el, ProductCard)).toHaveLength(1);
  });

  it("ohne Kategoriefilter bleibt bei leerem Sortiment der nüchterne Block — keine Ankündigung", async () => {
    const el = await render(undefined, []);
    expect(findAll(el, CategoryComingSoon)).toHaveLength(0);
    expect(textOf(el)).toContain("Nichts gefunden");
  });

  it("unbekannter Kategorie-Parameter ist ein 404", async () => {
    await expect(render("gibts-nicht", [PRODUKT])).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});

describe("Startseite — Canonical", () => {
  const canonical = async (kategorie: string | undefined) => {
    mocks.getCategories.mockResolvedValue([KRAEUTER, PAPERS]);
    const meta = await generateMetadata({ searchParams: Promise.resolve({ kategorie }) });
    return meta.alternates?.canonical;
  };

  it("zeigt ohne Filter auf «/»", async () => {
    expect(await canonical(undefined)).toBe("/");
  });

  it("zeigt je Kategorie auf ihre eigene Adresse", async () => {
    expect(await canonical("papers")).toBe("/?kategorie=papers");
  });
});
