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

  it("fällt bei unbekannter Kategorie auf Alles zurück — die Seite zeigt dann das ganze Sortiment", () => {
    expect(activeCategory("/", "gibts-nicht", HANDLES)).toBe("");
  });

  it("vergleicht exakt, nie als Teilstring", () => {
    expect(activeCategory("/", "filt", HANDLES)).toBe("");
    expect(activeCategory("/", "ilter", HANDLES)).toBe("");
    expect(activeCategory("/", "filter-", HANDLES)).toBe("");
    expect(activeCategory("/", "filter-tips-extra", HANDLES)).toBe("");
  });

  it("markiert ausserhalb des Katalogs nichts", () => {
    expect(activeCategory("/products/x", null, HANDLES)).toBeNull();
    expect(activeCategory("/checkout", "filter", HANDLES)).toBeNull();
    // Die alte Shop-Adresse ist nur noch eine Umleitung — kein aktiver Reiter.
    expect(activeCategory("/shop", "filter", HANDLES)).toBeNull();
  });
});
