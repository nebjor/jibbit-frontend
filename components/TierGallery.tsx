"use client";

import type { ReactNode } from "react";
import { orderImagesForTier } from "@/lib/pricing";
import { useTierSelection } from "./TierSelection";
import styles from "@/app/products/[handle]/product.module.css";

/**
 * Galerie für Produkte mit Stufenfotos (Admin-Widget «Preistabelle»).
 *
 * Es werden immer ALLE Produktbilder gezeigt. Wählt der Kunde eine Stufe mit
 * eigenem Foto (z.B. «24er Display»), rückt dieses Foto an die erste Stelle
 * und wird zum grossen Bild; die übrigen folgen in ihrer normalen
 * Reihenfolge. Ohne Stufenfoto bleibt alles, wie es ist.
 *
 * Kein Neuladen, kein Layoutsprung: alle Bilder sind als Server-Knoten
 * vorgerendert (Hero- und Vorschau-Fassung), hier wird nur umgeblendet bzw.
 * per CSS `order` umsortiert. Die Rahmen haben feste Seitenverhältnisse, ein
 * Wechsel ändert die Höhe nicht. Stufenfotos laden eager (siehe Seite),
 * damit der Wechsel ohne Wartezeit passiert.
 */
export function TierGallery({
  images,
  imageByTier,
  hero,
  thumb,
}: {
  /** Produktbilder in ihrer normalen Reihenfolge. */
  images: string[];
  /** «ab»-Menge -> Foto dieser Stufe. */
  imageByTier: Record<number, string>;
  /** src -> vorgerendertes grosses Bild. */
  hero: Record<string, ReactNode>;
  /** src -> vorgerendertes Vorschaubild. */
  thumb: Record<string, ReactNode>;
}) {
  const selection = useTierSelection();
  const ordered = orderImagesForTier(
    images,
    selection ? imageByTier[selection.tier] : undefined,
  );
  const active = ordered[0];
  const rest = ordered.slice(1);

  return (
    <>
      {images.map((src) => (
        <div key={src} hidden={src !== active}>
          {hero[src]}
        </div>
      ))}
      {images.length > 1 && (
        <div className={styles.thumbs}>
          {images.map((src) => {
            const pos = rest.indexOf(src);
            return (
              <div key={src} hidden={pos < 0} style={{ order: pos }}>
                {thumb[src]}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
