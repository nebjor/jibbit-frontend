/**
 * Bestandslogik — reine Funktionen, kein React, kein Netz.
 *
 * `availableQuantity` ist die Menge, die eine Kundin höchstens bestellen darf:
 *   - `null`  = unbegrenzt (Bestandsführung aus, oder Nachbestellung erlaubt)
 *   - `0`     = ausverkauft
 *   - `n > 0` = höchstens n Stück
 *
 * Wichtig: Der Bestand wird derzeit für alle Varianten mit 0 angelegt, während
 * `manage_inventory` noch `false` ist. Erst wenn die Inhaberin nach der Zählung
 * `manage_inventory` einschaltet, greift das Limit — vorher darf 0 NIE als
 * «ausverkauft» gelesen werden.
 *
 * Das ist reine Anzeige und Komfort: die verbindliche Prüfung macht Medusa
 * beim Warenkorb-Update und beim Abschluss der Bestellung.
 */

export interface StockFields {
  manage_inventory?: boolean | null;
  allow_backorder?: boolean | null;
  inventory_quantity?: number | null;
}

/** Bestellbare Höchstmenge einer Variante; null = unbegrenzt. */
export function availableQuantityOf(v: StockFields): number | null {
  if (v.manage_inventory === false || v.allow_backorder === true) return null;
  const q = v.inventory_quantity;
  return typeof q === "number" && Number.isFinite(q) ? Math.max(0, Math.floor(q)) : 0;
}

export function isSoldOut(available: number | null | undefined): boolean {
  return typeof available === "number" && available <= 0;
}

/** Menge auf den Bestand begrenzen (unbegrenzt -> unverändert). */
export function clampToStock(
  quantity: number,
  available: number | null | undefined,
): number {
  return typeof available === "number" ? Math.min(quantity, Math.max(1, available)) : quantity;
}

/** Ist die Stufe ab `minQuantity` mit dem Bestand nicht mehr bestellbar? */
export function isTierDisabled(
  minQuantity: number,
  available: number | null | undefined,
): boolean {
  return typeof available === "number" && minQuantity > available;
}

/** Tooltip / aria-label einer gesperrten Stufe. */
export function tierDisabledLabel(available: number): string {
  return `Nur noch ${available} Stück verfügbar`;
}

/**
 * Hinweis unter der Mengenwahl. EINE einfache Regel: sichtbar, wenn der Bestand
 * knapp ist — unter 10 Stück ODER kleiner als die «ab»-Menge der grössten
 * Preisstufe (`largestTier`, 0 ohne Stufen). Bei
 * unbegrenztem oder ausverkauftem Artikel gibt es keinen Hinweis.
 */
export function stockNote(
  available: number | null | undefined,
  largestTier: number,
): string | null {
  if (typeof available !== "number" || available <= 0) return null;
  return available < 10 || available < largestTier ? `Nur noch ${available} verfügbar` : null;
}

/** Liegt die Menge einer Warenkorbposition über dem Bestand? */
export function exceedsStock(
  quantity: number,
  available: number | null | undefined,
): boolean {
  return typeof available === "number" && quantity > available;
}

/** Hinweis an einer Warenkorbposition, die über dem Bestand liegt. */
export function lineStockHint(available: number): string {
  return available <= 0
    ? "Nicht mehr verfügbar – bitte entfernen"
    : `Nur noch ${available} verfügbar – Menge anpassen`;
}
