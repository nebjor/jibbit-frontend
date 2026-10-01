import { describe, expect, it } from "vitest";
import { displayTitle } from "./display";

/**
 * The real jibbit.ch names this exists for: five OCB products whose titles
 * all start with the brand. With the brand on its own row line, the title
 * line must lead with the distinguishing part.
 */
describe("displayTitle", () => {
  it("strips the brand prefix from the real OCB titles", () => {
    expect(displayTitle("OCB Premium kurz", "OCB")).toBe("Premium kurz");
    expect(displayTitle("OCB Premium Rolls Slim", "OCB")).toBe(
      "Premium Rolls Slim",
    );
    expect(displayTitle("OCB Premium KSS Papers mit Filter", "OCB")).toBe(
      "Premium KSS Papers mit Filter",
    );
    expect(displayTitle("OCB Slim Filter Bio (120 Tips)", "OCB")).toBe(
      "Slim Filter Bio (120 Tips)",
    );
    expect(displayTitle("OCB Bio Slim Organic Hemp Rolls", "OCB")).toBe(
      "Bio Slim Organic Hemp Rolls",
    );
  });

  it("is case-insensitive (brand 'dubi', title capitalised or not)", () => {
    expect(displayTitle("dubi Aktivkohlefilter ø7mm", "dubi")).toBe(
      "Aktivkohlefilter ø7mm",
    );
    expect(displayTitle("Dubi Aktivkohlefilter ø7mm", "dubi")).toBe(
      "Aktivkohlefilter ø7mm",
    );
  });

  it("strips separator punctuation after the brand", () => {
    expect(displayTitle("Zig Zag - Slim Filter 6mm", "Zig Zag")).toBe(
      "Slim Filter 6mm",
    );
    expect(displayTitle("PURIZE: XTRA Slim", "PURIZE")).toBe("XTRA Slim");
  });

  it("leaves titles alone when the brand is not a clean word prefix", () => {
    // Brand appears mid-title.
    expect(displayTitle("Box: 50x Elements King Size Ultra Thin", "Elements")).toBe(
      "Box: 50x Elements King Size Ultra Thin",
    );
    // Brand is a prefix of a longer word, not a word of its own.
    expect(displayTitle("RAWr Papers", "RAW")).toBe("RAWr Papers");
  });

  it("never returns an empty string", () => {
    expect(displayTitle("RAW", "RAW")).toBe("RAW");
    expect(displayTitle("OCB ", "OCB")).toBe("OCB");
    expect(displayTitle("OCB - ", "OCB")).toBe("OCB -");
  });

  it("handles missing brand", () => {
    expect(displayTitle("Angel Slim Filters", "")).toBe("Angel Slim Filters");
  });
});
