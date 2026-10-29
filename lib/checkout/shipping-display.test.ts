import { describe, expect, it } from "vitest";
import {
  SHIPPING_METHOD_LABEL,
  handlingTimeText,
  missingForFreeShippingText,
  quantityTimesPrice,
  shippingDisplay,
} from "./shipping-display";

// Intl setzt zwischen «CHF» und Betrag ein geschütztes Leerzeichen.
const plain = (text: string | null) => text?.replaceAll(" ", " ") ?? null;

describe("shippingDisplay", () => {
  it("zeigt den Versandpreis als Betrag", () => {
    const d = shippingDisplay({ pickup: false, shipping: 4.5 });
    expect({ ...d, cost: plain(d.cost) }).toEqual({
      label: SHIPPING_METHOD_LABEL,
      cost: "CHF 4.50",
      free: false,
      estimate: false,
      timing: "Versand in der Regel innerhalb von 1–3 Werktagen",
    });
  });

  it("zeigt «Gratis» ab der Schwelle", () => {
    const d = shippingDisplay({ pickup: false, shipping: 0 });
    expect(d.cost).toBe("Gratis");
    expect(d.free).toBe(true);
  });

  it("kennzeichnet die Schätzung vor der Methode", () => {
    expect(shippingDisplay({ pickup: false, shipping: 4.5, estimate: true }).estimate).toBe(true);
  });

  it("Abholung: eigener Name, gratis, keine Lieferzeit, nie geschätzt", () => {
    const d = shippingDisplay({ pickup: true, shipping: 0, estimate: true });
    expect(d.label).toBe("Abholung im Laden");
    expect(d.cost).toBe("Gratis");
    expect(d.timing).toBeNull();
    expect(d.estimate).toBe(false);
  });
});

describe("handlingTimeText", () => {
  it("entspricht der Zusage auf /service/versand", () => {
    expect(handlingTimeText()).toBe("Versand in der Regel innerhalb von 1–3 Werktagen");
  });
});

describe("missingForFreeShippingText", () => {
  it("nennt den fehlenden Betrag", () => {
    expect(plain(missingForFreeShippingText(26.1))).toBe("Noch CHF 26.10 bis Gratisversand");
  });

  it("schweigt, wenn nichts fehlt oder abgeholt wird", () => {
    expect(missingForFreeShippingText(0)).toBeNull();
    expect(missingForFreeShippingText(10, true)).toBeNull();
  });
});

describe("quantityTimesPrice", () => {
  it("formatiert Menge und Einzelpreis", () => {
    expect(plain(quantityTimesPrice(24, 1.6))).toBe("24 × CHF 1.60");
  });
});
