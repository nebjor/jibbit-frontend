/**
 * ADAPTER BOUNDARY — Medusa entities -> internal view types.
 *
 * This is the ONLY file that knows the shape of a Medusa product. Components
 * read `ProductView`, never `StoreProduct`. When the backend schema shifts,
 * this file changes and nothing else does.
 *
 * PRICING: Medusa v2 stores prices as decimals. CHF 27.00 arrives as `27`.
 * Never multiply or divide by 100.
 */

import type {
  StoreProduct,
  StoreProductVariant,
  StoreProductCategory,
} from "@medusajs/types";
import type {
  CategoryHandle,
  CategoryView,
  PackType,
  PriceTier,
  ProductVariantView,
  ProductView,
} from "./types";
import { MOCK_CATEGORIES } from "./mock-catalog";

/** variant id -> its quantity breaks, as returned by /store/price-tiers. */
export type TiersByVariant = Record<string, PriceTier[]>;

const KNOWN_CATEGORIES: CategoryHandle[] = ["papers", "filter", "zubehoer"];

const PACK_TYPES: PackType[] = ["single", "display", "box"];

/**
 * Packaging info lives in `variant.metadata` (`units_per_pack`, `pack_type`),
 * written by the catalogue importer.
 *
 * Metadata is untyped JSON that anyone can edit in the Admin, so it is
 * validated here rather than trusted — a stray `units_per_pack: 0` must not
 * turn into a division by zero in `pricePerUnit`.
 */
function toPackaging(metadata: Record<string, unknown> | null | undefined): {
  unitsPerPack: number;
  packType: PackType;
} {
  const rawUnits = Number(metadata?.units_per_pack);
  const rawType = String(metadata?.pack_type ?? "");

  return {
    unitsPerPack:
      Number.isFinite(rawUnits) && rawUnits >= 1 ? Math.floor(rawUnits) : 1,
    packType: PACK_TYPES.includes(rawType as PackType)
      ? (rawType as PackType)
      : "single",
  };
}

function toCategoryHandle(raw: string | null | undefined): CategoryHandle {
  const h = (raw ?? "").toLowerCase().replace("zubehör", "zubehoer");
  return (KNOWN_CATEGORIES as string[]).includes(h)
    ? (h as CategoryHandle)
    : "zubehoer";
}

function toVariantView(
  v: StoreProductVariant,
  tiers: PriceTier[] = [],
): ProductVariantView {
  const calc = v.calculated_price;
  return {
    id: v.id,
    title: v.title ?? "Standard",
    // Decimal CHF, used verbatim.
    price: calc?.calculated_amount ?? 0,
    compareAt:
      calc?.original_amount != null &&
      calc.calculated_amount != null &&
      calc.original_amount > calc.calculated_amount
        ? calc.original_amount
        : undefined,
    inStock:
      v.manage_inventory === false ||
      v.allow_backorder === true ||
      (v.inventory_quantity ?? 0) > 0,
    // A single tier is not a quantity discount — it is just the price. Drop it
    // so the product page renders no table instead of a one-row table.
    tiers: tiers.length > 1 ? tiers : [],
    ...toPackaging(v.metadata as Record<string, unknown> | null | undefined),
  };
}

export function toProductView(
  p: StoreProduct,
  tiersByVariant: TiersByVariant = {},
): ProductView {
  const variants = (p.variants ?? []).map((v) =>
    toVariantView(v, tiersByVariant[v.id]),
  );
  const cheapest = variants.reduce<ProductVariantView | undefined>(
    (min, v) => (!min || v.price < min.price ? v : min),
    undefined,
  );

  const category = p.categories?.[0]?.handle ?? p.collection?.handle;

  return {
    id: p.id,
    handle: p.handle ?? p.id,
    title: p.title ?? "",
    // `brand` is a jibbit-specific metadata field on the Medusa product.
    brand: String(p.metadata?.brand ?? ""),
    subtitle: p.subtitle ?? "",
    description: p.description ?? "",
    categoryHandle: toCategoryHandle(category),
    currency:
      p.variants?.[0]?.calculated_price?.currency_code?.toUpperCase() ?? "CHF",
    price: cheapest?.price ?? 0,
    compareAt: cheapest?.compareAt,
    variants,
    images: (p.images ?? []).map((i) => i.url).filter(Boolean),
    featured: p.tags?.some((t) => t.value === "featured") ?? false,
  };
}

export function toCategoryView(c: StoreProductCategory): CategoryView {
  const handle = toCategoryHandle(c.handle);
  const fallback = MOCK_CATEGORIES.find((m) => m.handle === handle);
  return {
    id: c.id,
    handle,
    name: c.name ?? fallback?.name ?? handle,
    description: c.description ?? fallback?.description ?? "",
  };
}
