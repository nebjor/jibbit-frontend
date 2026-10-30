import { describe, expect, it } from "vitest";
import type { Aktion } from "@/lib/aktionen";
import { AKTION_MARKER, pruefeAktion, type AktionCartLike } from "./aktion";

const JETZT = Date.parse("2026-10-30T12:00:00Z");

function aktion(overrides: Partial<Aktion> = {}): Aktion {
  return {
    code: "EROEFFNUNG20",
    titel: "Eröffnung",
    prozent: 20,
    giltAb: "2026-10-30T08:00:00Z",
    giltBis: "2026-11-03T18:30:00Z",
    nurTeilsortiment: false,
    aufArtikel: true,
    ...overrides,
  };
}

const MIT_ARTIKEL = [{ id: "li_1" }];
const STAND = "EROEFFNUNG20@2026-10-30T08:00:00Z";

describe("pruefeAktion", () => {
  it("zieht nach, wenn eine laufende Aktion im Warenkorb fehlt", () => {
    const cart: AktionCartLike = { items: MIT_ARTIKEL, promotions: [] };
    expect(pruefeAktion(cart, [aktion()], JETZT)).toEqual({
      nachziehen: true,
      stand: STAND,
    });
  });

  it("zieht nicht nach, wenn der Warenkorb die Aktion schon trägt", () => {
    const cart: AktionCartLike = {
      items: MIT_ARTIKEL,
      promotions: [{ code: "EROEFFNUNG20", is_automatic: true }],
    };
    expect(pruefeAktion(cart, [aktion()], JETZT).nachziehen).toBe(false);
  });

  it("zieht nicht nach ohne Positionen oder bei abgeschlossenem Warenkorb", () => {
    expect(pruefeAktion({ items: [], promotions: [] }, [aktion()], JETZT).nachziehen).toBe(false);
    expect(pruefeAktion({ promotions: [] }, [aktion()], JETZT).nachziehen).toBe(false);
    expect(
      pruefeAktion(
        { items: MIT_ARTIKEL, promotions: [], completed_at: "2026-10-30T11:00:00Z" },
        [aktion()],
        JETZT,
      ).nachziehen,
    ).toBe(false);
  });

  it("zieht nicht nach, wenn keine Aktion läuft und der Warenkorb keine trägt", () => {
    const entscheid = pruefeAktion({ items: MIT_ARTIKEL, promotions: [] }, [], JETZT);
    expect(entscheid).toEqual({ nachziehen: false, stand: "-" });
  });

  it("zieht nach, wenn die Aktion beendet ist, der Warenkorb sie aber noch trägt", () => {
    const cart: AktionCartLike = {
      items: MIT_ARTIKEL,
      promotions: [{ code: "EROEFFNUNG20", is_automatic: true }],
    };
    // Backend meldet nichts mehr ...
    expect(pruefeAktion(cart, [], JETZT)).toEqual({ nachziehen: true, stand: "-" });
    // ... und auch eine noch gecachte Antwort zählt nicht, wenn das Ende vorbei ist.
    const abgelaufen = aktion({ giltBis: "2026-10-30T11:59:00Z" });
    expect(pruefeAktion(cart, [abgelaufen], JETZT).nachziehen).toBe(true);
  });

  it("ignoriert eine Aktion, die erst noch beginnt", () => {
    const spaeter = aktion({ giltAb: "2026-10-31T00:00:00Z" });
    const entscheid = pruefeAktion({ items: MIT_ARTIKEL, promotions: [] }, [spaeter], JETZT);
    expect(entscheid).toEqual({ nachziehen: false, stand: "-" });
  });

  it("zieht nicht erneut nach, wenn dieser Stand schon geprüft wurde", () => {
    // Medusa hat nach dem Update keinen Rabatt gegeben (Regeln nicht erfüllt).
    const cart: AktionCartLike = {
      items: MIT_ARTIKEL,
      promotions: [],
      metadata: { [AKTION_MARKER]: STAND },
    };
    expect(pruefeAktion(cart, [aktion()], JETZT).nachziehen).toBe(false);
  });

  it("zieht erneut nach, wenn sich der Stand der Aktionen geändert hat", () => {
    const cart: AktionCartLike = {
      items: MIT_ARTIKEL,
      promotions: [],
      metadata: { [AKTION_MARKER]: "-" },
    };
    expect(pruefeAktion(cart, [aktion()], JETZT).nachziehen).toBe(true);
  });

  it("fordert für Teilsortiment-Aktionen nichts nach, wenn sie fehlen", () => {
    const teil = aktion({ code: "PAPERS10", nurTeilsortiment: true });
    expect(pruefeAktion({ items: MIT_ARTIKEL, promotions: [] }, [teil], JETZT).nachziehen).toBe(false);
  });

  it("lässt manuelle Codes in Ruhe", () => {
    const cart: AktionCartLike = {
      items: MIT_ARTIKEL,
      promotions: [{ code: "FREUND5", is_automatic: false }],
    };
    expect(pruefeAktion(cart, [], JETZT).nachziehen).toBe(false);
  });
});
