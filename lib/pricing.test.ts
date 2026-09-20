import { describe, expect, it } from "vitest";
import {
  activeTier,
  defaultVariant,
  lineTotal,
  nextTier,
  packAdvantagePercent,
  preselectedVariant,
  pricePerUnit,
  unitPriceFor,
  upgradeHint,
} from "./pricing";
import type { CartLine, PriceTier, ProductVariantView } from "./types";

/** Greengo Unbleached Slim Rolls, single — the real catalogue data. */
const GREENGO: PriceTier[] = [
  { minQuantity: 1, maxQuantity: 9, price: 1.95 },
  { minQuantity: 10, maxQuantity: 23, price: 1.85 },
  { minQuantity: 24, maxQuantity: 47, price: 1.4 },
  { minQuantity: 48, maxQuantity: 119, price: 1.35 },
  { minQuantity: 120, maxQuantity: null, price: 1.3 },
];

function variant(over: Partial<ProductVariantView> = {}): ProductVariantView {
  return {
    id: "v1",
    title: "Einzeln",
    price: 1.95,
    inStock: true,
    tiers: GREENGO,
    unitsPerPack: 1,
    packType: "single",
    ...over,
  };
}

describe("activeTier", () => {
  it("picks the tier containing the quantity", () => {
    expect(activeTier(GREENGO, 1)?.price).toBe(1.95);
    expect(activeTier(GREENGO, 9)?.price).toBe(1.95);
    expect(activeTier(GREENGO, 10)?.price).toBe(1.85);
    expect(activeTier(GREENGO, 23)?.price).toBe(1.85);
    expect(activeTier(GREENGO, 24)?.price).toBe(1.4);
  });

  it("keeps the open-ended top tier for any large quantity", () => {
    expect(activeTier(GREENGO, 120)?.price).toBe(1.3);
    expect(activeTier(GREENGO, 100_000)?.price).toBe(1.3);
  });

  it("returns undefined without tiers", () => {
    expect(activeTier([], 5)).toBeUndefined();
  });
});

describe("unitPriceFor", () => {
  it("falls back to the flat price when a variant has no tiers", () => {
    expect(unitPriceFor([], 12, 27)).toBe(27);
  });
});

describe("nextTier", () => {
  it("finds the next cheaper step", () => {
    expect(nextTier(GREENGO, 6)?.minQuantity).toBe(10);
    expect(nextTier(GREENGO, 10)?.minQuantity).toBe(24);
  });

  it("is undefined once the top tier is reached", () => {
    expect(nextTier(GREENGO, 120)).toBeUndefined();
    expect(nextTier(GREENGO, 500)).toBeUndefined();
  });

  it("skips a step that is not actually cheaper", () => {
    // What rounding to 5 Rappen can produce: two tiers at the same price.
    const flat: PriceTier[] = [
      { minQuantity: 1, maxQuantity: 9, price: 1.1 },
      { minQuantity: 10, maxQuantity: 23, price: 1.1 },
      { minQuantity: 24, maxQuantity: null, price: 0.95 },
    ];
    expect(nextTier(flat, 5)?.minQuantity).toBe(24);
  });
});

describe("upgradeHint", () => {
  it("counts the units missing and the saving on the larger basket", () => {
    const hint = upgradeHint(GREENGO, 10);
    // 24 units at 1.85 = 44.40, at 1.40 = 33.60 -> saves 10.80
    expect(hint).toEqual({
      missing: 14,
      nextPrice: 1.4,
      atQuantity: 24,
      saves: 10.8,
    });
  });

  it("is undefined at the top tier", () => {
    expect(upgradeHint(GREENGO, 120)).toBeUndefined();
  });

  it("is undefined without tiers", () => {
    expect(upgradeHint([], 3)).toBeUndefined();
  });
});

describe("lineTotal", () => {
  const line = (quantity: number, tiers?: PriceTier[]): CartLine => ({
    variantId: "v1",
    productHandle: "greengo",
    title: "Greengo",
    variantTitle: "Einzeln",
    price: 1.95,
    quantity,
    tiers,
  });

  it("reprices when the quantity crosses a tier boundary", () => {
    expect(lineTotal(line(6, GREENGO))).toBe(11.7); // 6 x 1.95
    expect(lineTotal(line(24, GREENGO))).toBe(33.6); // 6 x 1.40, not 24 x 1.95
  });

  it("uses the flat price for lines without tiers", () => {
    expect(lineTotal(line(3))).toBe(5.85);
  });

  it("does not leak binary float dust into the total", () => {
    const tiers: PriceTier[] = [{ minQuantity: 1, maxQuantity: null, price: 0.1 }];
    expect(lineTotal(line(3, tiers))).toBe(0.3);
  });
});

describe("defaultVariant", () => {
  it("preselects the single, never the display", () => {
    const single = variant();
    const display = variant({
      id: "v2",
      title: "Display (24 Stk.)",
      packType: "display",
      unitsPerPack: 24,
    });
    expect(defaultVariant([display, single])?.id).toBe("v1");
  });

  it("skips a sold-out single", () => {
    const single = variant({ inStock: false });
    const display = variant({ id: "v2", packType: "display", unitsPerPack: 24 });
    expect(defaultVariant([single, display])?.id).toBe("v2");
  });

  it("falls back to the first variant when everything is sold out", () => {
    const a = variant({ id: "a", inStock: false, packType: "display" });
    const b = variant({ id: "b", inStock: false, packType: "display" });
    expect(defaultVariant([a, b])?.id).toBe("a");
  });
});

describe("packAdvantagePercent", () => {
  const single = variant();

  it("stays silent when the pack is priced exactly like the singles", () => {
    // Greengo display: 33.60 for 24 -> 1.40/unit, same as the 24+ tier.
    const display = variant({
      id: "d",
      packType: "display",
      unitsPerPack: 24,
      price: 33.6,
      tiers: [{ minQuantity: 1, maxQuantity: null, price: 33.6 }],
    });
    expect(packAdvantagePercent(display, single)).toBeNull();
  });

  it("flags a pack that really is cheaper per unit", () => {
    // RAW Black: display 50.00 for 50 -> 1.00/unit against 1.79 single.
    const rawSingle = variant({
      price: 1.89,
      tiers: [
        { minQuantity: 1, maxQuantity: 9, price: 1.89 },
        { minQuantity: 10, maxQuantity: null, price: 1.79 },
      ],
    });
    const display = variant({
      id: "d",
      packType: "display",
      unitsPerPack: 50,
      price: 50,
      tiers: [{ minQuantity: 1, maxQuantity: null, price: 50 }],
    });
    expect(packAdvantagePercent(display, rawSingle)).toBe(44);
  });

  it("never flags the single itself", () => {
    expect(packAdvantagePercent(single, single)).toBeNull();
  });
});

describe("pricePerUnit", () => {
  it("is null for a single unit — the price already is the unit price", () => {
    expect(pricePerUnit(variant(), 1)).toBeNull();
  });

  it("divides a pack price by its contents", () => {
    const display = variant({
      packType: "display",
      unitsPerPack: 24,
      price: 33.6,
      tiers: [{ minQuantity: 1, maxQuantity: null, price: 33.6 }],
    });
    expect(pricePerUnit(display, 1)).toBeCloseTo(1.4, 5);
  });
});

describe("preselectedVariant (?variant=)", () => {
  const single = variant({ id: "v1" });
  const display = variant({ id: "v2", packType: "display", unitsPerPack: 24 });

  it("selects the requested variant — the URL Google crawls per variant", () => {
    expect(preselectedVariant([single, display], "v2")?.id).toBe("v2");
  });

  it("keeps a requested variant even when it is sold out", () => {
    const soldOut = { ...display, inStock: false };
    expect(preselectedVariant([single, soldOut], "v2")?.id).toBe("v2");
  });

  it("falls back to the default for unknown, empty or missing ids", () => {
    for (const requested of ["nope", "", undefined]) {
      expect(preselectedVariant([display, single], requested)?.id).toBe("v1");
    }
  });

  it("takes the first value when the parameter is repeated", () => {
    expect(preselectedVariant([single, display], ["v2", "v1"])?.id).toBe("v2");
  });
});
