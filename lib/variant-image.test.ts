import { describe, expect, it } from "vitest";
import { heroGallery } from "./variant-image";
import type { ProductVariantView } from "./types";

/**
 * Bild je Variante: «Display» zeigt die Box, «1 Heftchen» das Einzelstück.
 *
 * Getestet wird die reine Zuordnung (lib/variant-image.ts) — sie entscheidet,
 * was die Produktseite gross rendert, was vorgerendert wird und ob es den
 * clientseitigen Umschalter überhaupt braucht. Die Randfälle hier sind genau
 * die aus dem Auftrag: Variante ohne Bild, nur ein Bild, nur eine Variante,
 * und kein Springen in einen leeren Zustand.
 */

const BOX = "https://cdn.example/box.jpg";
const HEFT = "https://cdn.example/heft.jpg";
const DETAIL = "https://cdn.example/detail.jpg";

const variant = (
  id: string,
  extra: Partial<ProductVariantView> = {},
): ProductVariantView => ({
  id,
  title: id,
  price: 1,
  inStock: true,
  tiers: [],
  unitsPerPack: 1,
  packType: "single",
  ...extra,
});

/** Elements Ultra Thin: Display (Box-Bild) und 1 Heftchen (Einzelstück). */
const elements = () => ({
  images: [BOX, HEFT, DETAIL],
  variants: [
    variant("v_heft", { title: "1 Heftchen", packType: "single", image: HEFT }),
    variant("v_display", {
      title: "Display (50 Stk)",
      packType: "display",
      price: 40,
      image: BOX,
    }),
  ],
});

describe("heroGallery — Zuordnung Variante zu Bild", () => {
  it("Display -> Box, Heftchen -> Einzelstück", () => {
    const g = heroGallery(elements());
    expect(g.srcByVariant).toEqual({ v_heft: HEFT, v_display: BOX });
    expect(g.interactive).toBe(true);
  });

  it("vorausgewählt ist das Heftchen (wie in AddToCart) — sein Bild kommt zuerst sichtbar", () => {
    const g = heroGallery(elements());
    expect(g.initialSrc).toBe(HEFT);
  });

  it("ist das Heftchen ausverkauft, folgt die Vorauswahl — und damit das Bild — dem Display", () => {
    const p = elements();
    p.variants[0] = { ...p.variants[0], inStock: false };
    expect(heroGallery(p).initialSrc).toBe(BOX);
  });

  it("rendert nur referenzierte Bilder vor, ohne Duplikate, erstes Produktbild zuerst", () => {
    const g = heroGallery(elements());
    // DETAIL hängt am Produkt, aber an keiner Variante — gehört in die
    // Vorschau-Reihe, nicht in den Umschalter.
    expect(g.slides).toEqual([BOX, HEFT]);
  });

  it("Variante ohne eigenes Bild: erstes Produktbild als Rückfall, kein leerer Platz", () => {
    // Realfall: erstes Produktbild zeigt das Heftchen, nur das Display hat
    // ein eigenes Bild (die Box) zugewiesen.
    const g = heroGallery({
      images: [HEFT, BOX],
      variants: [
        variant("v_heft", { title: "1 Heftchen" }),
        variant("v_display", { packType: "display", price: 40, image: BOX }),
      ],
    });
    expect(g.srcByVariant).toEqual({ v_display: BOX });
    expect(g.defaultSrc).toBe(HEFT);
    // Vorauswahl (Heftchen) hat kein Bild -> es zeigt das erste Produktbild.
    expect(g.initialSrc).toBe(HEFT);
    expect(g.interactive).toBe(true);
  });

  it("fallen Rückfallbild und Variantenbild zusammen, gibt es nichts umzuschalten", () => {
    const p = elements();
    // Heftchen ohne Bild -> Rückfall aufs erste Produktbild, und das IST die
    // Box, die auch am Display hängt. Beide Varianten zeigen dasselbe.
    p.variants[0] = { ...p.variants[0], image: undefined };
    expect(heroGallery(p).interactive).toBe(false);
  });

  it("Produkt mit nur einem Bild: nichts umzuschalten, alles wie heute", () => {
    const g = heroGallery({
      images: [BOX],
      variants: [
        variant("v_heft", { image: BOX }),
        variant("v_display", { packType: "display", image: BOX }),
      ],
    });
    expect(g.interactive).toBe(false);
    expect(g.slides).toEqual([BOX]);
    expect(g.initialSrc).toBe(BOX);
  });

  it("Produkt mit nur einer Variante: keine Auswahl, keine Änderung", () => {
    const g = heroGallery({
      images: [BOX, HEFT],
      variants: [variant("v_only", { image: HEFT })],
    });
    expect(g.interactive).toBe(false);
  });

  it("Produkt ganz ohne Bilder: kein Umschalter, kein Bild — der Platzhalter bleibt Sache der Seite", () => {
    const g = heroGallery({
      images: [],
      variants: [variant("a"), variant("b", { packType: "display" })],
    });
    expect(g.interactive).toBe(false);
    expect(g.slides).toEqual([]);
    expect(g.initialSrc).toBeUndefined();
    expect(g.defaultSrc).toBeUndefined();
  });

  it("Thumbnail, das auf KEIN Produktbild zeigt, wird ignoriert — Rückfall statt Fremdbild", () => {
    const g = heroGallery({
      images: [BOX, HEFT],
      variants: [
        variant("v_heft", { image: "https://anderswo.example/x.jpg" }),
        variant("v_display", { packType: "display", image: BOX }),
      ],
    });
    expect(g.srcByVariant).toEqual({ v_display: BOX });
    expect(g.initialSrc).toBe(BOX);
  });

  it("zeigen alle Varianten aufs erste Bild, gibt es nichts umzuschalten", () => {
    const g = heroGallery({
      images: [BOX, HEFT],
      variants: [
        variant("v_heft", { image: BOX }),
        variant("v_display", { packType: "display", image: BOX }),
      ],
    });
    expect(g.interactive).toBe(false);
    expect(g.slides).toEqual([BOX]);
  });
});
