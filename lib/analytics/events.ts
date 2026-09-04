/**
 * Die Handelsereignisse der Storefront — reine Payload-Bauer, ohne DOM und
 * ohne posthog-js, damit sie unter Vitest (environment: node) testbar sind.
 *
 * Jedes Tracking läuft über eine Funktion aus dieser Datei — Komponenten
 * rufen nie direkt `posthog.capture()` auf. Zwei Gründe:
 *
 *  1. Event- und Property-Namen bleiben konsistent. Ein Trichter, der auf
 *     `product_added_to_cart` gebaut ist, ist stillschweigend kaputt, sobald
 *     irgendwo `addToCart` geschrieben wird — und das fällt erst Wochen
 *     später auf.
 *  2. KEINE PERSONENDATEN. Diese Datei ist die einzige Stelle, die
 *     entscheidet, was in einem Ereignis steht. Jede Property wird hier
 *     einzeln und ausdrücklich aufgeführt — nie ein ganzes Objekt
 *     durchgereicht. Was hier nicht steht, kann nirgends mitwandern.
 *
 * ═══ WARUM HIER FELDER BEWUSST FEHLEN ══════════════════════════════════
 * Warenkorb und Bestellung tragen E-Mail-Adresse, Name, Liefer­adresse und
 * Telefonnummer. NICHTS davon gehört in ein Analyse-Ereignis:
 *
 *   - `email`, `firstName`/`lastName`, `address`, `phone` — Personendaten.
 *     Eine Auswertung braucht sie nicht; ein Trichter zählt Bestellungen,
 *     keine Personen. Durchgerutscht wären sie ein Datenschutzvorfall.
 *   - Die BESTELLNUMMER (`order_id`, `order_display_id`) ist in Ordnung:
 *     sie identifiziert die Bestellung, nicht die Person — und erlaubt es,
 *     einen Umsatz-Ausreisser im Backend nachzuschlagen, ohne dass die
 *     Person im Analysewerkzeug steht.
 *
 * Im Zweifel gilt: weglassen. Ein fehlendes Merkmal kostet eine Auswertung,
 * ein durchgerutschtes kostet einen Datenschutzvorfall.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Konvention: snake_case für Events und Properties (so erwartet es PostHog).
 * Preise sind dezimale CHF wie überall sonst in der App — nie Rappen.
 */

import type { ProductVariantView, ProductView } from "@/lib/types";

/**
 * Nur Primitive und String-Listen — der Typ verhindert schon beim Kompilieren,
 * dass jemand versehentlich ein ganzes Objekt (etwa eine Adresse) anhängt.
 */
export type EventPropertyValue =
  | string
  | number
  | boolean
  | null
  | readonly string[];

export interface AnalyticsEvent {
  name: string;
  properties: Record<string, EventPropertyValue>;
}

/** Rappengenau runden — schützt vor Float-Drift beim Multiplizieren. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Produkt angesehen
// ---------------------------------------------------------------------------

export function productViewedEvent(product: ProductView): AnalyticsEvent {
  return {
    name: "product_viewed",
    properties: {
      product_handle: product.handle,
      product_title: product.title,
      brand: product.brand || null,
      category: product.categoryHandle,
      price: product.price,
      currency: product.currency,
      in_stock: product.variants.some((v) => v.inStock),
    },
  };
}

// ---------------------------------------------------------------------------
// In den Warenkorb gelegt
// ---------------------------------------------------------------------------

export function addToCartEvent(
  product: ProductView,
  variant: ProductVariantView,
  quantity: number,
  /** Stückpreis, wie ihn die Staffel für diese Menge gerade anzeigt. */
  unitPrice: number,
): AnalyticsEvent {
  return {
    name: "product_added_to_cart",
    properties: {
      product_handle: product.handle,
      product_title: product.title,
      variant_id: variant.id,
      variant_title: variant.title,
      category: product.categoryHandle,
      unit_price: unitPrice,
      quantity,
      line_value: round2(unitPrice * quantity),
      currency: product.currency,
    },
  };
}

// ---------------------------------------------------------------------------
// Kasse begonnen
// ---------------------------------------------------------------------------

/**
 * Bewusst schmaler Eingabetyp: strukturell erfüllt ihn auch der ganze
 * CartState — aber der Bauer greift ausschliesslich auf die hier genannten
 * Felder zu. `email` und `address` des Carts existieren für dieses Ereignis
 * schlicht nicht (siehe Kopfkommentar).
 */
export interface CheckoutStartedInput {
  count: number;
  /** Brutto-Warenwert (Medusas `item_total`). */
  subtotal: number;
  currency: string;
  lines: ReadonlyArray<{ productHandle: string }>;
}

export function checkoutStartedEvent(
  cart: CheckoutStartedInput,
): AnalyticsEvent {
  return {
    name: "checkout_started",
    properties: {
      item_count: cart.count,
      goods_value: cart.subtotal,
      currency: cart.currency,
      products: cart.lines.map((l) => l.productHandle),
    },
  };
}

// ---------------------------------------------------------------------------
// Bestellung abgeschlossen
// ---------------------------------------------------------------------------

/**
 * Wie oben: OrderView erfüllt diesen Typ strukturell, aber E-Mail, Adresse
 * und Telefonnummer der Bestellung kommen hier gar nicht erst vor.
 * `value`/`currency` sind dabei, damit Trichter UND Umsatz auswertbar sind.
 */
export interface OrderCompletedInput {
  id: string;
  displayId: number;
  /** Brutto-Gesamtbetrag inkl. Versand. */
  total: number;
  /** Brutto-Warenwert. */
  subtotal: number;
  shipping: number;
  currency: string;
  lines: ReadonlyArray<{ productHandle: string; quantity: number }>;
}

export function orderCompletedEvent(
  order: OrderCompletedInput,
): AnalyticsEvent {
  return {
    name: "order_completed",
    properties: {
      order_id: order.id,
      order_display_id: order.displayId,
      value: order.total,
      goods_value: order.subtotal,
      shipping_value: order.shipping,
      currency: order.currency,
      item_count: order.lines.reduce((sum, l) => sum + l.quantity, 0),
      products: order.lines.map((l) => l.productHandle),
    },
  };
}
