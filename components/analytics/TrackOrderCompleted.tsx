"use client";

import { useEffect, useRef } from "react";
import { SHOP } from "@/shop.config";
import { trackOrderCompleted } from "@/lib/analytics/client";

/**
 * Meldet «Bestellung abgeschlossen» auf der Bestätigungsseite — mit
 * Bestellwert und Währung, damit Trichter UND Umsatz auswertbar sind.
 * Rendert nichts.
 *
 * Die Props sind BEWUSST nackte Zahlen, Produkt-Handles und die
 * Bestellnummer — nicht der ganze OrderView: der trägt E-Mail-Adresse,
 * Lieferadresse und Telefonnummer, und die gehören nicht in ein
 * Analyse-Ereignis (Begründung: lib/analytics/events.ts). Die Bestellnummer
 * ist in Ordnung: sie identifiziert die Bestellung, nicht die Person. Die
 * Server-Seite (app/checkout/bestellung/[id]/page.tsx) baut die Props
 * Feld für Feld — mehr wird gar nie erst zum Client serialisiert.
 */
export function TrackOrderCompleted({
  orderId,
  displayId,
  total,
  subtotal,
  shipping,
  currency,
  lines,
}: {
  orderId: string;
  displayId: number;
  total: number;
  subtotal: number;
  shipping: number;
  currency: string;
  lines: ReadonlyArray<{ productHandle: string; quantity: number }>;
}) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    /**
     * Die Bestätigungsseite wird gern neu geladen (oder Tage später aus der
     * Mail wieder geöffnet) — jedes Mal `order_completed` zu senden würde
     * den Umsatz doppelt zählen. Deshalb ein Merker pro Bestellnummer im
     * localStorage. Er wird nur mit erteilter Einwilligung relevant (ohne
     * sie wird ohnehin nichts gesendet), und ein blockierter Speicher
     * (Privatmodus) darf das Ereignis nicht verhindern.
     */
    const dedupeKey = `${SHOP.id}_ph_order_${orderId}`;
    try {
      if (window.localStorage.getItem(dedupeKey)) return;
      window.localStorage.setItem(dedupeKey, "1");
    } catch {
      // Speicher nicht verfügbar: lieber ein möglicher Doppelzähler als ein
      // fehlender Bestellabschluss.
    }

    trackOrderCompleted({
      id: orderId,
      displayId,
      total,
      subtotal,
      shipping,
      currency,
      lines,
    });
  }, [orderId, displayId, total, subtotal, shipping, currency, lines]);

  return null;
}
