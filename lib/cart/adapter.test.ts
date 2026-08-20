import { describe, expect, it } from "vitest";
import { toCartState, type MedusaCartLike } from "./adapter";
import { EMPTY_CART } from "./types";
import { lineTotal as localLineTotal } from "@/lib/pricing";
import type { CartLine } from "@/lib/types";

/**
 * A cart of 24 x RAW Classic. Medusa applied the 24+ quantity break: unit 1.40,
 * line total 33.60. The numbers are the ones a live Medusa 2.13.6 returned for
 * exactly this basket.
 */
function medusaCart(over: Partial<MedusaCartLike> = {}): MedusaCartLike {
  return {
    id: "cart_1",
    currency_code: "chf",
    email: null,
    item_total: 33.6,
    shipping_total: 0,
    total: 33.6,
    items: [
      {
        id: "item_1",
        variant_id: "variant_papers",
        product_handle: "raw-classic-king-size-slim",
        product_title: "RAW Classic King Size Slim",
        variant_title: "1 Heftchen",
        quantity: 24,
        unit_price: 1.4,
        total: 33.6,
      },
    ],
    shipping_methods: [],
    shipping_address: null,
    ...over,
  };
}

describe("toCartState", () => {
  it("returns the empty cart for null", () => {
    expect(toCartState(null)).toBe(EMPTY_CART);
  });

  it("maps lines and counts items", () => {
    const state = toCartState(medusaCart());
    expect(state.id).toBe("cart_1");
    expect(state.count).toBe(24);
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0]).toMatchObject({
      id: "item_1",
      variantId: "variant_papers",
      productHandle: "raw-classic-king-size-slim",
      quantity: 24,
      unitPrice: 1.4,
      lineTotal: 33.6,
    });
  });

  /**
   * ══ THE REGRESSION THIS PROJECT ALREADY HAD ONCE ═══════════════════════
   *
   * The old cart recomputed line totals client-side from tier data copied onto
   * the line. When a line carried no tiers — which is what the product LISTING
   * hands over, since `/store/products` prices everything at quantity 1 — that
   * computation produced 24 x 2.50 = CHF 60.00 for a basket Medusa charges
   * CHF 33.60 for.
   *
   * The adapter must report Medusa's number, whatever the storefront would
   * have computed on its own.
   */
  it("reports Medusa's totals, not what the storefront would compute", () => {
    const clientSideLine: CartLine = {
      variantId: "variant_papers",
      productHandle: "raw-classic-king-size-slim",
      title: "RAW Classic King Size Slim",
      variantTitle: "1 Heftchen",
      price: 2.5, // the quantity-1 price, all a listing page ever knows
      quantity: 24,
      tiers: [], // no tiers loaded — the case that produced the bug
    };
    // What the old client-side computation would have said:
    expect(localLineTotal(clientSideLine)).toBe(60);

    // What Medusa actually charges, and therefore what the cart must show:
    const state = toCartState(medusaCart());
    expect(state.subtotal).toBe(33.6);
    expect(state.lines[0].lineTotal).toBe(33.6);
  });

  /**
   * Prices are maintained tax-inclusive for CHF, so `item_total` is the gross
   * figure and `item_subtotal` the net one. Quoting the net figure would
   * understate the price by the 8.1% VAT.
   */
  it("uses the gross item_total and never the net item_subtotal", () => {
    const state = toCartState({
      ...medusaCart(),
      item_total: 33.6,
      // The net value Medusa reports alongside it; must not surface anywhere.
      ...({ item_subtotal: 31.082331174838114 } as Partial<MedusaCartLike>),
    });
    expect(state.subtotal).toBe(33.6);
  });

  it("takes shipping and the grand total from Medusa once a method is chosen", () => {
    const state = toCartState(
      medusaCart({
        shipping_total: 9,
        total: 42.6,
        shipping_methods: [{ id: "sm_1" }],
      }),
    );
    expect(state.hasShippingMethod).toBe(true);
    expect(state.shipping).toBe(9);
    expect(state.total).toBe(42.6);
  });

  it("falls back to unit price x quantity when a line total is missing", () => {
    const cart = medusaCart();
    cart.items![0].total = undefined;
    expect(toCartState(cart).lines[0].lineTotal).toBeCloseTo(33.6, 10);
  });

  it("only reports compare-at when it is actually higher", () => {
    const cart = medusaCart();
    cart.items![0].compare_at_unit_price = 1.4;
    expect(toCartState(cart).lines[0].compareAtUnitPrice).toBeUndefined();
    cart.items![0].compare_at_unit_price = 2.5;
    expect(toCartState(cart).lines[0].compareAtUnitPrice).toBe(2.5);
  });

  it("reads the address back for the checkout form", () => {
    const state = toCartState(
      medusaCart({
        email: "gast@example.ch",
        shipping_address: {
          first_name: "Max",
          last_name: "Muster",
          address_1: "Bahnhofstrasse 1",
          postal_code: "8001",
          city: "Zürich",
          country_code: "CH",
        },
      }),
    );
    expect(state.hasShippingAddress).toBe(true);
    expect(state.email).toBe("gast@example.ch");
    expect(state.address).toMatchObject({
      firstName: "Max",
      postalCode: "8001",
      // Lowercased, because that is what Medusa expects on the way back in.
      countryCode: "ch",
    });
  });

  it("treats an address without a country as no address at all", () => {
    const state = toCartState(medusaCart({ shipping_address: { city: "Zürich" } }));
    expect(state.hasShippingAddress).toBe(false);
    expect(state.address).toBeNull();
  });
});
