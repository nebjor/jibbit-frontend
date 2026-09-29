import { describe, expect, it } from "vitest";
import { relatedCategories } from "./related-categories";
import type { CategoryView } from "./types";

const cat = (handle: string, name: string): CategoryView => ({
  id: handle,
  handle,
  name,
  description: "",
});

const ALL = [
  cat("papers", "Papers"),
  cat("filter-tips", "Filter & Tips"),
  cat("aschenbecher", "Aschenbecher"),
  cat("filter", "Filter"),
];

describe("relatedCategories", () => {
  it("verbindet «Filter» und «Filter & Tips» in beide Richtungen", () => {
    expect(relatedCategories("filter", ALL).map((c) => c.name)).toEqual(["Filter & Tips"]);
    expect(relatedCategories("filter-tips", ALL).map((c) => c.name)).toEqual(["Filter"]);
  });

  it("nennt nie die Kategorie selbst", () => {
    for (const { handle } of ALL) {
      expect(relatedCategories(handle, ALL).map((c) => c.handle)).not.toContain(handle);
    }
  });

  it("hat für andere Kategorien nichts zu sagen", () => {
    expect(relatedCategories("papers", ALL)).toEqual([]);
    expect(relatedCategories("gibt-es-nicht", ALL)).toEqual([]);
  });

  it("verlinkt keine Kategorie, die es im Backend nicht gibt", () => {
    expect(relatedCategories("filter", [cat("filter", "Filter")])).toEqual([]);
  });

  it("vergleicht exakt — `filter` ist nicht `filter-tips`", () => {
    expect(relatedCategories("filter-t", ALL)).toEqual([]);
  });
});
