import { describe, expect, it, vi } from "vitest";
import { SWISS_SHIPPING_PROVIDER_ID as SWISS, pickShippingOption } from "./shipping-choice";

const noPrice = vi.fn(async () => null);

describe("pickShippingOption", () => {
  it("takes the jibbit swiss-shipping option over a cheaper foreign one, without pricing", async () => {
    const priceOf = vi.fn(async () => 0);
    const id = await pickShippingOption(
      [
        { id: "so_free", providerId: "manual_manual", amount: 0 },
        { id: "so_swiss", providerId: SWISS, amount: null },
      ],
      priceOf,
    );
    expect(id).toBe("so_swiss");
    expect(priceOf).not.toHaveBeenCalled();
  });

  it("among several swiss-shipping options, the cheapest wins (calculated ones are priced)", async () => {
    const priceOf = vi.fn(async (id: string) => (id === "so_a" ? 9 : 4.5));
    const id = await pickShippingOption(
      [
        { id: "so_a", providerId: SWISS },
        { id: "so_b", providerId: SWISS },
        { id: "so_c", providerId: "manual_manual", amount: 0 },
      ],
      priceOf,
    );
    expect(id).toBe("so_b");
    expect(priceOf).toHaveBeenCalledTimes(2);
  });

  it("without swiss-shipping, the cheapest eligible option", async () => {
    const id = await pickShippingOption(
      [
        { id: "so_exp", amount: 12 },
        { id: "so_cheap_but_no_stock", amount: 1, insufficientInventory: true },
        { id: "so_std", amount: 7 },
      ],
      noPrice,
    );
    expect(id).toBe("so_std");
  });

  it("an option whose price cannot be determined loses to any priced one", async () => {
    const priceOf = vi.fn(async () => {
      throw new Error("calc failed");
    });
    const id = await pickShippingOption(
      [{ id: "so_unknown" }, { id: "so_known", amount: 20 }],
      priceOf,
    );
    expect(id).toBe("so_known");
  });

  it("null when nothing can ship", async () => {
    expect(await pickShippingOption([], noPrice)).toBeNull();
    expect(
      await pickShippingOption([{ id: "so", insufficientInventory: true }], noPrice),
    ).toBeNull();
  });
});

describe("pickShippingOption — Abholung im Laden", () => {
  // Wie im Staging-Admin: Abholung ist flat CHF 0 auf demselben Provider.
  const options = [
    { id: "so_swiss", providerId: SWISS, amount: null },
    {
      id: "so_pickup",
      providerId: SWISS,
      amount: 0,
      metadata: { pickup: true },
      data: { id: "swiss-pickup", pickup: true },
      type: { code: "pickup" },
    },
  ];

  it("Lieferung: die gratis Abholung gewinnt NICHT als «günstigste» Option", async () => {
    const priceOf = vi.fn(async () => 4.5);
    expect(await pickShippingOption(options, priceOf)).toBe("so_swiss");
    // Nur eine Versandoption übrig — kein Preisvergleich nötig.
    expect(priceOf).not.toHaveBeenCalled();
  });

  it("Abholung: genau die Option mit dem Marker, egal wie sie heisst", async () => {
    expect(await pickShippingOption(options, noPrice, "pickup")).toBe("so_pickup");
    expect(
      await pickShippingOption(
        [{ id: "so_a", providerId: SWISS }, { id: "so_b", type: { code: "pickup" } }],
        noPrice,
        "pickup",
      ),
    ).toBe("so_b");
    expect(
      await pickShippingOption(
        [{ id: "so_a", providerId: SWISS }, { id: "so_b", data: { pickup: true } }],
        noPrice,
        "pickup",
      ),
    ).toBe("so_b");
  });

  it("Abholung ohne passende Option: null — nie stillschweigend Versand", async () => {
    expect(await pickShippingOption([{ id: "so_swiss", providerId: SWISS }], noPrice, "pickup")).toBeNull();
    expect(
      await pickShippingOption([{ ...options[1], insufficientInventory: true }], noPrice, "pickup"),
    ).toBeNull();
  });

  it("Lieferung ohne Versandoption (nur Abholung im Angebot): null", async () => {
    expect(await pickShippingOption([options[1]], noPrice)).toBeNull();
  });
});
