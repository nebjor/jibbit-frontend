/**
 * Engine tests against the REAL catalogue: all 26 product names come verbatim
 * from `data/catalog.json` in the medusa-ecom repository. The typo queries are
 * the ones the search must survive in production — do not swap these for
 * invented names.
 */

import { describe, expect, it } from "vitest";
import {
  buildIndex,
  editDistance,
  matchToken,
  search,
  type SearchDoc,
} from "./engine";

function doc(
  title: string,
  brand: string,
  category: string,
  description = "",
): SearchDoc {
  return {
    id: title,
    handle: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title,
    brand,
    subtitle: "",
    category,
    description,
    price: 9.9,
    currency: "CHF",
  };
}

const PAPERS = "Papers";
const FILTER = "Filter";
const ZUBEHOER = "Zubehör & Glas";

/** The 26 real names from medusa-ecom data/catalog.json. */
const CATALOG: SearchDoc[] = [
  doc("Angel Slim Filters 6mm 120stk", "Angel", FILTER),
  doc("dubi Aktivkohlefilter ø7mm", "dubi", FILTER),
  doc("Elements BLUE Rolls SW", "Elements", PAPERS),
  doc("Elements King Slim Size Ultra Thin", "Elements", PAPERS),
  doc("Gizeh DW Extra Fine", "Gizeh", PAPERS),
  doc(
    "Greengo Unbleached Slim Rolls",
    "Greengo",
    PAPERS,
    // Realistic copy for the ranking test: mentions RAW only in the text.
    "Ungebleichte Slim Rolls — die günstigere Alternative zu RAW.",
  ),
  doc("Kailar Filter 5.9mm 65stk pink", "Kailar", FILTER),
  doc("Kailar Filter 5.9mm 65stk schwarz", "Kailar", FILTER),
  doc("Kailar Filter 5.9mm 65stk weiss", "Kailar", FILTER),
  doc("Kailar Filter 9mm BIG 100 stk schwarz", "Kailar", FILTER),
  doc("OCB Bio Slim Organic Hemp Rolls", "OCB", PAPERS),
  doc("OCB Premium KSS Papers mit Filter", "OCB", PAPERS),
  doc("OCB Premium kurz", "OCB", PAPERS),
  doc("OCB Premium Rolls Slim", "OCB", PAPERS),
  doc("OCB Slim Filter Bio (120 Tips)", "OCB", FILTER),
  doc("PURIZE Aktivkohlefilter ø 9mm", "PURIZE", FILTER),
  doc("Purize SUPER SLIM White ø5mm", "PURIZE", FILTER),
  doc("Purize Xtra SLIM White, 50er Pack, 5.9mm", "PURIZE", FILTER),
  doc("PURIZE XTRA Slim XMAS ø 6mm", "PURIZE", FILTER),
  doc("RAW Black KSS Papers", "RAW", PAPERS),
  doc("RAW Classic Rolls Slim", "RAW", PAPERS),
  doc("RAW Kristallglas Aschenbecher Darkside", "RAW", ZUBEHOER),
  doc("RAW Kristallglas Aschenbecher Rainbow", "RAW", ZUBEHOER),
  doc("RAW Kristallglas Aschenbecher Ruby", "RAW", ZUBEHOER),
  doc("Smoking Brown kurz (double window)", "Smoking", PAPERS),
  doc("Zig Zag Slim Filter 6mm 120stk", "Zig Zag", FILTER),
];

const index = buildIndex(CATALOG);
const titles = (q: string) => search(index, q).map((h) => h.doc.title);
const brands = (q: string) => search(index, q).map((h) => h.doc.brand);

describe("typo tolerance against the real catalogue", () => {
  it("purieze finds all PURIZE products", () => {
    const b = brands("purieze");
    expect(b.length).toBeGreaterThanOrEqual(4);
    expect(new Set(b)).toEqual(new Set(["PURIZE"]));
  });

  it("ocb premim finds the OCB Premium products, best first", () => {
    const t = titles("ocb premim");
    expect(t).toEqual([
      "OCB Premium kurz",
      "OCB Premium Rolls Slim",
      "OCB Premium KSS Papers mit Filter",
    ]);
  });

  it("kailer finds only Kailar", () => {
    const b = brands("kailer");
    expect(b).toHaveLength(4);
    expect(new Set(b)).toEqual(new Set(["Kailar"]));
  });

  it("zig-zag finds Zig Zag", () => {
    expect(titles("zig-zag")[0]).toBe("Zig Zag Slim Filter 6mm 120stk");
    expect(titles("zigzag")[0]).toBe("Zig Zag Slim Filter 6mm 120stk");
  });

  it("aschenbescher (typo) finds the three Aschenbecher", () => {
    const t = titles("aschenbescher");
    expect(t).toHaveLength(3);
    for (const title of t) expect(title).toContain("Aschenbecher");
  });

  it("aktivkohle as a prefix finds both Aktivkohlefilter brands", () => {
    const b = new Set(brands("aktivkohle"));
    expect(b).toEqual(new Set(["dubi", "PURIZE"]));
  });

  it("short tokens tolerate no edits: ozb stays empty", () => {
    expect(titles("ozb")).toEqual([]);
  });
});

describe("umlauts and special characters", () => {
  it("zubehör and zubehoer both find the Zubehör category", () => {
    for (const q of ["zubehör", "zubehoer", "zubehor"]) {
      const t = titles(q);
      expect(t, `query: ${q}`).toHaveLength(3);
      for (const title of t) expect(title).toContain("Aschenbecher");
    }
  });

  it("weiss finds the weiss variant name", () => {
    expect(titles("weiss")).toContain("Kailar Filter 5.9mm 65stk weiss");
    expect(titles("weiß")).toContain("Kailar Filter 5.9mm 65stk weiss");
  });
});

describe("numbers and units", () => {
  it("6mm and 6 mm are the same query", () => {
    expect(titles("6mm")).toEqual(titles("6 mm"));
  });

  it("6mm finds the 6mm products and NOT the 5.9mm ones", () => {
    const t = titles("6mm");
    expect(t).toContain("Angel Slim Filters 6mm 120stk");
    expect(t).toContain("Zig Zag Slim Filter 6mm 120stk");
    expect(t).toContain("PURIZE XTRA Slim XMAS ø 6mm");
    for (const title of t) expect(title).not.toContain("5.9");
  });

  it("9mm finds ø 9mm and 9mm BIG", () => {
    const t = titles("9mm");
    expect(new Set(t)).toEqual(
      new Set([
        "PURIZE Aktivkohlefilter ø 9mm",
        "Kailar Filter 9mm BIG 100 stk schwarz",
      ]),
    );
  });

  it("5.9 and 5,9 (Swiss comma) agree", () => {
    expect(titles("5,9mm")).toEqual(titles("5.9mm"));
    expect(titles("5.9mm").length).toBeGreaterThanOrEqual(3);
  });
});

describe("ranking", () => {
  it("brand hit outranks a description-only mention (raw)", () => {
    const t = titles("raw");
    // All five RAW-brand products come first…
    expect(t.slice(0, 5).every((x) => x.startsWith("RAW"))).toBe(true);
    // …and the description mention still surfaces, but last.
    expect(t[5]).toBe("Greengo Unbleached Slim Rolls");
  });

  it("ties break on shorter titles first", () => {
    const t = titles("ocb premium");
    expect(t[0]).toBe("OCB Premium kurz");
  });

  it("scores are sorted descending", () => {
    const hits = search(index, "slim filter");
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1].score).toBeGreaterThanOrEqual(hits[i].score);
    }
  });

  it("every query token must match (AND)", () => {
    expect(titles("ocb aschenbecher")).toEqual([]);
  });
});

describe("edge cases", () => {
  it("empty and whitespace queries return nothing", () => {
    expect(search(index, "")).toEqual([]);
    expect(search(index, "   ")).toEqual([]);
  });

  it("respects the limit", () => {
    expect(search(index, "slim", 3)).toHaveLength(3);
  });

  it("gibberish finds nothing", () => {
    expect(titles("xqvz kplm")).toEqual([]);
  });
});

describe("matchToken ladder", () => {
  it("exact > prefix > fuzzy > fuzzy-prefix", () => {
    const exact = matchToken("premium", "premium");
    const prefix = matchToken("prem", "premium");
    const fuzzy = matchToken("premim", "premium");
    const fuzzyPrefix = matchToken("aschanb", "aschenbecher");
    expect(exact).toBe(1);
    expect(prefix).toBeLessThan(exact);
    expect(fuzzy).toBeLessThan(prefix);
    expect(fuzzyPrefix).toBeLessThan(fuzzy);
    expect(fuzzyPrefix).toBeGreaterThan(0);
  });

  it("numeric tokens only match exactly", () => {
    expect(matchToken("6", "6")).toBe(1);
    expect(matchToken("6", "65")).toBe(0);
    expect(matchToken("59", "5.9")).toBe(0);
    expect(matchToken("5.9", "5.9")).toBe(1);
  });
});

describe("editDistance", () => {
  it("counts a transposition as one edit", () => {
    expect(editDistance("ocb", "obc", 2)).toBe(1);
    expect(editDistance("purzie", "purize", 2)).toBe(1);
  });

  it("caps early", () => {
    expect(editDistance("abcdef", "xyzuvw", 2)).toBe(3);
    expect(editDistance("a", "abcdefg", 2)).toBe(3);
  });
});
