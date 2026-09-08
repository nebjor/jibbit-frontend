/**
 * DATA LAYER — the only place components get products/categories from.
 *
 * Every function tries the Medusa backend via the SDK and falls back to the
 * mock catalog when the backend is unreachable (which it is during early
 * development). This is what keeps `next build` green while the backend boots.
 *
 * Rule for callers: never import `mock-catalog` or `medusa` directly from a
 * component. Import from here.
 *
 * MULTI-TENANT: every exported function below resolves its own tenant via
 * `getTenantContext()` and gets that tenant's SDK client via
 * `getSdkForTenant()` — component call sites (`getCategories()`,
 * `getProducts()`, ...) are unchanged and stay tenant-agnostic on purpose.
 * The two module-level caches here (`regionIdPromises`, `warnedFor`) are
 * `Map`s keyed by tenant id, not bare variables — a bare `let regionIdPromise`
 * shared across all tenants (which is what this file used to have) would mean
 * tenant A's first request could pin tenant B's region id for the rest of the
 * process. Keep that in mind before "simplifying" either cache back to a
 * single slot.
 */

import "server-only";

import { getSdkForTenant, isBackendConfigured } from "./medusa";
import { getTenantContext } from "./tenant/context";
import type { TenantConfig } from "./tenant/types";
import { toProductView, toCategoryView, type TiersByVariant } from "./adapters";
import { MOCK_CATEGORIES, MOCK_PRODUCTS } from "./mock-catalog";
import type { CategoryHandle, CategoryView, ProductView } from "./types";
import type Medusa from "@medusajs/js-sdk";

/** Per-tenant, so the build/runtime log shows the fallback once per tenant, not once ever. */
const warnedFor = new Set<string>();
function warnFallback(tenant: TenantConfig, where: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const key = `${tenant.id}:${where}`;
  if (!warnedFor.has(key)) {
    console.warn(
      `[jibbit:${tenant.id}] Medusa backend unavailable — serving MOCK catalog. (${where}: ${msg})`,
    );
    warnedFor.add(key);
  }
}

/**
 * The region determines currency and pricing. Resolved lazily and cached per
 * tenant for the process; falls back to undefined, in which case we serve
 * mocks. Keyed by tenant id — see module doc comment.
 */
const regionIdPromises = new Map<string, Promise<string | undefined>>();

async function getRegionId(tenant: TenantConfig, sdk: Medusa): Promise<string | undefined> {
  if (!isBackendConfigured(tenant)) return undefined;
  let promise = regionIdPromises.get(tenant.id);
  if (!promise) {
    promise = (async () => {
      try {
        const { regions } = await sdk.store.region.list();
        const ch = regions?.find((r) =>
          r.countries?.some((c) => c.iso_2 === "ch"),
        );
        return (ch ?? regions?.[0])?.id;
      } catch (err) {
        warnFallback(tenant, "regions", err);
        return undefined;
      }
    })();
    regionIdPromises.set(tenant.id, promise);
  }
  return promise;
}

/**
 * The current tenant's region id — the same per-tenant cached lookup the
 * product functions use.
 *
 * Exported for the cart layer (`lib/cart/server.ts`): creating a Medusa cart
 * needs a region, and a SECOND region cache keyed by nothing would reintroduce
 * exactly the cross-tenant leak this module's header warns about. One cache,
 * one place.
 */
export async function getCurrentRegionId(): Promise<string | undefined> {
  const tenant = await getTenantContext();
  return getRegionId(tenant, getSdkForTenant(tenant));
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
async function fetchBackendCategories(
  tenant: TenantConfig,
  sdk: Medusa,
): Promise<CategoryView[] | null> {
  if (!isBackendConfigured(tenant)) return null;
  try {
    const { product_categories } = await sdk.store.category.list({
      fields: "id,name,handle,description",
    });
    if (!product_categories?.length) return null;
    return product_categories.map(toCategoryView);
  } catch (err) {
    warnFallback(tenant, "categories", err);
    return null;
  }
}

export async function getCategories(): Promise<CategoryView[]> {
  const tenant = await getTenantContext();
  const sdk = getSdkForTenant(tenant);
  return (await fetchBackendCategories(tenant, sdk)) ?? MOCK_CATEGORIES;
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

/**
 * Feldliste fuer die Store-API.
 *
 * ⚠️ `inventory_quantity`, `manage_inventory` und `allow_backorder` MUESSEN
 * hier ausdruecklich stehen. Medusa v2 liefert sie sonst nicht mit, und
 * `toVariantView()` in lib/adapters.ts entscheidet genau daran, ob ein Artikel
 * vorraetig ist:
 *
 *     inStock = manage_inventory === false
 *            || allow_backorder === true
 *            || (inventory_quantity ?? 0) > 0
 *
 * Fehlen die Felder, sind alle drei Bedingungen falsch beziehungsweise
 * `undefined ?? 0`, und der Shop zeigt JEDEN Artikel als «ausverkauft» — auch
 * wenn im Admin tausend Stueck liegen. Der Fehler ist still: keine Warnung,
 * keine Fehlermeldung, nur ein Laden ohne Ware.
 *
 * `+` haengt ein Feld an die Standardauswahl an, `*` expandiert eine Relation.
 */
export const PRODUCT_FIELDS =
  "*variants.calculated_price,*images,*categories,*tags,+metadata," +
  "+variants.inventory_quantity,+variants.manage_inventory," +
  // `thumbnail` je Variante: Bildzuordnung «Display -> Box, Heftchen ->
  // Einzelstück» auf der Produktseite. Fehlt das Feld in der Antwort, zeigt
  // jede Variante still das erste Produktbild — kein Fehler, nur wieder das
  // alte Verhalten.
  "+variants.allow_backorder,+variants.thumbnail";

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

  const tenant = await getTenantContext();
  const sdk = getSdkForTenant(tenant);

  const regionId = await getRegionId(tenant, sdk);
  if (!regionId) return filterMock(MOCK_PRODUCTS);

  try {
    // `opts.category` is our internal handle, not a Medusa category id, so it
    // cannot be passed to the API directly. Resolve the real id first and
    // filter server-side — otherwise `limit` would be applied before the
    // category filter and silently drop matching products.
    let categoryId: string | undefined;
    if (opts?.category) {
      const backendCategories = await fetchBackendCategories(tenant, sdk);
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

    // Not `products.map(toProductView)` — map would hand the array index in as
    // the tiers argument. The listing needs no tiers anyway: cards show the
    // "from" price, and one extra request per product page is enough.
    const views = products.map((p) => toProductView(p));
    // Belt and braces: if the id lookup failed we still narrow client-side.
    return opts?.category && !categoryId
      ? views.filter((p) => p.categoryHandle === opts.category)
      : views;
  } catch (err) {
    warnFallback(tenant, "products", err);
    return filterMock(MOCK_PRODUCTS);
  }
}

/**
 * Quantity breaks for the given variants.
 *
 * A separate request on purpose: `/store/products` always prices at quantity 1
 * (`api/store/products/helpers.js` hard-codes `quantity: 1`, and the query
 * validator has no quantity parameter at all), so the full staggering cannot
 * come from the product call. `/store/price-tiers` is a custom route in this
 * project's backend; see `backend/src/api/store/price-tiers/route.ts`.
 *
 * Failure is not fatal. An older backend without the route simply yields no
 * tiers, and the product page renders without a price table — same as any
 * product that has a single flat price.
 */
async function fetchPriceTiers(
  tenant: TenantConfig,
  sdk: Medusa,
  variantIds: string[],
  regionId: string,
): Promise<TiersByVariant> {
  if (!variantIds.length) return {};

  try {
    const res = await sdk.client.fetch<{
      tiers: Record<
        string,
        { min_quantity: number; max_quantity: number | null; amount: number }[]
      >;
    }>("/store/price-tiers", {
      query: { variant_id: variantIds, region_id: regionId },
    });

    return Object.fromEntries(
      Object.entries(res?.tiers ?? {}).map(([variantId, rows]) => [
        variantId,
        rows.map((r) => ({
          minQuantity: r.min_quantity,
          maxQuantity: r.max_quantity,
          price: r.amount,
        })),
      ]),
    );
  } catch (err) {
    warnFallback(tenant, "price-tiers", err);
    return {};
  }
}

export async function getProduct(
  handle: string,
): Promise<ProductView | undefined> {
  const tenant = await getTenantContext();
  const sdk = getSdkForTenant(tenant);

  const regionId = await getRegionId(tenant, sdk);
  if (!regionId) return MOCK_PRODUCTS.find((p) => p.handle === handle);

  try {
    const { products } = await sdk.store.product.list({
      handle,
      region_id: regionId,
      limit: 1,
      fields: PRODUCT_FIELDS,
    });
    const found = products?.[0];
    if (found) {
      const tiers = await fetchPriceTiers(
        tenant,
        sdk,
        (found.variants ?? []).map((v) => v.id),
        regionId,
      );
      return toProductView(found, tiers);
    }
  } catch (err) {
    warnFallback(tenant, "product", err);
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
