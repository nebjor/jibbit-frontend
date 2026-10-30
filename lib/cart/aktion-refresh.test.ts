import { beforeEach, describe, expect, it, vi } from "vitest";
import type Medusa from "@medusajs/js-sdk";
import type { HttpTypes } from "@medusajs/types";

const mocks = vi.hoisted(() => ({ aktionen: [] as unknown[] }));

vi.mock("@/lib/data", () => ({ getAktionen: vi.fn(async () => mocks.aktionen) }));

import { refreshAktionIfNeeded } from "./aktion-refresh";

const AKTION = {
  code: "EROEFFNUNG20",
  titel: "Eröffnung",
  prozent: 20,
  giltAb: new Date(Date.now() - 3_600_000).toISOString(),
  giltBis: new Date(Date.now() + 3_600_000).toISOString(),
  nurTeilsortiment: false,
  aufArtikel: true,
};

function cart(extra: Record<string, unknown> = {}) {
  return { id: "cart_1", items: [{ id: "li_1" }], promotions: [], metadata: { pickup: false }, ...extra } as unknown as HttpTypes.StoreCart;
}

function sdkWith(update: ReturnType<typeof vi.fn>) {
  return { store: { cart: { update } } } as unknown as Medusa;
}

describe("refreshAktionIfNeeded", () => {
  beforeEach(() => {
    mocks.aktionen = [AKTION];
  });

  it("schickt genau ein Update mit Marker und behält die bisherigen Metadaten", async () => {
    const neu = { id: "cart_1", promotions: [{ code: "EROEFFNUNG20" }] };
    const update = vi.fn(async () => ({ cart: neu }));
    const result = await refreshAktionIfNeeded(sdkWith(update), cart(), "FELDER");

    expect(result).toBe(neu);
    expect(update).toHaveBeenCalledTimes(1);
    const [id, body, query] = update.mock.calls[0] as unknown as [string, { metadata: Record<string, unknown> }, unknown];
    expect(id).toBe("cart_1");
    expect(body.metadata.pickup).toBe(false);
    expect(body.metadata.aktion_geprueft).toContain("EROEFFNUNG20");
    expect(typeof body.metadata.aktion_geprueft_am).toBe("string");
    expect(query).toEqual({ fields: "FELDER" });
  });

  it("schreibt nichts, wenn der Warenkorb die Aktion schon trägt", async () => {
    const update = vi.fn();
    const c = cart({ promotions: [{ code: "EROEFFNUNG20", is_automatic: true }] });
    expect(await refreshAktionIfNeeded(sdkWith(update), c, "F")).toBe(c);
    expect(update).not.toHaveBeenCalled();
  });

  it("gibt bei einem Fehler den unveränderten Warenkorb zurück", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const update = vi.fn(async () => {
      throw new Error("boom");
    });
    const c = cart();
    expect(await refreshAktionIfNeeded(sdkWith(update), c, "F")).toBe(c);
  });
});
