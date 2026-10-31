import { describe, expect, it, vi } from "vitest";

/**
 * features.merchantFeed = false (shop.config.ts): die Route antwortet 404 und
 * fasst weder Mandant noch Katalog an.
 */
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
const getTenantContext = vi.fn();
vi.mock("@/lib/tenant/context", () => ({ getTenantContext }));
vi.mock("@/lib/data", () => ({
  CatalogUnavailableError: class extends Error {},
  getProductsForTenant: vi.fn(),
  getCategoriesForTenant: vi.fn(),
}));
vi.mock("@/lib/config", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/config")>();
  return { ...orig, FEATURES: { ...orig.FEATURES, merchantFeed: false } };
});

describe("GET /merchant-feed.tsv bei ausgeschaltetem Feed", () => {
  it("antwortet 404 und lädt nichts", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(404);
    expect(getTenantContext).not.toHaveBeenCalled();
  });
});
