import { describe, expect, it } from "vitest";
import {
  MAX_LINE_QUANTITY,
  planAdd,
  planCorrectionAfterCreate,
  planRemove,
  planSetQuantity,
} from "./plan";
import type { CartLineView } from "./types";

function line(over: Partial<CartLineView> = {}): CartLineView {
  return {
    id: "item_1",
    variantId: "variant_papers",
    productHandle: "raw-classic-king-size-slim",
    title: "RAW Classic King Size Slim",
    variantTitle: "1 Heftchen",
    quantity: 20,
    unitPrice: 1.95,
    lineTotal: 39,
    ...over,
  };
}

describe("planAdd", () => {
  it("creates a line for a variant the cart does not have yet", () => {
    expect(planAdd([], "variant_papers", 24)).toEqual({
      kind: "create",
      variantId: "variant_papers",
      quantity: 24,
    });
  });

  /**
   * THE REGRESSION THIS WHOLE MODULE EXISTS FOR.
   *
   * Measured against Medusa 2.13.6 with a 1/10/24 quantity break
   * (2.50 / 1.95 / 1.40): a SECOND `POST /line-items` for a variant already in
   * the cart merges the lines but prices the merged line at the tier for the
   * DELTA quantity. 20 + 4 therefore came back as 24 x 2.50 = CHF 60.00 for a
   * basket worth 24 x 1.40 = CHF 33.60.
   *
   * An absolute-quantity update re-prices at 24 and charges 33.60.
   */
  it("updates to the merged absolute quantity instead of adding a second time", () => {
    expect(planAdd([line({ quantity: 20 })], "variant_papers", 4)).toEqual({
      kind: "update",
      itemId: "item_1",
      quantity: 24,
    });
  });

  it("never emits a create for a variant that is already in the cart", () => {
    for (const qty of [1, 3, 4, 10, 500]) {
      const plan = planAdd([line({ quantity: 20 })], "variant_papers", qty);
      expect(plan.kind).toBe("update");
    }
  });

  it("ignores non-positive and non-finite quantities", () => {
    expect(planAdd([], "variant_papers", 0).kind).toBe("noop");
    expect(planAdd([], "variant_papers", -3).kind).toBe("noop");
    expect(planAdd([], "variant_papers", Number.NaN).kind).toBe("noop");
  });

  it("caps at the maximum line quantity", () => {
    expect(planAdd([], "variant_papers", 5000)).toEqual({
      kind: "create",
      variantId: "variant_papers",
      quantity: MAX_LINE_QUANTITY,
    });
    // Already at the cap: adding more would be a write that changes nothing.
    expect(
      planAdd([line({ quantity: MAX_LINE_QUANTITY })], "variant_papers", 10).kind,
    ).toBe("noop");
  });
});

describe("planSetQuantity", () => {
  it("updates to the absolute quantity", () => {
    expect(planSetQuantity([line({ quantity: 20 })], "variant_papers", 24)).toEqual(
      { kind: "update", itemId: "item_1", quantity: 24 },
    );
  });

  it("deletes the line at zero or below", () => {
    expect(planSetQuantity([line()], "variant_papers", 0)).toEqual({
      kind: "delete",
      itemId: "item_1",
    });
    expect(planSetQuantity([line()], "variant_papers", -1)).toEqual({
      kind: "delete",
      itemId: "item_1",
    });
  });

  it("does nothing when the quantity is already right", () => {
    expect(planSetQuantity([line({ quantity: 7 })], "variant_papers", 7).kind).toBe(
      "noop",
    );
  });

  it("does nothing for a variant that is not in the cart", () => {
    expect(planSetQuantity([line()], "variant_unknown", 3).kind).toBe("noop");
  });
});

describe("planRemove", () => {
  it("deletes by line item id, not by variant id", () => {
    expect(planRemove([line({ id: "item_abc" })], "variant_papers")).toEqual({
      kind: "delete",
      itemId: "item_abc",
    });
  });

  it("does nothing for a variant that is not in the cart", () => {
    expect(planRemove([line()], "variant_unknown").kind).toBe("noop");
  });
});

describe("planCorrectionAfterCreate", () => {
  it("does nothing when the created line came out as requested", () => {
    expect(planCorrectionAfterCreate(line({ quantity: 24 }), 24).kind).toBe("noop");
  });

  /**
   * The race `planAdd` cannot see: a line for the same variant appeared between
   * the read and the write, so Medusa merged our create into it and priced the
   * result at the delta. The tell needs no price data — a create that was not
   * merged yields exactly the quantity we asked for.
   */
  it("re-prices at the merged quantity when Medusa merged the create", () => {
    expect(planCorrectionAfterCreate(line({ quantity: 24 }), 4)).toEqual({
      kind: "update",
      itemId: "item_1",
      quantity: 24,
    });
  });

  it("does nothing when there is no line to correct", () => {
    expect(planCorrectionAfterCreate(undefined, 4).kind).toBe("noop");
  });
});
