/**
 * Which delivery method goes on the cart.
 *
 * The customer chooses between two things only — Lieferung or Abholung im
 * Laden (lib/checkout/pickup.ts). WHICH Medusa option implements the choice
 * is decided here, not by the customer:
 *
 *   pickup   -> the one option carrying the pickup marker (metadata/data/type),
 *               or null when the backend offers none.
 *   shipping -> among the NON-pickup options, the jibbit `swiss-shipping`
 *               provider wins; without one, the cheapest eligible option.
 *               Prices come from Medusa only.
 *
 * The pickup option is excluded from the shipping pool explicitly: it is a
 * CHF 0 flat option on the same provider, and "cheapest wins" would otherwise
 * put every parcel order on "Abholung" the day the option exists.
 *
 * Calculated options (the Swiss one is) carry no `amount` in the option list,
 * so a price is asked for only when there is actually something to compare.
 */

import { isPickupOption, type DeliveryChoice, type PickupOptionLike } from "./pickup";

export const SWISS_SHIPPING_PROVIDER_ID = "swiss-shipping_swiss-shipping";

export interface ShippingCandidate extends PickupOptionLike {
  id: string;
  providerId?: string | null;
  amount?: number | null;
  insufficientInventory?: boolean;
}

export async function pickShippingOption(
  options: readonly ShippingCandidate[],
  priceOf: (id: string) => Promise<number | null>,
  choice: DeliveryChoice = "shipping",
): Promise<string | null> {
  const eligible = options.filter((o) => !o.insufficientInventory);

  if (choice === "pickup") {
    return eligible.find((o) => isPickupOption(o))?.id ?? null;
  }

  const shippable = eligible.filter((o) => !isPickupOption(o));
  const swiss = shippable.filter((o) => o.providerId === SWISS_SHIPPING_PROVIDER_ID);
  const pool = swiss.length ? swiss : shippable;
  if (pool.length <= 1) return pool[0]?.id ?? null;

  const priced = await Promise.all(
    pool.map(async (o) => {
      const amount =
        typeof o.amount === "number" ? o.amount : await priceOf(o.id).catch(() => null);
      return { id: o.id, amount: amount ?? Number.POSITIVE_INFINITY };
    }),
  );
  return priced.reduce((best, o) => (o.amount < best.amount ? o : best)).id;
}
