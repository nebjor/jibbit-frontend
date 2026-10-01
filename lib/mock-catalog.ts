/**
 * MOCK CATALOG — development fallback.
 *
 * Used ONLY when the Medusa backend is unreachable (see lib/data.ts). The data
 * is real jibbit.ch product/price data, already expressed in the internal view
 * shape, so swapping to the live backend is a pure adapter change.
 *
 * Prices are decimal CHF, matching Medusa v2 semantics (27.00 === 27).
 * `images` is intentionally empty: no product photography exists yet, so the
 * <ProductImage> component renders a token-styled placeholder.
 */

import type { CategoryView, ProductView, CategoryHandle } from "./types";

export const MOCK_CATEGORIES: CategoryView[] = [
  {
    id: "cat_papers",
    handle: "papers",
    name: "Papers",
    description:
      "Rolls, King Size, kurz und Slim. Von RAW über Elements bis OCB — alles was du zum Drehen brauchst.",
  },
  {
    id: "cat_filter",
    handle: "filter",
    name: "Filter",
    description:
      "Aktivkohlefilter und Slim Filters. PURIZE, dubi, Angel und Zig Zag — einzeln oder im Vorratspack.",
  },
  {
    id: "cat_zubehoer",
    handle: "zubehoer",
    name: "Zubehör & Glas",
    description:
      "Aschenbecher aus Kristallglas und weiteres Zubehör. Sachen, die man behält.",
  },
];

interface Seed {
  handle: string;
  title: string;
  brand: string;
  subtitle: string;
  description: string;
  category: CategoryHandle;
  price: number;
  compareAt?: number;
  featured?: boolean;
  /** Optional extra variants beyond the default one. */
  variants?: { title: string; price: number; compareAt?: number }[];
}

const SEEDS: Seed[] = [
  // ---- Zubehör & Glas ----------------------------------------------------
  {
    handle: "raw-kristallglas-aschenbecher-ruby",
    title: "RAW Kristallglas Aschenbecher Ruby",
    brand: "RAW",
    subtitle: "Handgefertigt, massives Kristallglas",
    description:
      "Der RAW Aschenbecher in Ruby. Massives Kristallglas, spürbares Gewicht, tiefe Mulde — kippt nicht um, wenn's mal hektisch wird. Kein Wegwerf-Teil, sondern eines das bleibt.",
    category: "zubehoer",
    price: 27.0,
    compareAt: 29.0,
    featured: true,
  },
  {
    handle: "raw-kristallglas-aschenbecher-darkside",
    title: "RAW Kristallglas Aschenbecher Darkside",
    brand: "RAW",
    subtitle: "Handgefertigt, massives Kristallglas",
    description:
      "Darkside — rauchgraues Kristallglas, matt schimmernd. Gleiche Qualität wie der Ruby, nur in düster. Für alle die es unauffällig mögen.",
    category: "zubehoer",
    price: 27.0,
    compareAt: 29.0,
    featured: true,
  },
  {
    handle: "raw-kristallglas-aschenbecher-rainbow",
    title: "RAW Kristallglas Aschenbecher Rainbow",
    brand: "RAW",
    subtitle: "Handgefertigt, massives Kristallglas",
    description:
      "Rainbow: schillernde Beschichtung auf massivem Kristallglas. Jedes Stück fällt leicht anders aus — deins gibt's genau einmal.",
    category: "zubehoer",
    price: 27.0,
    compareAt: 29.0,
  },

  // ---- Papers ------------------------------------------------------------
  {
    handle: "raw-classic-rolls-slim",
    title: "RAW Classic Rolls Slim",
    brand: "RAW",
    subtitle: "Endlospapier, 5 m Rolle",
    description:
      "Die Endlosrolle von RAW. Ungebleicht, natürlich braun, du reisst genau so viel ab wie du brauchst. Klassiker aus gutem Grund.",
    category: "papers",
    price: 1.95,
    compareAt: 3.2,
    featured: true,
  },
  {
    handle: "elements-king-size-ultra-thin",
    title: "Elements King Size Ultra Thin",
    brand: "Elements",
    subtitle: "Reispapier, brennt rückstandsfrei",
    description:
      "Elements King Size aus ultradünnem Reispapier. Verbrennt praktisch rückstandsfrei — kein Papiergeschmack, nur das was drin ist.",
    category: "papers",
    price: 0.85,
    compareAt: 0.9,
    featured: true,
  },
  {
    handle: "box-50x-elements-king-size-ultra-thin",
    title: "Box: 50x Elements King Size Ultra Thin",
    brand: "Elements",
    subtitle: "Ganze Box, 50 Hefte",
    description:
      "Die ganze Box. 50 Hefte Elements King Size Ultra Thin. Rechne kurz nach: pro Heft deutlich günstiger als einzeln. Für alle die nicht jede Woche nachbestellen wollen.",
    category: "papers",
    price: 38.0,
    compareAt: 40.0,
  },
  {
    handle: "elements-blue-rolls-sw",
    title: "Elements BLUE Rolls SW",
    brand: "Elements",
    subtitle: "Endlospapier, Slim Width",
    description:
      "Elements BLUE als Endlosrolle in Slim Width. Feines Reispapier, langsamer Abbrand, keine Naht die stört.",
    category: "papers",
    price: 1.7,
    compareAt: 2.0,
  },
  {
    handle: "smoking-brown-double-window",
    title: "Smoking Brown Double Window",
    brand: "Smoking",
    subtitle: "Ungebleicht, mit Sichtfenster",
    description:
      "Smoking Brown mit doppeltem Sichtfenster im Heft — du siehst wie viel noch drin ist. Ungebleichtes Papier, natürliche Gummierung.",
    category: "papers",
    price: 1.9,
    compareAt: 2.0,
  },
  {
    handle: "display-25x-smoking-brown-kurz",
    title: "Display: 25x Smoking Brown kurz",
    brand: "Smoking",
    subtitle: "Display mit 25 Heften",
    description:
      "Volles Display, 25 Hefte Smoking Brown kurz. Zum halben Preis gegenüber Einzelkauf. Für die WG, den Verein oder einfach für dich.",
    category: "papers",
    price: 24.0,
    compareAt: 50.0,
    featured: true,
  },
  {
    handle: "greengo-unbleached-slim-rolls",
    title: "Greengo Unbleached Slim Rolls",
    brand: "Greengo",
    subtitle: "Ungebleicht, chlorfrei",
    description:
      "Greengo als Endlosrolle: ungebleicht, chlorfrei, ohne Zusätze. Wer auf reines Papier Wert legt, ist hier richtig.",
    category: "papers",
    price: 1.95,
    compareAt: 2.5,
  },
  {
    handle: "display-24x-greengo-unbleached-slim-rolls",
    title: "Display: 24x Greengo Unbleached Slim Rolls",
    brand: "Greengo",
    subtitle: "Display mit 24 Rollen",
    description:
      "24 Greengo Slim Rolls im Display. Ungebleicht und chlorfrei, im Vorratspack deutlich günstiger.",
    category: "papers",
    price: 33.6,
    compareAt: 45.6,
  },
  {
    handle: "ocb-premium-kurz",
    title: "OCB Premium kurz",
    brand: "OCB",
    subtitle: "Kurzes Format, ultradünn",
    description:
      "OCB Premium im kurzen Format. Dünnes Papier, sauberer Abbrand, seit Jahrzehnten unverändert gut.",
    category: "papers",
    price: 1.79,
    compareAt: 2.0,
  },
  // Die vier weiteren OCB-Artikel aus dem echten Import (Namen und
  // Basispreise aus catalog.json des Katalog-Branches). Sie sind zugleich
  // der harte Testfall der Suche: fünf Namen mit gemeinsamem Präfix
  // "OCB …", die sich erst am ZeilenENDE unterscheiden.
  {
    handle: "ocb-premium-kss-papers-mit-filter",
    title: "OCB Premium KSS Papers mit Filter",
    brand: "OCB",
    subtitle: "King Size Slim, Tips integriert",
    description:
      "OCB Premium King Size Slim mit perforierten Filter-Tips im selben Heft. Ein Kauf, alles dabei.",
    category: "papers",
    price: 1.95,
  },
  {
    handle: "ocb-premium-rolls-slim",
    title: "OCB Premium Rolls Slim",
    brand: "OCB",
    subtitle: "Endlospapier, Slim-Breite",
    description:
      "OCB Premium als Endlosrolle in Slim-Breite. Du reisst ab, was du brauchst — kein vorgegebenes Format.",
    category: "papers",
    price: 1.95,
  },
  {
    handle: "ocb-bio-slim-organic-hemp-rolls",
    title: "OCB Bio Slim Organic Hemp Rolls",
    brand: "OCB",
    subtitle: "Bio-Hanf, Endlosrolle",
    description:
      "Endlosrolle aus ungebleichtem Bio-Hanfpapier. Die Öko-Variante der Premium Rolls, gleiche Slim-Breite.",
    category: "papers",
    price: 1.6,
  },

  // ---- Filter ------------------------------------------------------------
  {
    handle: "ocb-slim-filter-bio-120-tips",
    title: "OCB Slim Filter Bio (120 Tips)",
    brand: "OCB",
    subtitle: "120 Tips, ungebleicht",
    description:
      "Vorgeschnittene Filter-Tips aus ungebleichtem Papier, 120 Stück im Heft. Passen zu jedem Slim-Format.",
    category: "filter",
    price: 1.8,
  },
  {
    handle: "dubi-aktivkohlefilter-7mm",
    title: "dubi Aktivkohlefilter ø7mm",
    brand: "dubi",
    subtitle: "Aktivkohle, Standardgrösse",
    description:
      "dubi Aktivkohlefilter mit 7 mm Durchmesser. Filtert Teer und Schadstoffe, ohne den Zug zu blockieren. Der Standard, wenn du keinen Gedanken dran verschwenden willst.",
    category: "filter",
    price: 7.5,
    compareAt: 7.9,
    featured: true,
  },
  {
    handle: "purize-aktivkohlefilter-9mm",
    title: "PURIZE Aktivkohlefilter ø9mm",
    brand: "PURIZE",
    subtitle: "Aktivkohle, 9 mm",
    description:
      "PURIZE in 9 mm — der grössere Durchmesser für mehr Volumen. Aktivkohle aus Kokosschale, mehrfach gesiebt, kein Kohlestaub im Zug.",
    category: "filter",
    price: 7.4,
    compareAt: 7.9,
    featured: true,
  },
  {
    handle: "purize-xtra-slim-59mm",
    title: "PURIZE XTRA Slim ø5.9mm",
    brand: "PURIZE",
    subtitle: "Extra schlank, 5.9 mm",
    description:
      "Die XTRA Slim Variante mit 5.9 mm. Passt in jedes Slim Paper, ohne dass es auseinanderfällt. Gleiche Filterleistung, weniger Durchmesser.",
    category: "filter",
    price: 7.8,
    compareAt: 8.9,
  },
  {
    handle: "purize-white-50er-pack",
    title: "PURIZE White 50er Pack",
    brand: "PURIZE",
    subtitle: "50 Stück, weisses Papier",
    description:
      "PURIZE White im 50er Pack. Weisse Papierhülle statt braun — sonst identisch. Praktische Menge für ein paar Wochen.",
    category: "filter",
    price: 7.8,
    compareAt: 8.9,
  },
  {
    handle: "zig-zag-slim-filter-6mm-120stk",
    title: "Zig Zag Slim Filter 6mm 120stk",
    brand: "Zig Zag",
    subtitle: "120 Stück, 6 mm",
    description:
      "Zig Zag Slim Filter, 6 mm, 120 Stück im Beutel. Klassische Schaumstoff-Slims — günstig, zuverlässig, nie ausgehen lassen.",
    category: "filter",
    price: 1.6,
    compareAt: 1.7,
  },
  {
    handle: "angel-slim-filters",
    title: "Angel Slim Filters",
    brand: "Angel",
    subtitle: "Slim Format",
    description:
      "Angel Slim Filters. Simpel, günstig, tun genau was sie sollen. Der Filter für den Alltag.",
    category: "filter",
    price: 1.4,
    compareAt: 2.1,
    featured: true,
  },
];

export const MOCK_PRODUCTS: ProductView[] = SEEDS.map((s, i) => {
  const extra = s.variants ?? [];
  // No quantity breaks in the mock catalogue: the tiers live in the backend's
  // pricing module and are fetched separately. An empty `tiers` array is the
  // honest representation — the product page then shows no price table, which
  // is exactly right for a fallback that cannot know the real staggering.
  const variants = [
    {
      id: `variant_${s.handle}_default`,
      title: extra.length ? "Standard" : s.subtitle,
      price: s.price,
      compareAt: s.compareAt,
      inStock: true,
      tiers: [],
      unitsPerPack: 1,
      packType: "single" as const,
    },
    ...extra.map((v, j) => ({
      id: `variant_${s.handle}_${j}`,
      title: v.title,
      price: v.price,
      compareAt: v.compareAt,
      inStock: true,
      tiers: [],
      unitsPerPack: 1,
      packType: "single" as const,
    })),
  ];

  return {
    id: `prod_mock_${i + 1}`,
    handle: s.handle,
    title: s.title,
    brand: s.brand,
    subtitle: s.subtitle,
    description: s.description,
    categoryHandle: s.category,
    currency: "CHF",
    price: s.price,
    compareAt: s.compareAt,
    variants,
    images: [],
    featured: Boolean(s.featured),
  };
});
