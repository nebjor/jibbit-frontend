import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const down = () => Promise.reject(new TypeError("fetch failed"));
const sdk = {
  store: {
    region: { list: vi.fn(down) },
    category: { list: vi.fn(down) },
    product: { list: vi.fn(down) },
  },
  client: {
    fetch: vi.fn<(...args: unknown[]) => Promise<unknown>>(down),
  },
};

vi.mock("@/lib/tenant/context", () => ({
  getTenantContext: vi.fn(async () => ({ id: "jibbit" })),
}));
vi.mock("./medusa", () => ({
  isBackendConfigured: () => true,
  getSdkForTenant: () => sdk,
}));

import {
  CatalogUnavailableError,
  getCategories,
  getProduct,
  getProducts,
  getStaticProductHandles,
  getAktionen,
} from "./data";
import { MOCK_PRODUCTS } from "./mock-catalog";

describe("catalog with the backend down", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("dev/test: serves the mock catalog", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect((await getProducts()).length).toBeGreaterThan(0);
    expect(await getProduct(MOCK_PRODUCTS[0].handle)).toBeDefined();
    expect(getStaticProductHandles().length).toBeGreaterThan(0);
  });

  it("production: never the mock — products fail loudly, the nav degrades to empty", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(getProducts()).rejects.toBeInstanceOf(CatalogUnavailableError);
    await expect(getProduct(MOCK_PRODUCTS[0].handle)).rejects.toBeInstanceOf(
      CatalogUnavailableError,
    );
    expect(await getCategories()).toEqual([]);
    expect(getStaticProductHandles()).toEqual([]);
  });

  it("retries the region lookup instead of caching the failure", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const before = sdk.store.region.list.mock.calls.length;
    await getProducts();
    await getProducts();
    expect(sdk.store.region.list.mock.calls.length - before).toBe(2);
  });
});

/**
 * Das ganze Sortiment, seitenweise. Die frühere feste Obergrenze von 100
 * hätte das 101. Produkt still aus Sitemap und Merchant-Feed fallen lassen.
 */
describe("catalog beyond one page", () => {
  const page = (from: number, size: number) =>
    Array.from({ length: size }, (_, i) => ({
      id: `prod_${from + i}`,
      handle: `produkt-${from + i}`,
      title: `Produkt ${from + i}`,
      variants: [],
    }));

  /** Die Abfragen, mit denen die Store-API aufgerufen wurde. */
  const queries = () =>
    (sdk.store.product.list.mock.calls as unknown[][]).map(
      ([q]) => q as { limit: number; offset: number },
    );

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    sdk.store.region.list.mockResolvedValue({
      regions: [{ id: "reg_ch", countries: [{ iso_2: "ch" }] }],
    } as never);
    sdk.store.product.list.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    sdk.store.region.list.mockImplementation(down);
    sdk.store.product.list.mockImplementation(down);
  });

  it("holt alle Seiten, bis `count` erreicht ist", async () => {
    sdk.store.product.list
      .mockResolvedValueOnce({ products: page(0, 100), count: 230 } as never)
      .mockResolvedValueOnce({ products: page(100, 100), count: 230 } as never)
      .mockResolvedValueOnce({ products: page(200, 30), count: 230 } as never);

    const products = await getProducts();

    expect(products).toHaveLength(230);
    expect(products.at(-1)?.handle).toBe("produkt-229");
    expect(
      queries().map((q) => [q.limit, q.offset]),
    ).toEqual([
      [100, 0],
      [100, 100],
      [100, 200],
    ]);
  });

  it("fragt bei genau einer vollen Seite nicht endlos weiter", async () => {
    sdk.store.product.list.mockResolvedValueOnce({
      products: page(0, 100),
      count: 100,
    } as never);
    expect(await getProducts()).toHaveLength(100);
    expect(sdk.store.product.list).toHaveBeenCalledTimes(1);
  });

  it("ein ausdrückliches `limit` bleibt eine einzige Anfrage", async () => {
    sdk.store.product.list.mockResolvedValueOnce({
      products: page(0, 5),
      count: 230,
    } as never);
    expect(await getProducts({ limit: 5 })).toHaveLength(5);
    expect(sdk.store.product.list).toHaveBeenCalledTimes(1);
    expect(queries()[0]).toMatchObject({ limit: 5 });
  });

  it("scheitert eine spätere Seite, scheitert der ganze Abruf — kein halber Katalog", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    sdk.store.product.list
      .mockResolvedValueOnce({ products: page(0, 100), count: 230 } as never)
      .mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(getProducts()).rejects.toBeInstanceOf(CatalogUnavailableError);
  });
});

/** Aktionsbanner: nie ein Fehler, höchstens kein Banner. */
describe("getAktionen", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    sdk.client.fetch.mockReset();
  });

  it("holt /store/aktionen mit 60 s Cache und mappt die laufenden Aktionen", async () => {
    sdk.client.fetch.mockResolvedValue({
      aktionen: [
        {
          code: "EROEFFNUNG20",
          titel: "Eröffnung",
          prozent: 20,
          gilt_ab: null,
          gilt_bis: new Date(Date.now() + 3_600_000).toISOString(),
          nur_teilsortiment: false,
        },
      ],
    });
    const aktionen = await getAktionen();
    expect(aktionen).toHaveLength(1);
    expect(aktionen[0]).toMatchObject({ code: "EROEFFNUNG20", prozent: 20 });
    expect(sdk.client.fetch).toHaveBeenCalledWith("/store/aktionen", {
      next: { revalidate: 60 },
    });
  });

  it("Backend-Fehler → leere Liste, kein Wurf", async () => {
    sdk.client.fetch.mockRejectedValue(new TypeError("fetch failed"));
    await expect(getAktionen()).resolves.toEqual([]);
  });

  it("Unsinn als Antwort → leere Liste", async () => {
    sdk.client.fetch.mockResolvedValue("<html>");
    await expect(getAktionen()).resolves.toEqual([]);
  });
});
