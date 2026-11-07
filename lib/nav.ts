import { categoryHandleFromPath } from "./seo/category-url";

/**
 * Aktiv-Erkennung für die Kategorienavigation.
 *
 * Ausgelagert und pur, damit sie testbar ist — genau hier war der Shop
 * kaputt: Bei gewählter Kategorie leuchteten mehrere Reiter gleichzeitig,
 * weil verschiedene Backend-Kategorien auf dasselbe interne Handle
 * zusammenfielen. Die Regel ist deshalb bewusst streng: EXAKTER
 * String-Vergleich gegen die geladene Kategorienliste, kein Teilstring,
 * kein Präfix — ein Handle, das zufällig Anfang eines anderen ist, darf
 * dieses nicht mitmarkieren (früher `filter` und `filter-tips`; `filter` ist
 * inzwischen in `filter-tips` aufgegangen, die Regel gilt weiter).
 *
 * Der Katalog liegt auf der STARTSEITE («shop ist die neue startseite») —
 * aktiv wird auf `/` («Alles») und auf `/kategorie/<handle>` markiert. Die
 * alte Adresse /shop und `/?kategorie=` sind nur noch Umleitungen.
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
  const fromPath = categoryHandleFromPath(pathname);
  if (fromPath !== null) return handles.includes(fromPath) ? fromPath : null;
  if (pathname !== "/") return null;
  if (!kategorie) return "";
  return handles.includes(kategorie) ? kategorie : null;
}
