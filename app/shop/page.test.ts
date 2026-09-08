import { afterEach, describe, expect, it, vi } from "vitest";
import type { CategoryView, ProductView } from "@/lib/types";

/**
 * Leere Kategorien sagen «bald verfügbar» — als STANDARD für jede Kategorie
 * ohne Produkte, nicht als Sonderfall für eine bestimmte:
 *
 *   - Kategorie ohne Produkte  -> CategoryComingSoon, kein Produktraster,
 *     kein «0 Produkte»-Zähler daneben.
 *   - Kategorie mit Produkten  -> Raster wie bisher, kein Hinweis.
 *   - Ganz ohne Kategoriefilter bleibt der nüchterne Leerlauf-Block — eine
 *     leere Kategorie ist eine Ankündigung, ein leeres Sortiment nicht.
 */

const mocks = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getCategories: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  getProducts: mocks.getProducts,
  getCategories: mocks.getCategories,
}));

const { default: ShopPage } = await import("./page");
const { CategoryComingSoon } = await import("./CategoryComingSoon");
const { ProductCard } = await import("@/components/ProductCard");

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
  return ShopPage({ searchParams: Promise.resolve({ kategorie }) });
}

afterEach(() => vi.clearAllMocks());

describe("Shop — leere Kategorie", () => {
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

  it("liest sich als Ankündigung, nicht als Fehlschlag des Kunden", async () => {
    const hint = CategoryComingSoon({ categoryName: "Kräutermischungen" });
    const text = textOf(hint);
    expect(text).toContain("Bald verfügbar");
    expect(text).toContain("Kräutermischungen");
    // Nicht der Wortlaut der Suche oder des alten Leerlauf-Blocks.
    expect(text).not.toContain("Keine Treffer");
    expect(text).not.toContain("Nichts gefunden");
    // Weg zurück ins Sortiment.
    const links = findAll(hint, (await import("next/link")).default);
    expect(links.some((l) => l.props.href === "/shop")).toBe(true);
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

  it("unbekannter Kategorie-Parameter fällt aufs ganze Sortiment zurück — keine Ankündigung", async () => {
    const el = await render("gibts-nicht", [PRODUKT]);
    expect(findAll(el, CategoryComingSoon)).toHaveLength(0);
    expect(findAll(el, ProductCard)).toHaveLength(1);
  });
});
