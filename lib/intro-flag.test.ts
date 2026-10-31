import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Quelltext-Verträge für die Schalter, die in Server-Komponenten sitzen
 * (vitest läuft ohne React — gleiches Muster wie ShopTrust.test.ts).
 */
const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), "utf8");

describe("Schalter in Komponenten", () => {
  it("Startseite zeigt das Intro nur mit features.intro", () => {
    expect(read("app/page.tsx")).toMatch(/FEATURES\.intro \? <HomeIntro \/> : null/);
  });

  it("Layout schreibt Token-Überschreibungen nur, wenn es welche gibt", () => {
    const code = read("app/layout.tsx");
    expect(code).toMatch(/themeCss\(SHOP\.theme\)/);
    expect(code).toMatch(/tokenCss \? \(/);
  });

  it("Layout schaltet das Google Widget über features.googleReviews", () => {
    expect(read("app/layout.tsx")).toMatch(/FEATURES\.googleReviews &&/);
  });
});
