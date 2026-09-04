import { describe, expect, it } from "vitest";
import {
  addToCartEvent,
  checkoutStartedEvent,
  orderCompletedEvent,
  productViewedEvent,
  type AnalyticsEvent,
} from "./events";
import type { ProductView } from "@/lib/types";

/**
 * DIE Personendaten-Zusage, als Test: Kein Handelsereignis trägt E-Mail,
 * Name, Adresse oder Telefonnummer — auch dann nicht, wenn die Quelle
 * (Cart, Bestellung) all das enthält. Die Fixtures sind deshalb absichtlich
 * VOLLGESTOPFT mit Personendaten; die Tests prüfen, dass nichts davon in
 * der Payload landet.
 */

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const product: ProductView = {
  id: "prod_1",
  handle: "papers-x",
  title: "Papers X King Size",
  brand: "Papers X",
  subtitle: "Ungebleicht, langsam brennend",
  description: "…",
  categoryHandle: "papers",
  currency: "CHF",
  price: 1.95,
  variants: [
    {
      id: "variant_single",
      title: "Einzeln",
      price: 1.95,
      inStock: true,
      tiers: [],
      unitsPerPack: 1,
      packType: "single",
    },
    {
      id: "variant_display",
      title: "Display (24)",
      price: 33.6,
      inStock: false,
      tiers: [],
      unitsPerPack: 24,
      packType: "display",
    },
  ],
  images: [],
  featured: false,
};

/** Personendaten, die NIRGENDS in einer Payload auftauchen dürfen. */
const PII_VALUES = [
  "vreni.muster@example.ch",
  "Vreni",
  "Muster",
  "Bahnhofstrasse 7",
  "8404",
  "Winterthur",
  "+41 79 123 45 67",
];

/** Der volle CartState — inklusive allem, was NICHT mitwandern darf. */
const cartWithPii = {
  id: "cart_1",
  lines: [
    { productHandle: "papers-x", quantity: 3 },
    { productHandle: "grinder-y", quantity: 1 },
  ],
  count: 4,
  subtotal: 39.45,
  shipping: 0,
  total: 39.45,
  hasShippingMethod: false,
  currency: "CHF",
  email: "vreni.muster@example.ch",
  hasShippingAddress: true,
  address: {
    firstName: "Vreni",
    lastName: "Muster",
    address1: "Bahnhofstrasse 7",
    postalCode: "8404",
    city: "Winterthur",
    countryCode: "ch",
    phone: "+41 79 123 45 67",
  },
};

/** Eine Bestellung, wie OrderView sie liefert — samt Personendaten. */
const orderWithPii = {
  id: "order_01HXYZ",
  displayId: 7,
  email: "vreni.muster@example.ch",
  currency: "CHF",
  lines: [
    { productHandle: "papers-x", quantity: 3 },
    { productHandle: "grinder-y", quantity: 1 },
  ],
  subtotal: 39.45,
  shipping: 3.75,
  total: 43.2,
  address: {
    firstName: "Vreni",
    lastName: "Muster",
    address1: "Bahnhofstrasse 7",
    postalCode: "8404",
    city: "Winterthur",
    countryCode: "ch",
    phone: "+41 79 123 45 67",
  },
};

/**
 * Property-NAMEN, die auf Personendaten hindeuten würden. `product_title`
 * u. Ä. enthalten "title", nicht "name" — die Liste ist bewusst eng genug,
 * um Katalogfelder nicht zu treffen, und weit genug für alles Persönliche.
 */
const PII_KEY_PATTERN =
  /(email|phone|first_?name|last_?name|address|street|city|postal|zip|customer)/i;

function expectNoPii(event: AnalyticsEvent) {
  const serialized = JSON.stringify(event);
  for (const value of PII_VALUES) {
    expect(serialized).not.toContain(value);
  }
  for (const key of Object.keys(event.properties)) {
    expect(key).not.toMatch(PII_KEY_PATTERN);
  }
}

// ---------------------------------------------------------------------------
// product_viewed
// ---------------------------------------------------------------------------

describe("productViewedEvent", () => {
  it("trägt Katalogdaten, Preis und Verfügbarkeit", () => {
    const event = productViewedEvent(product);
    expect(event.name).toBe("product_viewed");
    expect(event.properties).toEqual({
      product_handle: "papers-x",
      product_title: "Papers X King Size",
      brand: "Papers X",
      category: "papers",
      price: 1.95,
      currency: "CHF",
      in_stock: true,
    });
  });

  it("meldet brand als null statt Leerstring", () => {
    const event = productViewedEvent({ ...product, brand: "" });
    expect(event.properties.brand).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// product_added_to_cart
// ---------------------------------------------------------------------------

describe("addToCartEvent", () => {
  it("trägt Variante, Menge und rappengenauen Zeilenwert", () => {
    const event = addToCartEvent(product, product.variants[0], 3, 1.95);
    expect(event.name).toBe("product_added_to_cart");
    expect(event.properties).toEqual({
      product_handle: "papers-x",
      product_title: "Papers X King Size",
      variant_id: "variant_single",
      variant_title: "Einzeln",
      category: "papers",
      unit_price: 1.95,
      quantity: 3,
      line_value: 5.85,
      currency: "CHF",
    });
  });

  it("rundet den Zeilenwert auf Rappen (kein Float-Drift)", () => {
    const event = addToCartEvent(product, product.variants[0], 3, 1.1);
    // 3 * 1.1 wäre in Float 3.3000000000000003.
    expect(event.properties.line_value).toBe(3.3);
  });
});

// ---------------------------------------------------------------------------
// checkout_started — keine Personendaten
// ---------------------------------------------------------------------------

describe("checkoutStartedEvent", () => {
  it("trägt Warenwert, Stückzahl und Produkt-Handles", () => {
    const event = checkoutStartedEvent(cartWithPii);
    expect(event.name).toBe("checkout_started");
    expect(event.properties).toEqual({
      item_count: 4,
      goods_value: 39.45,
      currency: "CHF",
      products: ["papers-x", "grinder-y"],
    });
  });

  it("lässt E-Mail, Adresse und Telefonnummer des Carts vollständig weg", () => {
    // Der Cart ENTHÄLT all das — das Ereignis darf es trotzdem nicht.
    expectNoPii(checkoutStartedEvent(cartWithPii));
  });
});

// ---------------------------------------------------------------------------
// order_completed — Wert und Währung ja, Personendaten nein
// ---------------------------------------------------------------------------

describe("orderCompletedEvent", () => {
  it("trägt Bestellnummer, Bestellwert und Währung für Trichter und Umsatz", () => {
    const event = orderCompletedEvent(orderWithPii);
    expect(event.name).toBe("order_completed");
    expect(event.properties).toEqual({
      order_id: "order_01HXYZ",
      order_display_id: 7,
      value: 43.2,
      goods_value: 39.45,
      shipping_value: 3.75,
      currency: "CHF",
      item_count: 4,
      products: ["papers-x", "grinder-y"],
    });
  });

  it("lässt E-Mail, Adresse und Telefonnummer der Bestellung vollständig weg", () => {
    // Die Bestellung ENTHÄLT all das — das Ereignis darf es trotzdem nicht.
    expectNoPii(orderCompletedEvent(orderWithPii));
  });
});
