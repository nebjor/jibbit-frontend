import { describe, expect, it } from "vitest";
import { categoryHandleFromPath, categoryPath } from "./category-url";

describe("categoryPath", () => {
  it("baut /kategorie/<handle>", () => {
    expect(categoryPath("papers")).toBe("/kategorie/papers");
  });

  it("kodiert Sonderzeichen", () => {
    expect(categoryPath("filter-&-tips")).toBe("/kategorie/filter-%26-tips");
    expect(categoryPath("zubehör")).toBe("/kategorie/zubeh%C3%B6r");
  });
});

describe("categoryHandleFromPath", () => {
  it("liest das Handle zurück, dekodiert", () => {
    expect(categoryHandleFromPath("/kategorie/papers")).toBe("papers");
    expect(categoryHandleFromPath("/kategorie/filter-%26-tips")).toBe("filter-&-tips");
    expect(categoryHandleFromPath(categoryPath("zubehör"))).toBe("zubehör");
  });

  it("kennt nur genau ein Segment", () => {
    expect(categoryHandleFromPath("/")).toBeNull();
    expect(categoryHandleFromPath("/kategorie/")).toBeNull();
    expect(categoryHandleFromPath("/kategorie/a/b")).toBeNull();
    expect(categoryHandleFromPath("/products/papers")).toBeNull();
  });

  it("verwirft kaputte Kodierung", () => {
    expect(categoryHandleFromPath("/kategorie/%E0%A4%A")).toBeNull();
  });
});
