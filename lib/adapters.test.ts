import { describe, expect, it } from "vitest";
import type { StoreProductCategory } from "@medusajs/types";
import { toCategoryView } from "./adapters";

const cat = (id: string, name: string, handle: string): StoreProductCategory =>
  ({ id, name, handle }) as StoreProductCategory;

/**
 * Regressionsfall aus dem Live-Befund: Der Adapter hat jedes unbekannte
 * Backend-Handle auf "zubehoer" gezwungen. Drei Admin-Kategorien behielten
 * ihre Namen, verlinkten aber alle auf `?kategorie=zubehoer` — daher kam
 * jeder Kategorielink im HTML mehrfach vor und mehrere Reiter waren
 * gleichzeitig „aktiv".
 */
describe("toCategoryView", () => {
  it("lässt unbekannte Handles unverändert durch — jede Kategorie behält ihren eigenen Link", () => {
    const views = [
      cat("c1", "Filter & Tips", "filter-tips"),
      cat("c2", "Aschenbecher", "aschenbecher"),
      cat("c3", "Kräutermischungen", "krautermischungen"),
    ].map(toCategoryView);

    expect(views.map((v) => v.handle)).toEqual([
      "filter-tips",
      "aschenbecher",
      "krautermischungen",
    ]);
    // Kein Kollabieren: alle Handles paarweise verschieden.
    expect(new Set(views.map((v) => v.handle)).size).toBe(3);
  });

  it("normalisiert nur Schreibweise: Umlaut und Grossschreibung", () => {
    expect(toCategoryView(cat("c1", "Zubehör", "Zubehör")).handle).toBe(
      "zubehoer",
    );
    expect(toCategoryView(cat("c2", "Papers", "PAPERS")).handle).toBe("papers");
  });

  it("behält Name und Beschreibung des Backends", () => {
    const view = toCategoryView({
      ...cat("c1", "Filter & Tips", "filter-tips"),
      description: "Tips aus Papier.",
    } as StoreProductCategory);
    expect(view.name).toBe("Filter & Tips");
    expect(view.description).toBe("Tips aus Papier.");
  });
});
