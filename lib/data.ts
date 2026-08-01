/**
 * DATA LAYER — the only place components get products/categories from.
 *
 * Every function tries the Medusa backend via the SDK and falls back to the
 * mock catalog when the backend is unreachable (which it is during early
 * development). This is what keeps `next build` green while the backend boots.
 *
 * Rule for callers: never import `mock-catalog` or `medusa` directly from a
 * component. Import from here.
 */

import "server-only";

import { sdk, isBackendConfigured } from "./medusa";
import { toProductView, toCategoryView } from "./adapters";
import { MOCK_CATEGORIES, MOCK_PRODUCTS } from "./mock-catalog";
import type { CategoryHandle, CategoryView, ProductView } from "./types";

/** Set once per process so the build log shows the fallback exactly once. */
let warned = false;
function warnFallback(where: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (!warned) {
    console.warn(
      `[jibbit] Medusa backend unavailable — serving MOCK catalog. (${where}: ${msg})`,
    );
    warned = true;
  }
}

/**
 * The region determines currency and pricing. Resolved lazily and cached for
 * the process; falls back to undefined, in which case we serve mocks.
 */
let regionIdPromise: Promise<string | undefined> | undefined;

async function getRegionId(): Promise<string | undefined> {
  if (!isBackendConfigured) return undefined;
  if (!regionIdPromise) {
    regionIdPromise = (async () => {
      try {
        const { regions } = await sdk.store.region.list();
        const ch = regions?.find((r) =>
          r.countries?.some((c) => c.iso_2 === "ch"),
        );
        return (ch ?? regions?.[0])?.id;
      } catch (err) {
        warnFallback("regions", err);
        return undefined;
      }
    })();
  }
  return regionIdPromise;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * Categories straight from the backend, or `null` when it is unreachable.
 *
 * Kept separate from `getCategories` because the mock catalogue's ids are not
 * real Medusa ids — passing one back to the API as a filter would silently
 * return nothing. Callers that need a *real* id must use this.
 */
async function fetchBackendCategories(): Promise<CategoryView[] | null> {
  if (!isBackendConfigured) return null;
  try {
    const { product_categories } = await sdk.store.category.list({
      fields: "id,name,handle,description",
    });
    if (!product_categories?.length) return null;
    return product_categories.map(toCategoryView);
  } catch (err) {
    warnFallback("categories", err);
    return null;
  }
}

export async function getCategories(): Promise<CategoryView[]> {
  return (await fetchBackendCategories()) ?? MOCK_CATEGORIES;
}

export async function getCategory(
  handle: string,
): Promise<CategoryView | undefined> {
  const all = await getCategories();
  return all.find((c) => c.handle === handle);
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

const PRODUCT_FIELDS =
  "*variants.calculated_price,*images,*categories,*tags,+metadata";

export async function getProducts(opts?: {
  category?: CategoryHandle;
  limit?: number;
}): Promise<ProductView[]> {
  const filterMock = (list: ProductView[]) => {
    const scoped = opts?.category
      ? list.filter((p) => p.categoryHandle === opts.category)
      : list;
    return opts?.limit ? scoped.slice(0, opts.limit) : scoped;
  };

  const regionId = await getRegionId();
  if (!regionId) return filterMock(MOCK_PRODUCTS);

  try {
    // `opts.category` is our internal handle, not a Medusa category id, so it
    // cannot be passed to the API directly. Resolve the real id first and
    // filter server-side — otherwise `limit` would be applied before the
    // category filter and silently drop matching products.
    let categoryId: string | undefined;
    if (opts?.category) {
      const backendCategories = await fetchBackendCategories();
      categoryId = backendCategories?.find(
        (c) => c.handle === opts.category,
      )?.id;
    }

    const { products } = await sdk.store.product.list({
      region_id: regionId,
      limit: opts?.limit ?? 100,
      fields: PRODUCT_FIELDS,
      ...(categoryId ? { category_id: [categoryId] } : {}),
    });
    if (!products?.length) return filterMock(MOCK_PRODUCTS);

    const views = products.map(toProductView);
    // Belt and braces: if the id lookup failed we still narrow client-side.
    return opts?.category && !categoryId
      ? views.filter((p) => p.categoryHandle === opts.category)
      : views;
  } catch (err) {
    warnFallback("products", err);
    return filterMock(MOCK_PRODUCTS);
  }
}

export async function getProduct(
  handle: string,
): Promise<ProductView | undefined> {
  const regionId = await getRegionId();
  if (!regionId) return MOCK_PRODUCTS.find((p) => p.handle === handle);

  try {
    const { products } = await sdk.store.product.list({
      handle,
      region_id: regionId,
      limit: 1,
      fields: PRODUCT_FIELDS,
    });
    const found = products?.[0];
    if (found) return toProductView(found);
  } catch (err) {
    warnFallback("product", err);
  }
  return MOCK_PRODUCTS.find((p) => p.handle === handle);
}

export async function getFeaturedProducts(
  limit = 6,
): Promise<ProductView[]> {
  const all = await getProducts();
  const featured = all.filter((p) => p.featured);
  return (featured.length ? featured : all).slice(0, limit);
}

/**
 * Same-category suggestions for the PDP, excluding the product itself.
 *
 * Fetches `limit + 1` so that removing the current product still leaves enough
 * suggestions — without pulling the full catalogue on every product page.
 */
export async function getRelatedProducts(
  product: ProductView,
  limit = 4,
): Promise<ProductView[]> {
  const all = await getProducts({
    category: product.categoryHandle,
    limit: limit + 1,
  });
  return all.filter((p) => p.handle !== product.handle).slice(0, limit);
}

/** Handles for prerendering. Derived from mocks so the build never hits the network. */
export function getStaticProductHandles(): string[] {
  return MOCK_PRODUCTS.map((p) => p.handle);
}
