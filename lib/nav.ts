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
 * @returns das aktive Kategorie-Handle; `""` für „Alles“ (Katalog ohne
 *   `kategorie`-Parameter); `null` ausserhalb des Katalogs und bei
 *   unbekannter Kategorie (404, kein Eintrag aktiv).
 */
export function activeCategory(
  pathname: string,
  kategorie: string | null,
  handles: readonly string[],
): string | null {
  if (pathname !== "/") return null;
  if (!kategorie) return "";
  return handles.includes(kategorie) ? kategorie : null;
}
