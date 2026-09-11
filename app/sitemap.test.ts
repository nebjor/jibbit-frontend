import { describe, expect, it, vi } from "vitest";
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

describe("sitemap", () => {
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
