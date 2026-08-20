/**
 * SERVER SIDE of the instant search: builds the shippable index docs from the
 * data layer. Follows the repo rule — components never import `medusa` or
 * `mock-catalog`; everything flows through `lib/data.ts`, which resolves the
 * tenant at request time. Nothing here reads NEXT_PUBLIC_* and nothing is
 * baked into the image, so one shared image serves every tenant's own
 * catalogue.
 */

import "server-only";

import { getProducts, getCategories } from "../data";
import type { ProductView, CategoryView } from "../types";
import type { SearchDoc } from "./engine";

export function toSearchDoc(
  p: ProductView,
  categories: CategoryView[],
): SearchDoc {
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    brand: p.brand,
    subtitle: p.subtitle,
    category:
      categories.find((c) => c.handle === p.categoryHandle)?.name ?? "",
    description: p.description,
    price: p.price,
    currency: p.currency,
  };
}

/** The whole catalogue as search docs — the payload the header ships. */
export async function getSearchDocs(): Promise<SearchDoc[]> {
  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);
  return products.map((p) => toSearchDoc(p, categories));
}
