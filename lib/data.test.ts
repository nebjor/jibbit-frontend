import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const down = () => Promise.reject(new TypeError("fetch failed"));
const sdk = {
  store: {
    region: { list: vi.fn(down) },
    category: { list: vi.fn(down) },
    product: { list: vi.fn(down) },
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
