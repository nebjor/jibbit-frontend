import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The drawer path of the same trap as lib/checkout/server.test.ts: a cart
 * holding an item that is no longer sold rejects EVERY write, so before this
 * fix a customer could not even add something new or empty the cart.
 */

const mocks = vi.hoisted(() => ({
  cookieCartId: "cart_old" as string | null,
  sdk: null as unknown,
}));

vi.mock("@/lib/cart/cookie", () => ({
  readCartId: vi.fn(async () => mocks.cookieCartId),
  writeCartId: vi.fn(async (id: string) => {
    mocks.cookieCartId = id;
  }),
  clearCartId: vi.fn(async () => {
    mocks.cookieCartId = null;
  }),
}));
vi.mock("@/lib/tenant/context", () => ({
  getTenantContext: vi.fn(async () => ({ id: "jibbit" })),
}));
vi.mock("@/lib/medusa", () => ({
  isBackendConfigured: () => true,
  getSdkForTenant: () => mocks.sdk,
}));
vi.mock("@/lib/data", () => ({
  getCurrentRegionId: vi.fn(async () => "reg_ch"),
}));

import { addLineToCart, clearCart } from "./server";

function fetchError(status: number, message: string) {
  return Object.assign(new Error(message), { status, statusText: "x" });
}
const deadError = (v: string) =>
  fetchError(400, `Variants ${v} do not exist or belong to a product that is not published`);

function item(variant: string, quantity: number, title: string) {
  return {
    id: `li_${variant}`,
    variant_id: variant,
    quantity,
    title,
    product_title: title,
    variant_title: "",
    unit_price: 2,
    total: 2 * quantity,
  };
}

const DEAD = new Set(["variant_DEMO"]);

function fakeMedusa(initial: ReturnType<typeof item>[]) {
  const carts = new Map<string, { id: string; items: ReturnType<typeof item>[] }>();
  carts.set("cart_old", { id: "cart_old", items: initial });
  let n = 0;
  const clone = (id: string) => ({ cart: structuredClone(carts.get(id)!) });
  const assertLive = (id: string) => {
    const dead = carts.get(id)!.items.find((i) => DEAD.has(i.variant_id));
    if (dead) throw deadError(dead.variant_id);
  };
  const sdk = {
    store: {
      cart: {
        retrieve: vi.fn(async (id: string) => clone(id)),
        create: vi.fn(async () => {
          const id = `cart_new${++n}`;
          carts.set(id, { id, items: [] });
          return clone(id);
        }),
        createLineItem: vi.fn(async (id: string, b: { variant_id: string; quantity: number }) => {
          if (DEAD.has(b.variant_id)) throw deadError(b.variant_id);
          assertLive(id); // Medusa refreshes every existing line on add
          carts.get(id)!.items.push(item(b.variant_id, b.quantity, b.variant_id));
          return clone(id);
        }),
        deleteLineItem: vi.fn(async (id: string) => {
          assertLive(id);
          return {};
        }),
      },
    },
  };
  return { sdk, carts };
}

describe("cart mutations on a cart blocked by an unavailable item", () => {
  beforeEach(() => {
    mocks.cookieCartId = "cart_old";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("adding a new item rebuilds the cart and tells the customer what went", async () => {
    const { sdk } = fakeMedusa([
      item("variant_DEMO", 1, "OCB Premium Black King Size Slim"),
      item("variant_KEEP", 2, "RAW Classic"),
    ]);
    mocks.sdk = sdk;

    const result = await addLineToCart("variant_NEW", 1);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cart.lines.map((l) => l.variantId)).toEqual(["variant_KEEP", "variant_NEW"]);
    expect(result.notice).toContain("«OCB Premium Black King Size Slim» ist nicht mehr erhältlich");
    expect(mocks.cookieCartId).toBe("cart_new1");
  });

  it("adding a dead variant to a healthy cart says so and leaves the cart alone", async () => {
    const { sdk } = fakeMedusa([item("variant_KEEP", 2, "RAW Classic")]);
    mocks.sdk = sdk;

    const result = await addLineToCart("variant_DEMO", 1);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("nicht mehr erhältlich");
    expect(result.message).not.toContain("nicht erreichbar");
    expect(sdk.store.cart.create).not.toHaveBeenCalled();
    expect(mocks.cookieCartId).toBe("cart_old");
  });

  it("emptying a blocked cart works: the cookie is dropped", async () => {
    const { sdk } = fakeMedusa([
      item("variant_DEMO", 1, "A"),
      item("variant_KEEP", 1, "B"),
    ]);
    mocks.sdk = sdk;

    const result = await clearCart();

    expect(result).toMatchObject({ ok: true, cart: { count: 0 } });
    expect(mocks.cookieCartId).toBeNull();
  });
});
