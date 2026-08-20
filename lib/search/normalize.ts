/**
 * TEXT NORMALISATION for the instant search.
 *
 * Both the indexed catalogue text AND the user's query run through the same
 * folding, so every rule here is symmetric by construction: it can merge two
 * spellings, but it can never make a query miss a document it would have hit
 * unfolded.
 *
 * The rules are tuned to THIS catalogue's names (see lib/search/engine.test.ts,
 * which tests against the real product names from medusa-ecom's catalog.json):
 *
 *  - German umlauts, typed either way: `grösse` and `groesse` both fold to
 *    `grosse`. Swiss keyboards and search habits produce both.
 *  - `ß` -> `ss` (Swiss spelling never uses ß, but suppliers' copy does).
 *  - `ø` (diameter sign in names like "PURIZE Aktivkohlefilter ø 9mm") folds
 *    to `o` — it is not NFKD-decomposable, hence the explicit map.
 *  - Digits and letters are split apart, so `6mm`, `6 mm` and `ø6mm` all
 *    tokenise to ["6", "mm"], and `120stk` matches `120 Stk`.
 *  - Decimal commas become dots (`5,9` -> `5.9`) — Swiss users type commas.
 *  - Hyphens and every other separator split tokens, so `zig-zag` matches
 *    "Zig Zag".
 *
 * KNOWN TRADE-OFF: the `ae/oe/ue -> a/o/u` digraph collapse also fires inside
 * genuine sequences ("blue" -> "blu"). Because it fires on both sides this
 * only ever *widens* matches slightly; with a catalogue in the low hundreds
 * of items that costs nothing and buys umlaut-free German queries.
 */

/** Lowercase + fold accents/umlauts/digraphs. Symmetric: applied to docs and queries. */
export function foldText(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/ß/g, "ss")
      // Not NFKD-decomposable, mapped by hand:
      .replace(/ø/g, "o")
      .replace(/æ/g, "a")
      // ä -> a, ö -> o, ü -> u, é -> e, …
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      // Umlaut fallback spellings: groesse -> grosse, zubehoer -> zubehor.
      .replace(/ae/g, "a")
      .replace(/oe/g, "o")
      .replace(/ue/g, "u")
      // Decimal comma -> decimal dot (5,9 -> 5.9).
      .replace(/(\d),(\d)/g, "$1.$2")
  );
}

/**
 * Fold, split digit/letter boundaries, then split on every non-alphanumeric
 * character (the dot survives only *inside* numbers, for "5.9").
 */
export function tokenize(input: string): string[] {
  return foldText(input)
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .split(/[^a-z0-9.]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
}
