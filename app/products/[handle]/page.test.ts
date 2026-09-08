import { describe, expect, it, vi } from "vitest";
import type { ProductView, ProductVariantView } from "@/lib/types";

/**
 * Verdrahtung der Produktseite: Bild folgt der gewählten Variante.
 *
 * Die reine Zuordnung ist in lib/variant-image.test.ts abgedeckt; hier geht
 * es darum, dass die Seite sie richtig einbaut:
 *
 *   - Mit echter Auswahl (zwei Varianten, zwei Bilder) rendert sie den
 *     Umschalter (VariantHero) — und zwar mit ALLEN Kandidaten serverseitig
 *     vorgerendert, `priority` NUR auf dem anfangs sichtbaren Bild.
 *   - Ohne echte Auswahl (ein Bild oder eine Variante) rendert sie exakt wie
 *     bisher: ein einzelnes ProductImage mit dem ersten Produktbild.
 *   - Die Vorauswahl des Providers ist dieselbe wie in AddToCart — sonst
 *     zeigten Galerie und Kaufbox beim Laden verschiedene Varianten.
 */

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));

const mocks = vi.hoisted(() => ({
  getProduct: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  getProduct: mocks.getProduct,
  getRelatedProducts: vi.fn().mockResolvedValue([]),
  getCategory: vi.fn().mockResolvedValue(undefined),
  getStaticProductHandles: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/tenant/context", () => ({
  getTenantContext: vi.fn().mockResolvedValue({
    id: "jibbit",
    host: "shop.example",
    theme: { domain: "shop.example" },
  }),
}));

// Rendert ohnehin nichts — und soll hier kein PostHog importieren.
vi.mock("@/components/analytics/TrackProductView", () => ({
  TrackProductView: () => null,
}));

const { default: ProductPage } = await import("./page");
const { VariantHero } = await import("@/components/VariantHero");
const { VariantSelectionProvider } = await import(
  "@/components/VariantSelection"
);
const { ProductImage } = await import("@/components/ProductImage");

const BOX = "https://cdn.example/box.jpg";
const HEFT = "https://cdn.example/heft.jpg";

const variant = (
  id: string,
  extra: Partial<ProductVariantView> = {},
): ProductVariantView => ({
  id,
  title: id,
  price: 2,
  inStock: true,
  tiers: [],
  unitsPerPack: 1,
  packType: "single",
  ...extra,
});

const product = (extra: Partial<ProductView> = {}): ProductView => ({
  id: "p1",
  handle: "elements-ultra-thin",
  title: "Elements Ultra Thin",
  brand: "Elements",
  subtitle: "",
  description: "",
  categoryHandle: "papers",
  currency: "CHF",
  price: 2,
  variants: [
    variant("v_heft", { title: "1 Heftchen", image: HEFT }),
    variant("v_display", {
      title: "Display (50 Stk)",
      packType: "display",
      price: 40,
      image: BOX,
    }),
  ],
  images: [BOX, HEFT],
  featured: false,
  ...extra,
});

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Alle Elemente eines Typs im Baum — folgt nur `props.children`. */
function findAll(el: any, type: unknown): any[] {
  if (el == null || typeof el !== "object") return [];
  if (Array.isArray(el)) return el.flatMap((c) => findAll(c, type));
  const self = el.type === type ? [el] : [];
  return [...self, ...findAll(el.props?.children, type)];
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function renderPage(p: ProductView) {
  mocks.getProduct.mockResolvedValue(p);
  return ProductPage({ params: Promise.resolve({ handle: p.handle }) });
}

describe("Produktseite — Bild folgt der Variante", () => {
  it("rendert den Umschalter mit der Zuordnung Display -> Box, Heftchen -> Einzelstück", async () => {
    const el = await renderPage(product());
    const heros = findAll(el, VariantHero);
    expect(heros).toHaveLength(1);
    expect(heros[0].props.srcByVariant).toEqual({
      v_heft: HEFT,
      v_display: BOX,
    });
    expect(heros[0].props.defaultSrc).toBe(BOX);
  });

  it("rendert ALLE Kandidaten serverseitig vor; `priority` trägt nur das anfangs sichtbare Bild", async () => {
    const el = await renderPage(product());
    const [hero] = findAll(el, VariantHero);
    const bySrc = Object.fromEntries(
      hero.props.slides.map((s: { src: string; node: { props: { priority: boolean } } }) => [
        s.src,
        s.node.props.priority,
      ]),
    );
    // Vorausgewählt ist das Heftchen (günstigste Single-Variante) — sein
    // Bild ist das LCP-Element, die Box lädt lazy.
    expect(bySrc).toEqual({ [HEFT]: true, [BOX]: false });
  });

  it("Provider und AddToCart starten mit DERSELBEN Vorauswahl", async () => {
    const el = await renderPage(product());
    const [provider] = findAll(el, VariantSelectionProvider);
    expect(provider.props.initialId).toBe("v_heft");
  });

  it("nur ein Bild: kein Umschalter, ein ProductImage mit dem ersten Bild — wie bisher", async () => {
    const el = await renderPage(
      product({
        images: [BOX],
        variants: [
          variant("v_heft", { image: BOX }),
          variant("v_display", { packType: "display", image: BOX }),
        ],
      }),
    );
    expect(findAll(el, VariantHero)).toHaveLength(0);
    const heroImg = findAll(el, ProductImage).find(
      (i) => i.props.variant === "hero",
    );
    expect(heroImg?.props.src).toBe(BOX);
    expect(heroImg?.props.priority).toBe(true);
  });

  it("nur eine Variante: kein Umschalter, auch wenn sie ein eigenes Bild hätte", async () => {
    const el = await renderPage(
      product({ variants: [variant("v_only", { image: HEFT })] }),
    );
    expect(findAll(el, VariantHero)).toHaveLength(0);
    const heroImg = findAll(el, ProductImage).find(
      (i) => i.props.variant === "hero",
    );
    expect(heroImg?.props.src).toBe(BOX);
  });

  it("gar kein Bild: kein Umschalter, ProductImage ohne src — der Platzhalter übernimmt", async () => {
    const el = await renderPage(
      product({
        images: [],
        variants: [
          variant("v_heft"),
          variant("v_display", { packType: "display" }),
        ],
      }),
    );
    expect(findAll(el, VariantHero)).toHaveLength(0);
    const heroImg = findAll(el, ProductImage).find(
      (i) => i.props.variant === "hero",
    );
    expect(heroImg).toBeDefined();
    expect(heroImg?.props.src).toBeUndefined();
  });
});
