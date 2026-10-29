import { describe, expect, it, vi } from "vitest";
import { applyAvailability, fetchAvailability } from "./availability";
import type { CartState } from "./types";
import { EMPTY_CART } from "./types";

const line = (variantId: string, quantity = 1) => ({
  id: `li_${variantId}`,
  variantId,
  productHandle: "h",
  title: "T",
  variantTitle: "",
  quantity,
  unitPrice: 1,
  lineTotal: quantity,
});

describe("fetchAvailability", () => {
  it("fragt einmal nach und rechnet jede Variante nach der Bestandsregel", async () => {
    const list = vi.fn(async () => ({
      products: [
        {
          id: "p1",
          variants: [
            { id: "v1", manage_inventory: true, inventory_quantity: 7 },
            { id: "v2", manage_inventory: false, inventory_quantity: 0 },
          ],
        },
      ],
    }));
    const sdk = { store: { product: { list } } } as never;
    const map = await fetchAvailability(sdk, ["p1", "p1", ""], "reg");
    expect(list).toHaveBeenCalledTimes(1);
    expect(map.get("v1")).toBe(7);
    expect(map.get("v2")).toBeNull();
  });

  it("fragt nicht, wenn es nichts zu fragen gibt", async () => {
    const list = vi.fn();
    const sdk = { store: { product: { list } } } as never;
    expect((await fetchAvailability(sdk, [])).size).toBe(0);
    expect(list).not.toHaveBeenCalled();
  });
});

describe("applyAvailability", () => {
  const state: CartState = { ...EMPTY_CART, lines: [line("v1", 9), line("v3")], count: 10 };

  it("legt den Bestand auf die Positionen, Unbekanntes bleibt unberührt", () => {
    const next = applyAvailability(state, new Map([["v1", 7]]));
    expect(next.lines[0].availableQuantity).toBe(7);
    expect(next.lines[1].availableQuantity).toBeUndefined();
  });

  it("gibt den Warenkorb unverändert zurück ohne Daten", () => {
    expect(applyAvailability(state, new Map())).toBe(state);
  });
});
