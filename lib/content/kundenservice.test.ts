import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FOOTER_GROUPS } from "./kundenservice";

/**
 * Jeder Footer-Link muss auf eine echte Seite zeigen — ein toter Link im
 * Footer steht auf JEDER Seite des Shops. Route-Gruppen wie `(bereich)`
 * erscheinen nicht in der URL und werden beim Suchen übersprungen.
 */
const APP = join(__dirname, "..", "..", "app");

function hasPage(dir: string, segments: string[]): boolean {
  if (segments.length === 0) {
    if (existsSync(join(dir, "page.tsx"))) return true;
  }
  const groups = readdirSync(dir, { withFileTypes: true }).filter(
    (d) => d.isDirectory() && d.name.startsWith("("),
  );
  if (groups.some((g) => hasPage(join(dir, g.name), segments))) return true;
  if (segments.length === 0) return false;
  const [head, ...rest] = segments;
  const next = join(dir, head);
  return existsSync(next) && hasPage(next, rest);
}

describe("Footer-Links", () => {
  const links = FOOTER_GROUPS.flatMap((g) => g.links);

  it.each(links.map((l) => [l.href, l.label]))(
    "%s (%s) hat eine Seite unter app/",
    (href) => {
      const segments = href.split("/").filter(Boolean);
      expect(hasPage(APP, segments)).toBe(true);
    },
  );

  it("führt keine Adresse doppelt", () => {
    const hrefs = links.map((l) => l.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("führt die Rückgaberegel, auf die das Merchant-Markup zeigt", () => {
    expect(links.map((l) => l.href)).toContain("/service/rueckgabe");
  });
});
