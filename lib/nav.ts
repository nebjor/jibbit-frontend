/**
 * Aktiv-Erkennung für die Kategorienavigation.
 *
 * Ausgelagert und pur, damit sie testbar ist — genau hier war der Shop
 * kaputt: Bei gewählter Kategorie leuchteten mehrere Reiter gleichzeitig,
 * weil verschiedene Backend-Kategorien auf dasselbe interne Handle
 * zusammenfielen. Die Regel ist deshalb bewusst streng: EXAKTER
 * String-Vergleich gegen die geladene Kategorienliste, kein Teilstring,
 * kein Präfix — `filter` darf `filter-tips` nicht mitmarkieren und
 * umgekehrt.
 *
 * Der Katalog liegt auf der STARTSEITE («shop ist die neue startseite») —
 * aktiv wird also nur auf `/` markiert. Die alte Adresse /shop ist nur
 * noch eine dauerhafte Umleitung und zählt hier nicht.
 */

/**
 * Welcher Navigationseintrag ist aktiv?
 *
 * @returns das aktive Kategorie-Handle; `""` für „Alles“ (Katalog ohne oder
 *   mit unbekanntem `kategorie`-Parameter — die Seite zeigt dann das ganze
 *   Sortiment, also ist „Alles“ der ehrliche Zustand); `null` ausserhalb
 *   des Katalogs (kein Eintrag aktiv).
 */
export function activeCategory(
  pathname: string,
  kategorie: string | null,
  handles: readonly string[],
): string | null {
  if (pathname !== "/") return null;
  if (kategorie !== null && handles.includes(kategorie)) return kategorie;
  return "";
}
