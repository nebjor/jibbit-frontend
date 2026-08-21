/**
 * DISPLAY helpers for search results — presentation only, no ranking.
 *
 * The suggestion rows show the brand on its own line. Most catalogue titles
 * repeat the brand as their first word ("OCB Premium kurz", brand "OCB"), so
 * a row would read "OCB / OCB Premium kurz" — and with the brand stripped,
 * the part that actually DISTINGUISHES the products ("Premium kurz" vs
 * "Premium Rolls Slim") moves to the front of the line, where it survives
 * even on narrow screens.
 *
 * Pure string work on the already-shipped SearchDoc fields; the search
 * engine (lib/search/engine.ts) is untouched.
 */

/**
 * Title as shown in a suggestion row whose brand is already displayed
 * separately: strips a leading "<brand> " / "<brand>-" prefix
 * (case-insensitive). Returns the title unchanged when the brand is not a
 * clean prefix, and never returns an empty string (a title that IS just the
 * brand stays as it is).
 */
export function displayTitle(title: string, brand: string): string {
  const t = title.trim();
  const b = brand.trim();
  if (!b) return t;
  if (t.length <= b.length) return t;
  if (t.slice(0, b.length).toLowerCase() !== b.toLowerCase()) return t;

  // The character after the brand must separate words — "OCB " or "OCB-",
  // not "OCBx". Otherwise the brand is not a real prefix ("RAWr…").
  const rest = t.slice(b.length);
  if (!/^[\s\-–—:·]/.test(rest)) return t;

  const stripped = rest.replace(/^[\s\-–—:·]+/, "");
  return stripped.length > 0 ? stripped : t;
}
