/**
 * Zuordnung Variante -> Produktbild für die Galerie der Produktseite.
 *
 * Medusa hängt Bilder am PRODUKT; die Variante trägt nur ein `thumbnail`,
 * das laut Medusa «from the product images» stammt (im Adapter als
 * `variant.image` abgebildet). Diese Datei rechnet daraus alles aus, was die
 * Produktseite zum Umschalten braucht — als reine Funktion, damit die
 * Randfälle ohne DOM testbar sind:
 *
 *   - Variante ohne eigenes Bild  -> erstes Produktbild, kein leerer Platz.
 *   - Nur ein Bild am Produkt     -> nichts umzuschalten, Seite wie bisher.
 *   - Nur eine Variante           -> keine Auswahl, Seite wie bisher.
 *   - `thumbnail` zeigt auf ein Bild, das NICHT am Produkt hängt -> wird
 *     ignoriert (Rückfall aufs erste Bild), statt ein fremdes Bild gross zu
 *     rendern.
 */

import type { ProductView } from "./types";
import { defaultVariant } from "./pricing";

export interface HeroGallery {
  /**
   * Alle Bilder, die die Galerie vorrendern muss, ohne Duplikate. Das erste
   * Produktbild steht — wenn vorhanden — immer an Position 0.
   */
  slides: string[];
  /** variantId -> eigenes Bild. Enthält nur Varianten mit gültigem Bild. */
  srcByVariant: Record<string, string>;
  /**
   * Bild der vorausgewählten Variante (dieselbe Vorauswahl wie in AddToCart,
   * siehe `defaultVariant`), sonst das erste Produktbild. Das ist das Bild,
   * das serverseitig sichtbar gerendert wird und `priority` bekommt.
   */
  initialSrc: string | undefined;
  /** Erstes Produktbild — Rückfall für Varianten ohne eigenes Bild. */
  defaultSrc: string | undefined;
  /**
   * Lohnt sich der clientseitige Umschalter überhaupt? Nur wenn es eine
   * echte Auswahl gibt (mehr als eine Variante) UND mindestens zwei
   * verschiedene Bilder im Spiel sind. Sonst rendert die Seite exakt wie
   * bisher.
   */
  interactive: boolean;
}

export function heroGallery(
  product: Pick<ProductView, "images" | "variants">,
): HeroGallery {
  const defaultSrc: string | undefined = product.images[0];
  const known = new Set(product.images);

  const srcByVariant: Record<string, string> = {};
  for (const v of product.variants) {
    if (v.image && known.has(v.image)) srcByVariant[v.id] = v.image;
  }

  const slides: string[] = [];
  for (const src of [defaultSrc, ...Object.values(srcByVariant)]) {
    if (src && !slides.includes(src)) slides.push(src);
  }

  const preselected = defaultVariant(product.variants);
  const initialSrc = (preselected && srcByVariant[preselected.id]) ?? defaultSrc;

  const interactive = product.variants.length > 1 && slides.length > 1;

  return { slides, srcByVariant, initialSrc, defaultSrc, interactive };
}
