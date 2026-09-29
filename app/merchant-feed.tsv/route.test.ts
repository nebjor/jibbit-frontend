import { afterEach, describe, expect, it, vi } from "vitest";
import type { CategoryView, ProductView } from "@/lib/types";

/**
 * Der Handler ist dünn: Mandant auflösen, Daten holen, TSV mit dem richtigen
 * Content-Type ausliefern. Geprüft wird hier genau das — und dass er den
 * Feed auch ohne SITE_INDEXABLE liefert (Staging muss abrufbar bleiben).
 * Die Zeilenlogik prüft lib/seo/merchant-feed.test.ts.
 */

const cacheCalls: unknown[][] = [];
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<string>, key: unknown[]) => {
    cacheCalls.push(key);
    return fn;
  },
}));

class CatalogUnavailableError extends Error {}

vi.mock("@/lib/data", () => ({
  CatalogUnavailableError,
  getProductsForTenant: vi.fn().mockResolvedValue([
    {
      id: "p1",
      handle: "raw-classic-rolls-slim",
      title: "RAW Classic Rolls Slim",
      brand: "RAW",
      subtitle: "",
      description: "Endlosrolle.",
      categoryHandle: "papers",
      currency: "CHF",
      price: 1.95,
      featured: false,
      images: ["https://api.jibbit.ch/static/raw-rolls.jpg"],
      variants: [
        {
          id: "variant_1",
          sku: "RAW-CLA-ROL-SLI-EA",
          title: "Einzeln",
          price: 1.95,
          inStock: true,
          tiers: [],
          unitsPerPack: 1,
          packType: "single",
          gtin: "716165280293",
        },
      ],
    } as ProductView,
  ]),
  getCategoriesForTenant: vi
    .fn()
    .mockResolvedValue([
      { id: "c1", handle: "papers", name: "Papers", description: "" } as CategoryView,
    ]),
}));

vi.mock("@/lib/tenant/context", () => ({
  getTenantContext: vi.fn().mockResolvedValue({
    id: "jibbit",
    host: "test.jibbit.ch",
    theme: { domain: "test.jibbit.ch" },
  }),
}));

const { GET } = await import("./route");
const { getProductsForTenant } = await import("@/lib/data");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /merchant-feed.tsv", () => {
  it("liefert TSV mit UTF-8-Content-Type und einer Zeile je Variante", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "text/tab-separated-values; charset=utf-8",
    );
    const body = await res.text();
    const [header, row] = body.split("\n");
    expect(header.startsWith("id\ttitle\tdescription\tlink\tcanonical_link\timage_link")).toBe(true);
    expect(row.split("\t")).toEqual(
      expect.arrayContaining([
        "RAW-CLA-ROL-SLI-EA",
        "https://test.jibbit.ch/products/raw-classic-rolls-slim",
        "https://test.jibbit.ch/media/test.jibbit.ch/raw-rolls.jpg",
        "1.95 CHF",
        "716165280293",
        "RAW",
        "CH:4.50 CHF:1:3:1:3",
        "CH:69.00 CHF",
        "in_stock",
        "600",
        "Papers",
      ]),
    );
  });

  it("ist auch ohne SITE_INDEXABLE erreichbar — Noindex sperrt nur die Suche", async () => {
    vi.stubEnv("SITE_INDEXABLE", "");
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.text()).split("\n").length).toBeGreaterThan(2);
  });

  it("cacht je Mandant — die Mandanten-ID steckt im Schlüssel", async () => {
    await GET();
    expect(cacheCalls.at(-1)).toEqual(["merchant-feed", "jibbit"]);
  });

  it("Backend weg: 503 statt eines leeren Feeds — Google behält den letzten Stand", async () => {
    vi.mocked(getProductsForTenant).mockRejectedValueOnce(
      new CatalogUnavailableError("products"),
    );
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("600");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
