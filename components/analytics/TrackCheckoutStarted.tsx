"use client";

import { useEffect, useRef } from "react";
import { trackCheckoutStarted } from "@/lib/analytics/client";

/**
 * Meldet «Kasse begonnen» beim Betreten von /checkout. Rendert nichts.
 *
 * Die Props sind BEWUSST nackte Zahlen und Produkt-Handles — nicht der
 * ganze CartState: der trägt E-Mail und Lieferadresse, und die haben in
 * einem Analyse-Ereignis nichts verloren (lib/analytics/events.ts erklärt
 * das ausführlich). Die Server-Seite (app/checkout/page.tsx) reicht darum
 * nur diese Felder herüber; mehr wird gar nie erst serialisiert.
 */
export function TrackCheckoutStarted({
  itemCount,
  goodsValue,
  currency,
  products,
}: {
  itemCount: number;
  goodsValue: number;
  currency: string;
  products: readonly string[];
}) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackCheckoutStarted({
      count: itemCount,
      subtotal: goodsValue,
      currency,
      lines: products.map((productHandle) => ({ productHandle })),
    });
    // Nur beim ersten Mount melden — Prop-Änderungen (Cart-Updates während
    // der Kasse) sind kein neuer Kassenbeginn.
  }, [itemCount, goodsValue, currency, products]);

  return null;
}
