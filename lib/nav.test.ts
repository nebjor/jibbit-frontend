import { describe, expect, it } from "vitest";
import { activeCategory } from "./nav";

/**
 * Regressionsfall aus dem Live-Befund: Bei ausgewähltem „Filter & Tips"
 * waren drei Reiter gleichzeitig aktiv. Die Handles hier sind absichtlich
 * so gewählt, dass ein Teilstring-/Präfix-Vergleich („filter" in
 * „filter-tips") oder ein kollabiertes Auffang-Handle sofort auffliegen
 * würde.
 *
 * Der Katalog liegt inzwischen auf der Startseite — aktiv wird auf `/`
 * markiert, nicht mehr auf /shop (dort läuft nur noch die Umleitung).
 */
const HANDLES = ["papers", "filter", "filter-tips", "aschenbecher"] as const;

/** Alle Nav-Einträge: "" steht für den „Alles"-Reiter. */
const NAV_ENTRIES = ["", ...HANDLES];

function activeEntries(pathname: string, kategorie: string | null): string[] {
  const active = activeCategory(pathname, kategorie, HANDLES);
  return NAV_ENTRIES.filter((entry) => entry === active && active !== null);
}

describe("activeCategory", () => {
  it("markiert bei ?kategorie=filter-tips NUR den Reiter filter-tips", () => {
    expect(activeCategory("/", "filter-tips", HANDLES)).toBe("filter-tips");
    expect(activeEntries("/", "filter-tips")).toEqual(["filter-tips"]);
  });

  it("markiert bei ?kategorie=filter NUR filter, nicht filter-tips", () => {
    expect(activeCategory("/", "filter", HANDLES)).toBe("filter");
    expect(activeEntries("/", "filter")).toEqual(["filter"]);
  });

  it("markiert für jede Kategorie genau EINEN Eintrag", () => {
    for (const handle of HANDLES) {
      expect(activeEntries("/", handle)).toHaveLength(1);
    }
  });

  it("markiert ohne Parameter den Alles-Reiter", () => {
    expect(activeCategory("/", null, HANDLES)).toBe("");
    expect(activeEntries("/", null)).toEqual([""]);
  });

  it("markiert bei unbekannter Kategorie nichts — die Seite ist dann ein 404", () => {
    expect(activeCategory("/", "gibts-nicht", HANDLES)).toBeNull();
  });

  it("vergleicht exakt, nie als Teilstring", () => {
    expect(activeCategory("/", "filt", HANDLES)).toBeNull();
    expect(activeCategory("/", "ilter", HANDLES)).toBeNull();
    expect(activeCategory("/", "filter-", HANDLES)).toBeNull();
    expect(activeCategory("/", "filter-tips-extra", HANDLES)).toBeNull();
  });

  it("markiert ausserhalb des Katalogs nichts", () => {
    expect(activeCategory("/products/x", null, HANDLES)).toBeNull();
    expect(activeCategory("/checkout", "filter", HANDLES)).toBeNull();
    // Die alte Shop-Adresse ist nur noch eine Umleitung — kein aktiver Reiter.
    expect(activeCategory("/shop", "filter", HANDLES)).toBeNull();
  });
});

describe("activeCategory — Kategoriepfad /kategorie/<handle>", () => {
  it("markiert die Kategorie aus dem Pfad, genau einen Eintrag", () => {
    expect(activeCategory("/kategorie/filter-tips", null, HANDLES)).toBe("filter-tips");
    expect(activeEntries("/kategorie/filter-tips", null)).toEqual(["filter-tips"]);
    expect(activeEntries("/kategorie/filter", null)).toEqual(["filter"]);
  });

  it("dekodiert Sonderzeichen im Handle", () => {
    expect(activeCategory("/kategorie/a%26b", null, ["a&b"])).toBe("a&b");
  });

  it("markiert bei unbekanntem Handle nichts", () => {
    expect(activeCategory("/kategorie/gibts-nicht", null, HANDLES)).toBeNull();
  });
});
