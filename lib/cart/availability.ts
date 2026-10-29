/**
 * Bestand der Warenkorbpositionen.
 *
 * Die Cart-API liefert `variant.inventory_quantity` NICHT zuverlässig: Medusa
 * berechnet dieses Feld nur auf den Produkt-Routen (je Verkaufskanal). Darum
 * wird der Bestand hier mit EINER Produktabfrage nachgeladen (`id`-Filter,
 * schmale Feldliste) und auf die Positionen gelegt. Schlägt die Abfrage fehl,
 * bleibt der Warenkorb unverändert (= unbegrenzt) — Medusa prüft beim
 * Abschluss ohnehin verbindlich.
 *
 * Pure bis auf das übergebene SDK; ohne "server-only", damit testbar.
 */

import type Medusa from "@medusajs/js-sdk";
import { availableQuantityOf } from "@/lib/stock";
import type { CartLineView, CartState } from "./types";

export const AVAILABILITY_FIELDS =
  "id,variants.id,+variants.inventory_quantity,+variants.manage_inventory,+variants.allow_backorder";

/** variant id -> bestellbare Höchstmenge (null = unbegrenzt). */
export type AvailabilityByVariant = ReadonlyMap<string, number | null>;

export async function fetchAvailability(
  sdk: Pick<Medusa, "store">,
  productIds: readonly string[],
  regionId?: string,
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (!ids.length) return out;

  const { products } = await sdk.store.product.list({
    id: ids,
    limit: ids.length,
    fields: AVAILABILITY_FIELDS,
    ...(regionId ? { region_id: regionId } : {}),
  });
  for (const p of products ?? []) {
    for (const v of p.variants ?? []) out.set(v.id, availableQuantityOf(v));
  }
  return out;
}

/** Legt den Bestand auf die Positionen; unbekannte Varianten bleiben unberührt. */
export function applyAvailability(
  state: CartState,
  availability: AvailabilityByVariant,
): CartState {
  if (!state.lines.length || availability.size === 0) return state;
  const lines: CartLineView[] = state.lines.map((l) =>
    availability.has(l.variantId)
      ? { ...l, availableQuantity: availability.get(l.variantId) ?? null }
      : l,
  );
  return { ...state, lines };
}
