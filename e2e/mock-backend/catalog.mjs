/**
 * Fixture catalogue for the end-to-end suite.
 *
 * Shaped exactly like Medusa v2 store responses (decimal CHF, no cents), so
 * `lib/adapters.ts` is exercised for real instead of being bypassed. Every
 * number here is asserted on in `e2e/*.spec.ts` — changing one means changing
 * the spec that reads it.
 */

export const REGION = {
  id: "reg_e2e_ch",
  name: "Schweiz",
  currency_code: "chf",
  countries: [{ id: "cou_ch", iso_2: "ch", display_name: "Schweiz" }],
};

export const CATEGORIES = [
  {
    id: "pcat_papers",
    name: "Papers",
    handle: "papers",
    description: "Rolls, King Size, kurz und Slim.",
  },
  {
    id: "pcat_filter",
    name: "Filter",
    handle: "filter",
    description: "Aktivkohlefilter und Slim Filters.",
  },
  {
    id: "pcat_zubehoer",
    name: "Zubehör & Glas",
    handle: "zubehoer",
    description: "Aschenbecher aus Kristallglas und weiteres Zubehör.",
  },
];

/** 64×64 PNGs in the shop's own colours — enough for next/image to optimise. */
export const IMAGE_FILES = {
  "ocb-heftchen.png":
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAUUlEQVR42u3PQQkAAAgEsOvhz/6lbGIE38JgBZapfi0CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAldgAWbv4QBl6HJtAAAAAElFTkSuQmCC",
  "ocb-display.png":
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAATElEQVR42u3PMQ0AAAwDoCqof7mVsHsJOCB9LgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICV2DmWaAfXIWmPgAAAABJRU5ErkJggg==",
  "purize-white.png":
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAT0lEQVR42u3PQQkAAAgEsEvsR+xvBN/CYAWW6XotAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJXYAHZFmE8kKEmUQAAAABJRU5ErkJggg==",
  "raw-ruby.png":
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAUUlEQVR42u3PQQkAAAgEsOvhz/6lbGIE38JgBZapfi0CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAldgAWbv4QBl6HJtAAAAAElFTkSuQmCC",
  "kailar-weiss.png":
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAT0lEQVR42u3PQQkAAAgEsEvsR+xvBN/CYAWW6XotAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJXYAHZFmE8kKEmUQAAAABJRU5ErkJggg==",
};

/** Medusa writes absolute URLs; `lib/media.ts` keys off the `/static/` segment. */
const staticUrl = (backendUrl, file) => `${backendUrl}/static/${file}`;

function variant(id, title, amount, originalAmount, extra = {}) {
  return {
    id,
    title,
    sku: id.replace("var_", "SKU-").toUpperCase(),
    manage_inventory: false,
    allow_backorder: false,
    inventory_quantity: 0,
    thumbnail: null,
    ean: null,
    upc: null,
    barcode: null,
    material: null,
    options: [],
    metadata: { units_per_pack: 1, pack_type: "single" },
    calculated_price: {
      calculated_amount: amount,
      original_amount: originalAmount ?? amount,
      currency_code: "chf",
    },
    ...extra,
  };
}

export function buildProducts(backendUrl) {
  return [
    {
      id: "prod_ocb_kss",
      handle: "ocb-premium-kss-papers-mit-filter",
      title: "OCB Premium King Size Slim mit Filter",
      subtitle: "32 Blättchen und 32 Tips je Heftchen",
      description:
        "Das Standardheftchen fürs Drehen: dünnes Premium-Papier, passende Tips gleich dabei. Ab dem 24er Display wird es deutlich günstiger.",
      material: null,
      collection: null,
      categories: [CATEGORIES[0]],
      tags: [{ id: "tag_featured", value: "featured" }],
      options: [],
      images: [
        { id: "img_ocb_1", url: staticUrl(backendUrl, "ocb-heftchen.png") },
        { id: "img_ocb_2", url: staticUrl(backendUrl, "ocb-display.png") },
      ],
      metadata: {
        brand: "OCB",
        preistabelle: {
          stufen: [
            { min_quantity: 10, label: "10 Stück" },
            { min_quantity: 24, label: "24er Display", image_id: "img_ocb_2" },
          ],
        },
      },
      variants: [variant("var_ocb_kss", "Heftchen", 2.2)],
    },
    {
      id: "prod_purize_xtra",
      handle: "purize-xtra-slim-white-50er-pack-5-9mm",
      title: "PURIZE Xtra Slim White 50er Pack",
      subtitle: "Aktivkohlefilter, 5.9 mm",
      description:
        "Aktivkohlefilter im 50er Beutel. Hält den Zug kühl und filtert, ohne zu ziehen wie ein Strohhalm.",
      material: null,
      collection: null,
      categories: [CATEGORIES[1]],
      tags: [],
      options: [],
      images: [
        { id: "img_purize_1", url: staticUrl(backendUrl, "purize-white.png") },
      ],
      metadata: { brand: "PURIZE" },
      variants: [variant("var_purize_xtra", "50er Pack", 4.5)],
    },
    {
      id: "prod_kailar_weiss",
      handle: "kailar-filter-5-9mm-65stk-weiss",
      title: "Kailar Filter 5.9 mm, 65 Stk. weiss",
      subtitle: "Aktivkohlefilter im Vorratspack",
      description:
        "65 Aktivkohlefilter im Döschen. Gleicher Durchmesser wie die PURIZE, nur mehr davon.",
      material: null,
      collection: null,
      categories: [CATEGORIES[1]],
      tags: [],
      options: [],
      images: [
        { id: "img_kailar_1", url: staticUrl(backendUrl, "kailar-weiss.png") },
      ],
      metadata: { brand: "Kailar" },
      variants: [variant("var_kailar_weiss", "Döschen", 3.9)],
    },
    {
      id: "prod_raw_ruby",
      handle: "raw-kristallglas-aschenbecher-ruby",
      title: "RAW Kristallglas Aschenbecher Ruby",
      subtitle: "Handgefertigt, massives Kristallglas",
      description:
        "Massives Kristallglas, spürbares Gewicht, tiefe Mulde. Kein Wegwerfteil, sondern eines das bleibt.",
      material: "Kristallglas",
      collection: null,
      categories: [CATEGORIES[2]],
      tags: [{ id: "tag_featured", value: "featured" }],
      options: [],
      images: [{ id: "img_raw_1", url: staticUrl(backendUrl, "raw-ruby.png") }],
      metadata: { brand: "RAW" },
      variants: [variant("var_raw_ruby", "Stück", 27, 29)],
    },
  ];
}

/**
 * Quantity breaks per variant, as `/store/price-tiers` returns them.
 * A variant missing here has one flat price and renders no table.
 */
export const TIERS = {
  var_ocb_kss: [
    { min_quantity: 1, max_quantity: 9, amount: 2.2 },
    { min_quantity: 10, max_quantity: 23, amount: 1.95 },
    { min_quantity: 24, max_quantity: null, amount: 1.6, original_amount: 2.2 },
  ],
  var_purize_xtra: [
    { min_quantity: 1, max_quantity: 4, amount: 4.5 },
    { min_quantity: 5, max_quantity: null, amount: 3.9 },
  ],
  var_kailar_weiss: [
    { min_quantity: 1, max_quantity: 9, amount: 3.9 },
    { min_quantity: 10, max_quantity: null, amount: 3.4 },
  ],
};

/** The tier price at `quantity` — the same rule Medusa's pricing module applies. */
export function unitPriceAt(variantId, fallback, quantity) {
  const tiers = TIERS[variantId];
  if (!tiers) return fallback;
  const hit = tiers.find(
    (t) =>
      quantity >= t.min_quantity &&
      (t.max_quantity === null || quantity <= t.max_quantity),
  );
  return (hit ?? tiers[0]).amount;
}

export const SHIPPING_OPTIONS = [
  {
    id: "so_swiss_standard",
    name: "Versand",
    provider_id: "swiss-shipping_swiss-shipping",
    price_type: "calculated",
    amount: null,
    insufficient_inventory: false,
  },
  {
    id: "so_swiss_express",
    name: "Express",
    provider_id: "swiss-shipping_swiss-shipping",
    price_type: "calculated",
    amount: null,
    insufficient_inventory: false,
  },
];

/** Mirrors the backend's swiss-shipping provider: CHF 4.50, free from CHF 69. */
export const SHIPPING_RATES = {
  so_swiss_standard: { rate: 4.5, freeFrom: 69 },
  so_swiss_express: { rate: 12, freeFrom: null },
};
