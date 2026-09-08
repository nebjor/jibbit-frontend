"use client";

import type { ReactNode } from "react";
import { useVariantSelection } from "./VariantSelection";

/**
 * Zeigt das zur gewählten Variante passende Hauptbild («Display» -> Box,
 * «1 Heftchen» -> Einzelstück).
 *
 * Die Bilder selbst kommen fertig gerendert als Server-Knoten herein
 * (ProductImage ist eine Server-Komponente — sie löst den Tenant für die
 * Bild-URL selbst auf). Dieses Bauteil blendet nur um: alle Kandidaten
 * stehen im HTML, sichtbar ist genau einer. Dadurch
 *
 *   - bleibt das anfangs sichtbare Bild serverseitig gerendert (LCP —
 *     beim SSR ist die Vorauswahl dieselbe wie im Provider, es gibt keinen
 *     Hydration-Sprung),
 *   - springt beim Umschalten nichts: die Rahmen sind über
 *     `aspect-ratio: 1/1` gleich gross, ein Bildwechsel ändert die
 *     Seitenhöhe nicht,
 *   - laden die verborgenen Bilder lazy (kein `priority`) und erst bei
 *     Bedarf.
 */
export function VariantHero({
  slides,
  srcByVariant,
  defaultSrc,
}: {
  /** Vorgerenderte Hero-Bilder, eines je Bild-URL (siehe lib/variant-image.ts). */
  slides: { src: string; node: ReactNode }[];
  /** variantId -> Bild-URL. Varianten ohne Eintrag zeigen `defaultSrc`. */
  srcByVariant: Record<string, string>;
  /** Erstes Produktbild — Rückfall, nie ein leerer Platz. */
  defaultSrc: string;
}) {
  const selection = useVariantSelection();
  const active =
    (selection?.selectedId ? srcByVariant[selection.selectedId] : undefined) ??
    defaultSrc;

  return (
    <>
      {slides.map((s) => (
        <div key={s.src} hidden={s.src !== active}>
          {s.node}
        </div>
      ))}
    </>
  );
}
