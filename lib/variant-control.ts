/**
 * Welches Bedienelement wählt die Variante? — reine Funktion, kein React.
 *
 *   - eine Variante                        -> «none»: gar kein Element
 *   - mehrere, Option = Verpackungseinheit -> «buttons»: Einzeln / Display / Box
 *   - mehrere, sonst (Grösse, Farbe, …)    -> «select»: Auswahlliste
 *
 * Die Verpackungseinheit bleibt bei den Knöpfen, weil dort «Bestes Angebot»
 * und der Stückpreis mitlaufen. Echte Grössen (100 g / 250 g / 500 g / 1 kg)
 * sind keine Gebinde und gehören in eine Auswahlliste.
 */

import type { ProductVariantView } from "./types";

export type VariantControl = "none" | "buttons" | "select";

/** Optionsnamen, die ein Gebinde beschreiben (Backend-Import: «Verpackungseinheit»). */
const PACK_OPTION = /^(verpackungseinheit|packung|gebinde)$/i;

/** Beschriftung, wenn der Optionsname nicht bekannt ist. */
export const FALLBACK_OPTION_LABEL = "Variante";

export function variantControl(
  variants: ReadonlyArray<Pick<ProductVariantView, "packType" | "unitsPerPack">>,
  optionTitle?: string,
): VariantControl {
  if (variants.length < 2) return "none";
  const title = optionTitle?.trim();
  if (title) return PACK_OPTION.test(title) ? "buttons" : "select";
  // Optionsname unbekannt: die Gebinde-Daten entscheiden.
  const isPackSize = variants.some((v) => v.packType !== "single" || v.unitsPerPack > 1);
  return isPackSize ? "buttons" : "select";
}

/** Beschriftung der Auswahlliste: der Optionsname, sonst «Variante». */
export function variantLabel(optionTitle?: string): string {
  return optionTitle?.trim() || FALLBACK_OPTION_LABEL;
}

/** Text einer Listenzeile: «100 g – CHF 6.90», ausverkauft: «100 g – ausverkauft». */
export function variantOptionText(
  variant: Pick<ProductVariantView, "title" | "price" | "inStock">,
  formatPrice: (amount: number) => string,
): string {
  return `${variant.title} – ${variant.inStock ? formatPrice(variant.price) : "ausverkauft"}`;
}
