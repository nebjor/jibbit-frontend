import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryView, ProductView } from "@/lib/types";

/**
 * Die Sitemap führt keine tote Adresse: /shop ist nur noch eine dauerhafte
 * Umleitung und gehört deshalb nicht hinein. Kategorien hängen als Filter
 * an der Startseite (kodiert — Handles können `&` oder Umlaute tragen).
 */

vi.mock("@/lib/data", () => ({
  getProducts: vi
    .fn()
    .mockResolvedValue([{ id: "p1", handle: "elements-ultra-thin" } as ProductView]),
  getCategories: vi.fn().mockResolvedValue([
    {
      id: "c1",
      handle: "filter-&-tips",
      name: "Filter & Tips",
      description: "",
    } as CategoryView,
  ]),
}));

vi.mock("@/lib/tenant/context", () => ({
  getTenantContext: vi
    .fn()
    .mockResolvedValue({ theme: { domain: "test.jibbit.ch" } }),
}));

const { default: sitemap } = await import("./sitemap");
const { getProducts } = await import("@/lib/data");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sitemap", () => {
  // Der Normalfall dieser Tests ist die indexierbare Produktion. Ohne die
  // Variable wäre die Sitemap leer — das prüft der Block weiter unten.
  beforeEach(() => {
    vi.stubEnv("SITE_INDEXABLE", "true");
  });

  it("führt keine /shop-Adresse mehr — die wäre nur noch eine Umleitung", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(
      urls.filter((u) => new URL(u).pathname.startsWith("/shop")),
    ).toHaveLength(0);
  });

  it("führt die Startseite (den Katalog) mit höchster Priorität", async () => {
    const entries = await sitemap();
    const home = entries.find((e) => new URL(e.url).pathname === "/" && !e.url.includes("?"));
    expect(home).toBeDefined();
    expect(home?.priority).toBe(1);
  });

  it("hängt Kategorien als Filter der Startseite an — Handle kodiert", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://test.jibbit.ch/?kategorie=filter-%26-tips");
  });

  it("führt die Produktseiten weiterhin", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://test.jibbit.ch/products/elements-ultra-thin");
  });
});

/**
 * Gesperrtes Deployment (Staging): eine Sitemap ist eine Einladung zum
 * Indexieren — sie bleibt leer. Schalter: lib/seo/indexing.ts.
 */
describe("sitemap (SITE_INDEXABLE nicht gesetzt)", () => {
  it("ist leer, wenn der Schalter ausdrücklich aus ist", async () => {
    vi.stubEnv("SITE_INDEXABLE", "false");
    expect(await sitemap()).toEqual([]);
  });

  it("ist leer, wenn die Variable fehlt — sichere Voreinstellung", async () => {
    vi.stubEnv("SITE_INDEXABLE", undefined);
    expect(await sitemap()).toEqual([]);
  });

  it("fragt das Backend dafür gar nicht erst", async () => {
    vi.stubEnv("SITE_INDEXABLE", "false");
    vi.mocked(getProducts).mockClear();
    await sitemap();
    expect(getProducts).not.toHaveBeenCalled();
  });
});
