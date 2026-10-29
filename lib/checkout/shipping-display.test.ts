import { describe, expect, it } from "vitest";
import {
  SHIPPING_METHOD_LABEL,
  deliveryOptionViews,
  handlingTimeText,
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

describe("deliveryOptionViews", () => {
  it("Versand gewählt: Medusas Betrag, Abholung gratis", () => {
    const [post, pickup] = deliveryOptionViews({ pickup: false, shipping: 4.5, subtotal: 38.4 });
    expect(post.value).toBe("shipping");
    expect(post.title).toBe(SHIPPING_METHOD_LABEL);
    expect(plain(post.cost)).toBe("CHF 4.50");
    expect(post.estimate).toBe(false);
    expect(post.detail).toBe("Versand in der Regel innerhalb von 1–3 Werktagen");
    expect(pickup.value).toBe("pickup");
    expect(pickup.cost).toBe("Gratis");
    expect(pickup.estimate).toBe(false);
    expect(pickup.detail).toContain("Abholzeiten");
  });

  it("Abholung gewählt: Versand nur als Schätzung des Shops", () => {
    const [post] = deliveryOptionViews({ pickup: true, shipping: 0, subtotal: 38.4 });
    expect(plain(post.cost)).toBe("CHF 4.50");
    expect(post.estimate).toBe(true);
    const [free] = deliveryOptionViews({ pickup: true, shipping: 0, subtotal: 92.4 });
    expect(free.cost).toBe("Gratis");
  });

  it("Versand gewählt, aber noch ohne Methode auf dem Cart: geschätzt", () => {
    const [post] = deliveryOptionViews({ pickup: false, shipping: 4.5, subtotal: 10, estimate: true });
    expect(post.estimate).toBe(true);
  });
});
