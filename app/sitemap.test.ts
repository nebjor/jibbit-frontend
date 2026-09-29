import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryView, ProductView } from "@/lib/types";

/**
 * Die Route selbst: Schalter, Datenabruf, Fehlerfälle. WAS in der Sitemap
 * steht, prüft lib/seo/sitemap.test.ts.
 */

const PRODUCT = {
  id: "p1",
  handle: "elements-ultra-thin",
  images: ["https://api.jibbit.ch/static/1788-elements.jpg"],
  updatedAt: "2026-09-20T08:30:00.000Z",
} as ProductView;

const CATEGORY = {
  id: "c1",
  handle: "filter-&-tips",
  name: "Filter & Tips",
  description: "",
} as CategoryView;

vi.mock("@/lib/data", () => ({
  getProducts: vi.fn(),
  getCategories: vi.fn(),
}));

const TENANT = {
  id: "jibbit",
  host: "test.jibbit.ch",
  theme: { domain: "test.jibbit.ch" },
};

vi.mock("@/lib/tenant/context", () => ({ getTenantContext: vi.fn() }));

const { default: sitemap } = await import("./sitemap");
const { getProducts, getCategories } = await import("@/lib/data");
const { getTenantContext } = await import("@/lib/tenant/context");

beforeEach(() => {
  vi.mocked(getTenantContext).mockReset().mockResolvedValue(TENANT as never);
  vi.mocked(getProducts).mockReset().mockResolvedValue([PRODUCT]);
  vi.mocked(getCategories).mockReset().mockResolvedValue([CATEGORY]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
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

  it("führt die Produktseiten mit Änderungsdatum und Bild", async () => {
    const entry = (await sitemap()).find(
      (e) => e.url === "https://test.jibbit.ch/products/elements-ultra-thin",
    );
    expect(entry?.lastModified).toEqual(new Date("2026-09-20T08:30:00.000Z"));
    expect(entry?.images).toEqual([
      "https://test.jibbit.ch/media/test.jibbit.ch/1788-elements.jpg",
    ]);
  });

  it("fragt ohne Obergrenze — das ganze Sortiment", async () => {
    await sitemap();
    expect(getProducts).toHaveBeenCalledWith();
  });
});

/**
 * Indexierbar, aber das Backend macht nicht mit. Eine Sitemap ohne Produkte
 * mit Status 200 wäre die Aussage «diese Seiten gibt es nicht mehr» — das
 * darf nie still passieren.
 */
describe("sitemap (Backend gestört)", () => {
  beforeEach(() => {
    vi.stubEnv("SITE_INDEXABLE", "true");
  });

  it("wirft, wenn der Katalog nicht abrufbar ist — und sagt es im Log", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getProducts).mockRejectedValue(new Error("Katalog nicht verfügbar"));
    await expect(sitemap()).rejects.toThrow("Katalog nicht verfügbar");
    expect(error).toHaveBeenCalledOnce();
    expect(String(error.mock.calls[0][0])).toContain("sitemap.xml");
  });

  it("meldet null Produkte als Fehler, liefert die übrigen Seiten aber aus", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getProducts).mockResolvedValue([]);
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://test.jibbit.ch/impressum");
    expect(error).toHaveBeenCalledOnce();
    expect(String(error.mock.calls[0][0])).toContain("0 Produkte");
  });

  it("meldet nichts, wenn alles da ist", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await sitemap();
    expect(error).not.toHaveBeenCalled();
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
    await sitemap();
    expect(getProducts).not.toHaveBeenCalled();
  });
});
