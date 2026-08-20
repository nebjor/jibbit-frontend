/**
 * INSTANT-SEARCH ENGINE — pure TypeScript, no dependencies, isomorphic.
 *
 * Runs in the browser (header combobox), on the server (/suche results page)
 * and in vitest. Deliberately NOT a search service: the whole catalogue is in
 * the low hundreds of items, so the index ships to the client and every
 * keystroke is answered locally, with zero network hops and zero
 * infrastructure. See the PR description for measured sizes and the point at
 * which this approach stops carrying.
 *
 * RANKING — designed to be explainable, in strict descending order:
 *
 *   match quality:  exact token (1.0)
 *                 > prefix       (0.75 + 0.25·len(q)/len(t), always < 1)
 *                 > fuzzy        (0.75 − 0.2·edits  → 0.55 / 0.35)
 *                 > fuzzy prefix (0.55 − 0.2·edits  → 0.35 / 0.15)
 *
 *   field weight:   brand 4 > title 3 > subtitle 1.5 > category 1.2
 *                 > description 1
 *
 *   plus ×1.15 when the FIRST token of brand or title matches (people type
 *   names front-to-back).
 *
 * So an exact prefix hit on the brand scores 0.75·4·1.15 ≈ 3.5 while a fuzzy
 * hit somewhere in the description scores at most 0.55·1 = 0.55 — the ordering
 * the shop needs ("ocb" must beat a description that merely mentions OCB).
 *
 * Every query token must match somewhere (AND semantics); the score is the
 * sum of each token's best field hit. Ties: shorter title first, then A–Z.
 *
 * TYPO TOLERANCE — bounded Damerau-Levenshtein (OSA variant, adjacent
 * transpositions count as one edit):
 *
 *   query-token length ≤ 3 → 0 edits (exact/prefix only: "ocb", "raw", "6")
 *   length 4–6            → 1 edit   ("kailer" → kailar, "premim" → premium)
 *   length ≥ 7            → 2 edits  ("purieze" → purize, "aschenbescher")
 *
 * Tokens that carry digits ("6", "5.9", "120") match ONLY exactly — a search
 * for "6mm" must not drift onto "65stk" via prefix or edits.
 */

import { tokenize } from "./normalize";

/**
 * One searchable product, exactly what the client index ships. Keep this flat
 * and small: its JSON size × catalogue size is the payload the layout carries.
 */
export interface SearchDoc {
  id: string;
  handle: string;
  title: string;
  brand: string;
  subtitle: string;
  /** Display name of the category ("Zubehör & Glas"). */
  category: string;
  /** Indexed for recall, never rendered in the dropdown. */
  description: string;
  /** Cheapest variant price, decimal CHF — what the suggestion row shows. */
  price: number;
  currency: string;
}

interface IndexedField {
  tokens: string[];
  /**
   * Adjacent token pairs, concatenated ("zig","zag" -> "zigzag"), so a query
   * typed WITHOUT the separator still hits the two-token name. The reverse
   * direction (query "zig zag" against a hypothetical token "zigzag") is
   * already covered by prefix/fuzzy matching on the base tokens.
   */
  joined: string[];
  weight: number;
  /** Multiplier when the field's FIRST token is the one that matches. */
  firstTokenBonus: number;
}

interface IndexedDoc {
  doc: SearchDoc;
  fields: IndexedField[];
}

export interface SearchIndex {
  docs: IndexedDoc[];
}

export interface SearchHit {
  doc: SearchDoc;
  score: number;
}

const FIELDS: {
  key: keyof Pick<
    SearchDoc,
    "brand" | "title" | "subtitle" | "category" | "description"
  >;
  weight: number;
  firstTokenBonus: number;
}[] = [
  { key: "brand", weight: 4, firstTokenBonus: 1.15 },
  { key: "title", weight: 3, firstTokenBonus: 1.15 },
  { key: "subtitle", weight: 1.5, firstTokenBonus: 1 },
  { key: "category", weight: 1.2, firstTokenBonus: 1 },
  { key: "description", weight: 1, firstTokenBonus: 1 },
];

/** Tokenise every field once. Do this once per catalogue, not per keystroke. */
export function buildIndex(docs: SearchDoc[]): SearchIndex {
  return {
    docs: docs.map((doc) => ({
      doc,
      fields: FIELDS.map((f) => {
        const tokens = tokenize(doc[f.key]);
        const joined: string[] = [];
        for (let i = 0; i < tokens.length - 1; i++) {
          joined.push(tokens[i] + tokens[i + 1]);
        }
        return {
          tokens,
          joined,
          weight: f.weight,
          firstTokenBonus: f.firstTokenBonus,
        };
      }).filter((f) => f.tokens.length > 0),
    })),
  };
}

/** Edits allowed for a query token of this length. */
export function maxEditsFor(len: number): number {
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  return 2;
}

/**
 * Damerau-Levenshtein distance (optimal string alignment), capped: returns
 * `cap + 1` as soon as the distance provably exceeds `cap`, so long words
 * never cost a full DP table.
 */
export function editDistance(a: string, b: string, cap: number): number {
  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > cap) return cap + 1;
  if (al === 0) return bl;
  if (bl === 0) return al;

  let prevPrev: number[] = [];
  let prev: number[] = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;

  for (let i = 1; i <= al; i++) {
    const curr: number[] = new Array(bl + 1);
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prevPrev[j - 2] + 1);
      }
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > cap) return cap + 1;
    prevPrev = prev;
    prev = curr;
  }
  return prev[bl];
}

const HAS_DIGIT = /\d/;

/**
 * Match quality of query token `q` against document token `t`, 0 = no match.
 * See the module header for the exact ladder.
 */
export function matchToken(q: string, t: string): number {
  if (q === t) return 1;
  // Numeric tokens ("6", "5.9", "120") never match approximately: "6mm"
  // must not reach "65stk", and "5.9" must not reach "59".
  if (HAS_DIGIT.test(q) || HAS_DIGIT.test(t)) return 0;
  if (t.startsWith(q)) return 0.75 + 0.25 * (q.length / t.length);

  const cap = maxEditsFor(q.length);
  if (cap === 0) return 0;

  const d = editDistance(q, t, cap);
  if (d <= cap) return 0.75 - 0.2 * d;

  // Fuzzy prefix: the user is mid-word AND has a typo ("aschanb…"). Compare
  // against the document token cut to query length.
  if (t.length > q.length + cap) {
    const dp = editDistance(q, t.slice(0, q.length), cap);
    if (dp <= cap) return 0.55 - 0.2 * dp;
  }
  return 0;
}

/**
 * Rank the catalogue for `rawQuery`. Empty/too-short queries return [] —
 * the caller decides what "too short" means for its UI (the combobox gates
 * at 2 characters).
 */
export function search(
  index: SearchIndex,
  rawQuery: string,
  limit = Infinity,
): SearchHit[] {
  const qTokens = tokenize(rawQuery);
  if (qTokens.length === 0) return [];

  const hits: SearchHit[] = [];

  for (const entry of index.docs) {
    let total = 0;
    let allMatched = true;

    for (const q of qTokens) {
      let best = 0;
      for (const field of entry.fields) {
        const { tokens, joined, weight, firstTokenBonus } = field;
        for (let i = 0; i < tokens.length; i++) {
          const m = matchToken(q, tokens[i]);
          if (m > 0) {
            const s = m * weight * (i === 0 ? firstTokenBonus : 1);
            if (s > best) best = s;
          }
        }
        // A pair starting at token 0 spans the field's first token, so it
        // earns the same first-token bonus.
        for (let i = 0; i < joined.length; i++) {
          const m = matchToken(q, joined[i]);
          if (m > 0) {
            const s = m * weight * (i === 0 ? firstTokenBonus : 1);
            if (s > best) best = s;
          }
        }
      }
      if (best === 0) {
        allMatched = false;
        break;
      }
      total += best;
    }

    if (allMatched) hits.push({ doc: entry.doc, score: total });
  }

  hits.sort(
    (a, b) =>
      b.score - a.score ||
      a.doc.title.length - b.doc.title.length ||
      a.doc.title.localeCompare(b.doc.title, "de-CH"),
  );

  return hits.length > limit ? hits.slice(0, limit) : hits;
}
