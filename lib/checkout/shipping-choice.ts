/**
 * Which delivery method goes on the cart. The customer never chooses: the
 * jibbit `swiss-shipping` provider wins; without one, the cheapest eligible
 * option. Prices come from Medusa only.
 *
 * Calculated options (the Swiss one is) carry no `amount` in the option list,
 * so a price is asked for only when there is actually something to compare.
 */

export const SWISS_SHIPPING_PROVIDER_ID = "swiss-shipping_swiss-shipping";

export interface ShippingCandidate {
  id: string;
  providerId?: string | null;
  amount?: number | null;
  insufficientInventory?: boolean;
}

export async function pickShippingOption(
  options: readonly ShippingCandidate[],
  priceOf: (id: string) => Promise<number | null>,
): Promise<string | null> {
  const eligible = options.filter((o) => !o.insufficientInventory);
  const swiss = eligible.filter((o) => o.providerId === SWISS_SHIPPING_PROVIDER_ID);
  const pool = swiss.length ? swiss : eligible;
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
