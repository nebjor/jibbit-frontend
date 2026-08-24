import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Der Rückweg vom zahls.ch-Plugin hat keine Zahlungsreferenz in der URL —
 * die gesamte Wahrheit muss aus `cart.complete()` kommen. Diese Tests pinnen
 * die drei Antworten von `completePendingOrder()`:
 *
 *   order    complete lieferte eine Bestellung → Cookie weg, ID zurück
 *   pending  complete scheiterte (unbezahlt / Backend weg) → Cookie BLEIBT
 *   missing  kein Cart-Cookie → nichts abzuschliessen
 *
 * Entscheidend ist, dass `pending` den Warenkorb NIE wegräumt: der Kunde darf
 * nach einer hängenden Bestätigung nicht mit leerem Korb dastehen.
 */

const state: {
  cartId: string | null;
  complete: (cartId: string) => Promise<unknown>;
  cleared: number;
} = {
  cartId: null,
  complete: async () => ({ type: "cart", error: { message: "not authorized" } }),
  cleared: 0,
};

vi.mock("@/lib/cart/server", () => ({
  cartContext: async () => ({
    sdk: {
      store: {
        cart: {
          complete: (cartId: string) => state.complete(cartId),
        },
      },
    },
  }),
  currentCartId: async () => state.cartId,
  clearCartId: async () => {
    state.cleared += 1;
  },
  logCartError: () => {},
}));

import { completePendingOrder } from "./return";

beforeEach(() => {
  state.cartId = "cart_123";
  state.cleared = 0;
  state.complete = async () => ({
    type: "cart",
    error: { message: "not authorized" },
  });
});

describe("completePendingOrder", () => {
  it("reports the order and clears the cart cookie when completion succeeds", async () => {
    state.complete = async (cartId) => {
      expect(cartId).toBe("cart_123");
      return { type: "order", order: { id: "order_42" } };
    };

    await expect(completePendingOrder()).resolves.toEqual({
      kind: "order",
      orderId: "order_42",
    });
    expect(state.cleared).toBe(1);
  });

  it("stays pending while the payment is not authorised — and keeps the cart", async () => {
    await expect(completePendingOrder()).resolves.toEqual({ kind: "pending" });
    expect(state.cleared).toBe(0);
  });

  it("treats a network/backend failure as pending, never as an error shown to the customer", async () => {
    state.complete = async () => {
      throw new Error("fetch failed");
    };

    await expect(completePendingOrder()).resolves.toEqual({ kind: "pending" });
    expect(state.cleared).toBe(0);
  });

  it("reports missing when this browser has no cart cookie", async () => {
    state.cartId = null;

    await expect(completePendingOrder()).resolves.toEqual({ kind: "missing" });
    expect(state.cleared).toBe(0);
  });
});
