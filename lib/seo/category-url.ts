/**
 * DIE ADRESSE EINER KATEGORIE — eine Schreibweise, eine Funktion.
 *
 * Kategorien liegen unter `/kategorie/<handle>`: eigener Pfad statt
 * `/?kategorie=<handle>`, damit jede Kategorie eine saubere, indexierbare
 * Adresse mit eigenem Titel, Text und Canonical hat. Die alte Form
 * (`/?kategorie=…`, `/shop?kategorie=…`) ist eine dauerhafte Umleitung
 * (lib/seo/legacy-redirects.ts, proxy.ts).
 *
 * Bewusst ohne Abhängigkeiten: Client-Komponenten (CategoryNav), Proxy,
 * Sitemap und JSON-LD benutzen dieselbe Funktion.
 */

export const CATEGORY_PREFIX = "/kategorie/";

/** Pfad zur Kategorie. Kodiert: Handles können `&` oder Umlaute enthalten. */
export function categoryPath(handle: string): string {
  return `${CATEGORY_PREFIX}${encodeURIComponent(handle)}`;
}

/**
 * Das Handle aus einem Pfad `/kategorie/<handle>`, sonst `null`. Dekodiert;
 * ein kaputt kodierter Pfad ist kein Treffer.
 */
export function categoryHandleFromPath(pathname: string): string | null {
  if (!pathname.startsWith(CATEGORY_PREFIX)) return null;
  const raw = pathname.slice(CATEGORY_PREFIX.length).replace(/\/$/, "");
  if (!raw || raw.includes("/")) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}
