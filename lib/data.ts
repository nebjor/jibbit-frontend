/**
 * DATA LAYER — the only place components get products/categories from.
 *
 * Every function tries the Medusa backend via the SDK. Outside production
 * (dev, test) an unreachable backend falls back to the mock catalog. In
 * production it never does: products throw `CatalogUnavailableError` (the
 * segment's error boundary shows an honest error state), categories degrade
 * to an empty list so the header still renders.
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

import { unstable_cache } from "next/cache";

import { getSdkForTenant, isBackendConfigured } from "./medusa";
import { getTenantContext } from "./tenant/context";
import type { TenantConfig } from "./tenant/types";
import { toProductView, toCategoryView, type TiersByVariant } from "./adapters";
import { MOCK_CATEGORIES, MOCK_PRODUCTS } from "./mock-catalog";
import type { CategoryHandle, CategoryView, ProductView } from "./types";
import { parseAktionen, type Aktion } from "./aktionen";
import type Medusa from "@medusajs/js-sdk";

/**
 * KATALOG-CACHE (Core Web Vitals / TTFB)
 *
 * Alle Seiten sind wegen `headers()` (Mandantenauflösung) und Cookies
 * (Warenkorb) dynamisch und können nicht ISR-statisch sein. Ohne Cache lief
 * aber jede Anfrage durch mehrere Backend-Roundtrips (Region, Kategorien,
 * Produktliste seitenweise, Preisstaffeln) — der Hauptanteil der ~550 ms
 * TTFB. Die Katalogabfragen laufen deshalb durch den Next-Datencache
 * (`unstable_cache`): höchstens CATALOG_REVALIDATE_SECONDS alt, pro Mandant
 * getrennt (Schlüssel enthält die Tenant-ID), Tag `catalog` für gezieltes
 * `revalidateTag`. Fehler (Exceptions) werden NICHT gecacht.
 *
 * Nur in Produktion: in Dev/Test soll eine Backend-Änderung sofort sichtbar
 * sein, und `unstable_cache` braucht dort die Next-Laufzeit.
 */
export const CATALOG_REVALIDATE_SECONDS = 60;

function catalogCache<T>(fn: () => Promise<T>, keyParts: string[]): Promise<T> {
  if (process.env.NODE_ENV !== "production") return fn();
  return unstable_cache(fn, ["catalog", ...keyParts], {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: ["catalog"],
  })();
}

export class CatalogUnavailableError extends Error {
  constructor(where: string) {
    super(`Katalog nicht verfügbar (${where})`);
    this.name = "CatalogUnavailableError";
  }
}

/** The mock catalog is a dev/test aid only — never shown to real customers. */
function mockAllowed(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** The mock value outside production; otherwise throws so the page can say so. */
function mockOrThrow<T>(mock: T, where: string): T {
  if (mockAllowed()) return mock;
  throw new CatalogUnavailableError(where);
}

/** Per-tenant, so the build/runtime log shows the fallback once per tenant, not once ever. */
const warnedFor = new Set<string>();
function warnFallback(tenant: TenantConfig, where: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const key = `${tenant.id}:${where}`;
  if (!warnedFor.has(key)) {
    const effect = mockAllowed() ? "serving MOCK catalog" : "no mock in production";
    console.warn(
      `[jibbit:${tenant.id}] Medusa backend unavailable — ${effect}. (${where}: ${msg})`,
    );
    warnedFor.add(key);
  }
}

/**
 * The region determines currency and pricing. Resolved lazily and cached per
 * tenant — but only once found; a miss is retried on the next request.
 * Keyed by tenant id — see module doc comment.
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
    const pending = promise;
    void pending.then((id) => {
      if (!id && regionIdPromises.get(tenant.id) === pending) {
        regionIdPromises.delete(tenant.id);
      }
    });
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
      fields: "id,name,handle,description,is_active",
      // Ohne Angabe liefert die Store-API nur die ersten 50.
      limit: 200,
    });
    if (!product_categories?.length) return null;
    // Inaktive Kategorien (z. B. das in «Filter & Tips» aufgegangene «Filter»)
    // gehören nicht in Navigation und Sitemap. Die Store-API filtert schon
    // selbst; das hier hält es auch dann ein, wenn sie es einmal nicht tut.
    const aktiv = product_categories.filter(
      (c) => (c as { is_active?: boolean }).is_active !== false,
    );
    return aktiv.length ? aktiv.map(toCategoryView) : null;
  } catch (err) {
    warnFallback(tenant, "categories", err);
    return null;
  }
}

export async function getCategories(): Promise<CategoryView[]> {
  return getCategoriesForTenant(await getTenantContext());
}

/**
 * Wie `getCategories`, aber für einen BEREITS aufgelösten Mandanten — ohne
 * `headers()`. Für Aufrufer in einem Cache-Scope (`unstable_cache`), in dem
 * Request-APIs nicht erlaubt sind; siehe app/merchant-feed.tsv/route.ts.
 */
export async function getCategoriesForTenant(
  tenant: TenantConfig,
): Promise<CategoryView[]> {
  return catalogCache(
    async () =>
      (await fetchBackendCategories(tenant, getSdkForTenant(tenant))) ??
      (mockAllowed() ? MOCK_CATEGORIES : []),
    ["categories", tenant.id],
  );
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
  // Optionsname («Grösse») für die Variantenwahl der Produktseite.
  "*options,*variants.options," +
  "+variants.inventory_quantity,+variants.manage_inventory," +
  // `thumbnail` je Variante: Bildzuordnung «Display -> Box, Heftchen ->
  // Einzelstück» auf der Produktseite. Fehlt das Feld in der Antwort, zeigt
  // jede Variante still das erste Produktbild — kein Fehler, nur wieder das
  // alte Verhalten.
  "+variants.allow_backorder,+variants.thumbnail," +
  // GTIN je Variante fürs Produkt-Schema (lib/adapters.ts `toGtin`). Die drei
  // Felder stecken heute schon in `*variants`; sie stehen trotzdem hier,
  // damit die Nummern nicht still aus dem Schema verschwinden, wenn jemand
  // die Standardauswahl einmal enger fasst.
  "+variants.ean,+variants.upc,+variants.barcode";

export async function getProducts(opts?: {
  category?: CategoryHandle;
  limit?: number;
}): Promise<ProductView[]> {
  return getProductsForTenant(await getTenantContext(), opts);
}

/**
 * Wie `getProducts`, aber für einen BEREITS aufgelösten Mandanten — ohne
 * `headers()`. Für Aufrufer in einem Cache-Scope (`unstable_cache`), in dem
 * Request-APIs nicht erlaubt sind; siehe app/merchant-feed.tsv/route.ts.
 * Das Mandantenobjekt kommt von `getTenantContext()` AUSSERHALB des Scopes.
 */
export function getProductsForTenant(
  tenant: TenantConfig,
  opts?: {
    category?: CategoryHandle;
    limit?: number;
  },
): Promise<ProductView[]> {
  return catalogCache(
    () => fetchProductsForTenant(tenant, opts),
    ["products", tenant.id, opts?.category ?? "", String(opts?.limit ?? "")],
  );
}

async function fetchProductsForTenant(
  tenant: TenantConfig,
  opts?: {
    category?: CategoryHandle;
    limit?: number;
  },
): Promise<ProductView[]> {
  const filterMock = (list: ProductView[]) => {
    const scoped = opts?.category
      ? list.filter((p) => p.categoryHandle === opts.category)
      : list;
    return opts?.limit ? scoped.slice(0, opts.limit) : scoped;
  };

  const sdk = getSdkForTenant(tenant);

  const regionId = await getRegionId(tenant, sdk);
  if (!regionId) return mockOrThrow(filterMock(MOCK_PRODUCTS), "regions");

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

    const query = {
      region_id: regionId,
      fields: PRODUCT_FIELDS,
      ...(categoryId ? { category_id: [categoryId] } : {}),
    };
    const products = opts?.limit
      ? ((await sdk.store.product.list({ ...query, limit: opts.limit }))
          .products ?? [])
      : await listAllProducts(tenant, sdk, query);
    if (!products.length) return mockAllowed() ? filterMock(MOCK_PRODUCTS) : [];

    // Cards show the best quantity tier ("ab 24 Stk. 1.40/Stk."), so the
    // listing needs the tiers too.
    const tiers = await fetchPriceTiers(
      tenant,
      sdk,
      products.flatMap((p) => (p.variants ?? []).map((v) => v.id)),
      regionId,
    );
    const views = products.map((p) => toProductView(p, tiers));
    // Belt and braces: if the id lookup failed we still narrow client-side.
    return opts?.category && !categoryId
      ? views.filter((p) => p.categoryHandle === opts.category)
      : views;
  } catch (err) {
    warnFallback(tenant, "products", err);
    return mockOrThrow(filterMock(MOCK_PRODUCTS), "products");
  }
}

/**
 * ALLE Produkte, seitenweise.
 *
 * Die Store-API liefert höchstens eine Seite je Anfrage. Wer ohne `limit`
 * fragt (Katalog, Sitemap, Merchant-Feed), will das ganze Sortiment — die
 * frühere feste Obergrenze von 100 hätte das 101. Produkt still aus Sitemap
 * und Feed fallen lassen, ohne Fehler und ohne Warnung.
 *
 * Abbruch über `count` der Antwort, ersatzweise über eine nicht volle Seite.
 * `PRODUCT_MAX_PAGES` ist nur die Notbremse gegen ein Backend, das endlos
 * volle Seiten liefert; wird sie erreicht, steht das im Log.
 */
const PRODUCT_PAGE_SIZE = 100;
const PRODUCT_MAX_PAGES = 100;

type ProductListQuery = NonNullable<
  Parameters<Medusa["store"]["product"]["list"]>[0]
>;
type ProductListPage = Awaited<ReturnType<Medusa["store"]["product"]["list"]>>;

async function listAllProducts(
  tenant: TenantConfig,
  sdk: Medusa,
  query: Omit<ProductListQuery, "limit" | "offset">,
): Promise<ProductListPage["products"]> {
  const all: ProductListPage["products"] = [];

  for (let page = 0; page < PRODUCT_MAX_PAGES; page++) {
    const { products, count } = await sdk.store.product.list({
      ...query,
      limit: PRODUCT_PAGE_SIZE,
      offset: page * PRODUCT_PAGE_SIZE,
    });
    all.push(...(products ?? []));
    const complete =
      !products?.length ||
      products.length < PRODUCT_PAGE_SIZE ||
      (typeof count === "number" && all.length >= count);
    if (complete) return all;
  }

  console.error(
    `[jibbit:${tenant.id}] Produktliste nach ${PRODUCT_MAX_PAGES} Seiten ` +
      `(${all.length} Produkte) abgebrochen — Sitemap und Feed sind unvollständig.`,
  );
  return all;
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
 *
 * The route rejects more than 50 variants per request (`MAX_VARIANTS`), so a
 * full listing is fetched in parallel batches.
 */
const PRICE_TIERS_MAX_VARIANTS = 50;

async function fetchPriceTiers(
  tenant: TenantConfig,
  sdk: Medusa,
  variantIds: string[],
  regionId: string,
): Promise<TiersByVariant> {
  if (!variantIds.length) return {};

  const chunks: string[][] = [];
  for (let i = 0; i < variantIds.length; i += PRICE_TIERS_MAX_VARIANTS) {
    chunks.push(variantIds.slice(i, i + PRICE_TIERS_MAX_VARIANTS));
  }

  try {
    const responses = await Promise.all(
      chunks.map((ids) =>
        sdk.client.fetch<{
          tiers: Record<
            string,
            {
              min_quantity: number;
              max_quantity: number | null;
              amount: number;
              original_amount?: number;
            }[]
          >;
        }>("/store/price-tiers", {
          query: { variant_id: ids, region_id: regionId },
        }),
      ),
    );

    return Object.fromEntries(
      responses.flatMap((res) => Object.entries(res?.tiers ?? {})).map(([variantId, rows]) => [
        variantId,
        rows.map((r) => ({
          minQuantity: r.min_quantity,
          maxQuantity: r.max_quantity,
          price: r.amount,
          ...(r.original_amount != null && r.original_amount > r.amount
            ? { compareAt: r.original_amount }
            : {}),
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
  // `null` statt `undefined`: der Datencache serialisiert als JSON.
  const view = await catalogCache(
    async () => (await fetchProduct(tenant, handle)) ?? null,
    ["product", tenant.id, handle],
  );
  return view ?? undefined;
}

async function fetchProduct(
  tenant: TenantConfig,
  handle: string,
): Promise<ProductView | undefined> {
  const sdk = getSdkForTenant(tenant);

  const findMock = () => MOCK_PRODUCTS.find((p) => p.handle === handle);

  const regionId = await getRegionId(tenant, sdk);
  if (!regionId) return mockOrThrow(findMock(), "regions");

  let products;
  try {
    ({ products } = await sdk.store.product.list({
      handle,
      region_id: regionId,
      limit: 1,
      fields: PRODUCT_FIELDS,
    }));
  } catch (err) {
    warnFallback(tenant, "product", err);
    return mockOrThrow(findMock(), "product");
  }

  const found = products?.[0];
  if (!found) return mockAllowed() ? findMock() : undefined;

  const tiers = await fetchPriceTiers(
    tenant,
    sdk,
    (found.variants ?? []).map((v) => v.id),
    regionId,
  );
  return toProductView(found, tiers);
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

/**
 * Handles for prerendering. Derived from mocks so the build never hits the
 * network — and none in production, where mock pages must not exist.
 *
 * NICHT MEHR VERDRAHTET. Die Produktseite hat ihr `generateStaticParams`
 * verloren: dessen blosse Existenz stellte das Segment auf statische
 * Erzeugung, und dort ist das `headers()` der Mandantenauflösung verboten —
 * jede Produktseite antwortete mit 500. Die Begründung steht ausführlich in
 * app/products/[handle]/page.tsx. Wer diese Funktion wieder anschliessen
 * will, muss zuerst dort nachlesen.
 */
export function getStaticProductHandles(): string[] {
  return mockAllowed() ? MOCK_PRODUCTS.map((p) => p.handle) : [];
}

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------

/** So lange darf eine Aktions-Antwort alt sein (Next-Datencache). */
const AKTIONEN_REVALIDATE_SECONDS = 60;

/**
 * Laufende automatische Aktionen für den Aktionsbanner.
 *
 * `GET /store/aktionen` ist eine eigene Route des Backends
 * (backend/src/api/store/aktionen/route.ts); wie jede Store-Route verlangt sie
 * den Publishable-Key, den der SDK-Client des Mandanten mitschickt. Die
 * Antwort wird 60 s im Next-Datencache gehalten.
 *
 * Fällt NIE aus: ein älteres Backend ohne die Route, ein Netzfehler oder eine
 * unbrauchbare Antwort ergeben eine leere Liste — also keinen Banner. Der
 * Mock-Katalog kennt keine Aktionen und springt hier bewusst nicht ein: eine
 * erfundene Aktion wäre schlimmer als keine.
 */
export async function getAktionen(): Promise<Aktion[]> {
  try {
    const tenant = await getTenantContext();
    if (!isBackendConfigured(tenant)) return [];
    const sdk = getSdkForTenant(tenant);
    const res = await sdk.client.fetch<unknown>("/store/aktionen", {
      next: { revalidate: AKTIONEN_REVALIDATE_SECONDS },
    });
    return parseAktionen(res, Date.now());
  } catch (err) {
    try {
      warnFallback(await getTenantContext(), "aktionen", err);
    } catch {
      // Selbst die Warnung darf den Seitenaufbau nicht kippen.
    }
    return [];
  }
}
