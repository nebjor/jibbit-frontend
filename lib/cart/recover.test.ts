import { describe, expect, it, vi } from "vitest";
import type Medusa from "@medusajs/js-sdk";
import type { HttpTypes } from "@medusajs/types";
import {
  NETWORK_ERROR,
  REJECTED_ERROR,
  describeCartFailure,
  droppedNotice,
  rebuildCart,
  staleVariantIds,
} from "./recover";

/** What @medusajs/js-sdk throws: FetchError(message, statusText, status). */
function fetchError(status: number, message: string) {
  return Object.assign(new Error(message), { status, statusText: "x" });
}

const DEAD_MSG =
  "Variants variant_OCB1, variant_ELE5 do not exist or belong to a product that is not published";

describe("staleVariantIds", () => {
  it("reads the dead variants out of Medusa's refresh error", () => {
    expect(staleVariantIds(fetchError(400, DEAD_MSG))).toEqual([
      "variant_OCB1",
      "variant_ELE5",
    ]);
  });

  it("recognises the missing-price variant of the same trap", () => {
    expect(
      staleVariantIds(fetchError(400, "Variants with IDs variant_X do not have a price")),
    ).toEqual(["variant_X"]);
  });

  it("is null for anything that is not a dead-item refusal", () => {
    expect(staleVariantIds(fetchError(400, "Invalid email"))).toBeNull();
    expect(staleVariantIds(fetchError(500, DEAD_MSG))).toBeNull();
    expect(staleVariantIds(new TypeError("fetch failed"))).toBeNull();
    expect(staleVariantIds(undefined)).toBeNull();
  });
});

describe("describeCartFailure", () => {
  it("says 'unreachable' only when the backend really did not answer", () => {
    expect(describeCartFailure(new TypeError("fetch failed"))).toBe(NETWORK_ERROR);
    expect(describeCartFailure(fetchError(502, "Bad Gateway"))).toBe(NETWORK_ERROR);
  });

  it("does not tell the customer to wait for a refusal that waiting cannot fix", () => {
    expect(describeCartFailure(fetchError(400, "nope"))).toBe(REJECTED_ERROR);
  });
});

const line = (title: string, variantTitle: string) => ({
  id: "cali",
  variantId: "v",
  productHandle: "h",
  title,
  variantTitle,
  quantity: 1,
  unitPrice: 1,
  lineTotal: 1,
});

describe("droppedNotice", () => {
  it("names the product and says the rest is unchanged", () => {
    expect(droppedNotice([line("OCB Premium Black", "1 Heftchen")], 3)).toBe(
      "«OCB Premium Black (1 Heftchen)» ist nicht mehr erhältlich und wurde aus dem Warenkorb entfernt. Der Rest deiner Bestellung ist unverändert.",
    );
  });

  it("points to the shop when nothing is left", () => {
    const text = droppedNotice([line("A", ""), line("B", "5er Pack")], 0);
    expect(text).toContain("«A», «B (5er Pack)»");
    expect(text).toContain("Warenkorb ist jetzt leer");
  });
});

// ---------------------------------------------------------------------------

function item(id: string, variant: string, quantity: number, title = id) {
  return {
    id,
    variant_id: variant,
    quantity,
    title,
    product_title: title,
    variant_title: "",
    unit_price: 1,
    total: quantity,
  };
}

function staleCart(): HttpTypes.StoreCart {
  return {
    id: "cart_old",
    region_id: "reg_ch",
    email: "kundin@example.ch",
    shipping_address: {
      id: "addr_1",
      first_name: "Joris",
      last_name: "N",
      address_1: "Weg 1",
      postal_code: "8000",
      city: "Zürich",
      country_code: "ch",
      created_at: "2026-01-01",
    },
    items: [
      item("li_dead1", "variant_OCB1", 1, "OCB Premium Black"),
      item("li_live", "variant_LIVE", 2, "RAW Classic"),
      item("li_dead2", "variant_ELE5", 4, "Elements"),
      item("li_unnamed", "variant_GONE", 1, "Unnamed dead"),
    ],
  } as unknown as HttpTypes.StoreCart;
}

function fakeSdk() {
  let items: unknown[] = [];
  const cart = () => ({ id: "cart_new", items: [...items] });
  const sdk = {
    store: {
      cart: {
        create: vi.fn<(body: Record<string, unknown>) => Promise<{ cart: ReturnType<typeof cart> }>>(
          async () => ({ cart: cart() }),
        ),
        createLineItem: vi.fn(async (_id: string, body: { variant_id: string; quantity: number }) => {
          if (body.variant_id === "variant_GONE") {
            throw fetchError(400, `Variants ${body.variant_id} do not exist or belong to a product that is not published`);
          }
          items.push(item(`new_${body.variant_id}`, body.variant_id, body.quantity));
          return { cart: cart() };
        }),
      },
    },
  };
  return { sdk, reset: () => (items = []) };
}

describe("rebuildCart", () => {
  it("keeps what is orderable, drops the dead lines, carries contact data over", async () => {
    const { sdk } = fakeSdk();
    const { cart, dropped } = await rebuildCart(
      sdk as unknown as Pick<Medusa, "store">,
      staleCart(),
      { knownDead: ["variant_OCB1", "variant_ELE5"], fields: "f" },
    );

    // Named-dead variants are never even tried.
    const tried = sdk.store.cart.createLineItem.mock.calls.map((c) => c[1].variant_id);
    expect(tried).toEqual(["variant_LIVE", "variant_GONE"]);

    expect(cart.id).toBe("cart_new");
    expect(cart.items?.map((i) => i.variant_id)).toEqual(["variant_LIVE"]);
    expect(cart.items?.[0].quantity).toBe(2);
    expect(dropped.map((l) => l.title)).toEqual([
      "OCB Premium Black",
      "Elements",
      "Unnamed dead",
    ]);

    // POST /store/carts is .strict(): no id/created_at may leak into the address.
    const body = sdk.store.cart.create.mock.calls[0][0];
    expect(body.region_id).toBe("reg_ch");
    expect(body.email).toBe("kundin@example.ch");
    expect(body.shipping_address).not.toHaveProperty("id");
    expect(body.shipping_address).not.toHaveProperty("created_at");
    expect(body.shipping_address).toMatchObject({ city: "Zürich", country_code: "ch" });
  });

  it("aborts on a real backend failure instead of silently dropping items", async () => {
    const { sdk } = fakeSdk();
    sdk.store.cart.createLineItem.mockRejectedValueOnce(fetchError(503, "down"));
    await expect(
      rebuildCart(sdk as unknown as Pick<Medusa, "store">, staleCart(), {
        knownDead: ["variant_OCB1", "variant_ELE5"],
        fields: "f",
      }),
    ).rejects.toThrow("down");
  });
});
