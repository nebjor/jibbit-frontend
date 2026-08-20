import { describe, expect, it } from "vitest";
import { foldText, tokenize } from "./normalize";

describe("foldText", () => {
  it("folds umlauts and their fallback spellings to the same form", () => {
    expect(foldText("grösse")).toBe("grosse");
    expect(foldText("groesse")).toBe("grosse");
    expect(foldText("Zubehör")).toBe("zubehor");
    expect(foldText("zubehoer")).toBe("zubehor");
    expect(foldText("über")).toBe(foldText("ueber"));
  });

  it("folds ß to ss (Swiss spelling)", () => {
    expect(foldText("weiß")).toBe("weiss");
    expect(foldText("Größe")).toBe(foldText("groesse"));
  });

  it("folds the diameter sign ø to o", () => {
    expect(foldText("ø")).toBe("o");
    expect(foldText("Ø")).toBe("o");
  });

  it("turns decimal commas into dots", () => {
    expect(foldText("5,9")).toBe("5.9");
  });

  it("is symmetric: folding twice changes nothing", () => {
    const once = foldText("PURIZE Aktivkohlefilter ø 9mm — Grösse");
    expect(foldText(once)).toBe(once);
  });
});

describe("tokenize", () => {
  it("splits on hyphens so zig-zag matches Zig Zag", () => {
    expect(tokenize("zig-zag")).toEqual(["zig", "zag"]);
    expect(tokenize("Zig Zag")).toEqual(["zig", "zag"]);
  });

  it("splits digits from units so 6mm, 6 mm and ø6mm agree", () => {
    expect(tokenize("6mm")).toEqual(["6", "mm"]);
    expect(tokenize("6 mm")).toEqual(["6", "mm"]);
    expect(tokenize("ø6mm")).toEqual(["o", "6", "mm"]);
  });

  it("keeps decimal numbers whole", () => {
    expect(tokenize("5.9mm")).toEqual(["5.9", "mm"]);
    expect(tokenize("5,9mm")).toEqual(["5.9", "mm"]);
  });

  it("handles real catalogue names", () => {
    expect(tokenize("PURIZE Aktivkohlefilter ø 9mm")).toEqual([
      "purize",
      "aktivkohlefilter",
      "o",
      "9",
      "mm",
    ]);
    expect(tokenize("Kailar Filter 5.9mm 65stk weiss")).toEqual([
      "kailar",
      "filter",
      "5.9",
      "mm",
      "65",
      "stk",
      "weiss",
    ]);
    expect(tokenize("Purize Xtra SLIM White, 50er Pack, 5.9mm")).toEqual([
      "purize",
      "xtra",
      "slim",
      "white",
      "50",
      "er",
      "pack",
      "5.9",
      "mm",
    ]);
    expect(tokenize("Smoking Brown kurz (double window)")).toEqual([
      "smoking",
      "brown",
      "kurz",
      "double",
      "window",
    ]);
  });

  it("drops empty tokens and stray punctuation", () => {
    expect(tokenize("  --  ")).toEqual([]);
    expect(tokenize("")).toEqual([]);
  });
});
