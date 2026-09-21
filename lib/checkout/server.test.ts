import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieCartId: "cart_old" as string | null,
  sessionToken: null as string | null,
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
vi.mock("@/lib/auth/session", () => ({
  readSessionToken: vi.fn(async () => mocks.sessionToken),
  bearer: (t: string) => ({ Authorization: `Bearer ${t}` }),
}));

import { saveContactAndAddress } from "./server";
import { NETWORK_ERROR } from "@/lib/cart/recover";

function fetchError(status: number, message: string) {
  return Object.assign(new Error(message), { status, statusText: "x" });
}

function item(id: string, variant: string, quantity: number, title: string, variantTitle = "") {
  return {
    id,
    variant_id: variant,
    quantity,
    title,
    product_title: title,
    variant_title: variantTitle,
    unit_price: 2.4,
    total: 2.4 * quantity,
  };
}

const DEAD = new Set(["variant_OCB1", "variant_ELE5"]);

/** A tiny in-memory Medusa that behaves like v2.13 for dead line items. */
const SHIPPING_OPTIONS = [
  { id: "so_free", provider_id: "manual_manual", amount: 0 },
  { id: "so_swiss", provider_id: "swiss-shipping_swiss-shipping", amount: undefined },
];

type FakeCart = {
  id: string;
  items: ReturnType<typeof item>[];
  email?: string;
  shipping_address?: unknown;
  shipping_methods?: { id: string; shipping_option_id: string }[];
  shipping_total?: number;
};

function fakeMedusa(options: unknown[] = SHIPPING_OPTIONS) {
  const carts = new Map<string, FakeCart>();
  carts.set("cart_old", {
    id: "cart_old",
    items: [
      item("li_1", "variant_OCB1", 1, "OCB Premium Black King Size Slim", "1 Heftchen"),
      item("li_2", "variant_ELE5", 4, "Elements Ultra Thin Rice King Size Slim", "5er Pack"),
      item("li_3", "variant_LIVE", 2, "RAW Classic"),
    ],
  });
  const refresh = (id: string) => {
    const dead = carts.get(id)!.items.filter((i) => DEAD.has(i.variant_id)).map((i) => i.variant_id);
    if (dead.length) {
      throw fetchError(400, `Variants ${dead.join(", ")} do not exist or belong to a product that is not published`);
    }
  };
  let n = 0;
  const sdk = {
    store: {
      cart: {
        retrieve: vi.fn(async (id: string) => {
          const c = carts.get(id);
          if (!c) throw fetchError(404, "not found");
          return { cart: structuredClone(c) };
        }),
        create: vi.fn(async (body: { email?: string; shipping_address?: unknown }) => {
          const id = `cart_new${++n}`;
          carts.set(id, { id, items: [], email: body.email, shipping_address: body.shipping_address });
          return { cart: structuredClone(carts.get(id)!) };
        }),
        createLineItem: vi.fn(async (id: string, body: { variant_id: string; quantity: number }) => {
          if (DEAD.has(body.variant_id)) {
            throw fetchError(400, `Variants ${body.variant_id} do not exist or belong to a product that is not published`);
          }
          carts.get(id)!.items.push(item(`li_${body.variant_id}`, body.variant_id, body.quantity, "RAW Classic"));
          return { cart: structuredClone(carts.get(id)!) };
        }),
        update: vi.fn(async (id: string, body: { email: string; shipping_address: unknown }) => {
          refresh(id);
          Object.assign(carts.get(id)!, { email: body.email, shipping_address: body.shipping_address });
          return { cart: structuredClone(carts.get(id)!) };
        }),
        transferCart: vi.fn(async () => ({ cart: {} })),
        addShippingMethod: vi.fn(async (id: string, body: { option_id: string }) => {
          refresh(id);
          Object.assign(carts.get(id)!, {
            shipping_methods: [{ id: "sm_1", shipping_option_id: body.option_id }],
            shipping_total: 4.5,
          });
          return { cart: structuredClone(carts.get(id)!) };
        }),
      },
      fulfillment: {
        listCartOptions: vi.fn(async () => ({ shipping_options: options })),
        calculate: vi.fn(async (id: string) => ({ shipping_option: { id, amount: 4.5 } })),
      },
      customer: {
        listAddress: vi.fn(async () => ({ addresses: [] })),
        createAddress: vi.fn(async () => ({ customer: {} })),
      },
    },
  };
  return { sdk, carts };
}

const ADDRESS = {
  firstName: "Joris",
  lastName: "Neber",
  company: "",
  address1: "Teststrasse 1",
  address2: "",
  postalCode: "8000",
  city: "Zürich",
  countryCode: "ch",
  phone: "",
};

describe("saveContactAndAddress puts the delivery method on the cart", () => {
  beforeEach(() => {
    mocks.cookieCartId = "cart_ok";
    mocks.sessionToken = null;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  function healthy(options?: unknown[]) {
    const medusa = fakeMedusa(options);
    medusa.carts.set("cart_ok", { id: "cart_ok", items: [item("li", "variant_LIVE", 1, "RAW")] });
    mocks.sdk = medusa.sdk;
    return medusa;
  }

  it("selects the swiss-shipping option itself — no chooser for the customer", async () => {
    const { sdk } = healthy();

    const result = await saveContactAndAddress("kundin@example.ch", ADDRESS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(sdk.store.cart.addShippingMethod).toHaveBeenCalledWith(
      "cart_ok",
      { option_id: "so_swiss" },
      expect.anything(),
    );
    expect(result.cart.hasShippingMethod).toBe(true);
    expect(result.cart.shipping).toBe(4.5);
  });

  it("says so honestly when nothing can ship to the address", async () => {
    healthy([]);

    const result = await saveContactAndAddress("kundin@example.ch", ADDRESS);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("nicht liefern");
  });
});

describe("saveContactAndAddress with a cart blocked by unavailable items", () => {
  beforeEach(() => {
    mocks.cookieCartId = "cart_old";
    mocks.sessionToken = null;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("rebuilds the cart, saves the address and names what was removed", async () => {
    const { sdk, carts } = fakeMedusa();
    mocks.sdk = sdk;

    const result = await saveContactAndAddress("joris@jibbit.ch", ADDRESS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cart.id).toBe("cart_new1");
    expect(result.cart.lines.map((l) => l.variantId)).toEqual(["variant_LIVE"]);
    expect(result.cart.email).toBe("joris@jibbit.ch");
    expect(result.notice).toContain("«OCB Premium Black King Size Slim (1 Heftchen)»");
    expect(result.notice).toContain("«Elements Ultra Thin Rice King Size Slim (5er Pack)»");
    expect(result.notice).not.toContain("nicht erreichbar");

    // The cookie now points at the working cart; the old one is left alone.
    expect(mocks.cookieCartId).toBe("cart_new1");
    expect(carts.get("cart_old")!.items).toHaveLength(3);
  });

  it("attaches the rebuilt cart to the signed-in customer", async () => {
    const { sdk } = fakeMedusa();
    mocks.sdk = sdk;
    const payload = Buffer.from(JSON.stringify({ actor_id: "cus_joris", exp: 9999999999 })).toString("base64url");
    mocks.sessionToken = `h.${payload}.s`;

    const result = await saveContactAndAddress("joris@jibbit.ch", ADDRESS);

    expect(result.ok).toBe(true);
    const transferred = sdk.store.cart.transferCart.mock.calls.map((c) => (c as unknown[])[0]);
    expect(transferred).toContain("cart_new1");
  });

  it("with nothing orderable left, hands back the empty cart and says so", async () => {
    const { sdk, carts } = fakeMedusa();
    carts.get("cart_old")!.items.pop(); // only the two dead lines remain
    mocks.sdk = sdk;

    const result = await saveContactAndAddress("joris@jibbit.ch", ADDRESS);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cart?.count).toBe(0);
    expect(result.cart?.id).toBe("cart_new1");
    expect(result.message).toContain("Warenkorb ist jetzt leer");
  });

  it("still says 'unreachable' when the backend really is down", async () => {
    const { sdk } = fakeMedusa();
    sdk.store.cart.update.mockRejectedValueOnce(new TypeError("fetch failed"));
    mocks.sdk = sdk;

    const result = await saveContactAndAddress("joris@jibbit.ch", ADDRESS);

    expect(result).toMatchObject({ ok: false, message: NETWORK_ERROR });
    expect(sdk.store.cart.create).not.toHaveBeenCalled();
  });
});
