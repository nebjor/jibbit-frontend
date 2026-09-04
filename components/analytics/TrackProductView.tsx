"use client";

import { useEffect, useRef } from "react";
import { trackProductViewed } from "@/lib/analytics/client";
import type { ProductView } from "@/lib/types";

/**
 * Meldet «Produkt angesehen» — als eigener Client-Baustein, damit die
 * Produktseite selbst eine Server-Komponente bleiben kann. Rendert nichts.
 *
 * Die Produktdaten sind öffentlicher Katalog (stehen ohnehin im HTML der
 * Seite) — Personendaten kommen hier keine vor; was genau ins Ereignis
 * wandert, entscheidet lib/analytics/events.ts.
 */
export function TrackProductView({ product }: { product: ProductView }) {
  // Pro Handle genau einmal — der Ref-Wächter fängt auch den doppelten
  // Effekt-Lauf des React Strict Mode ab.
  const tracked = useRef<string | null>(null);

  useEffect(() => {
    if (tracked.current === product.handle) return;
    tracked.current = product.handle;
    trackProductViewed(product);
  }, [product]);

  return null;
}
