import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { readCartState } from "@/lib/cart/server";

export const metadata: Metadata = {
  title: "Kasse",
  // A checkout page has nothing to offer a search engine and everything to
  // lose by being indexed.
  robots: { index: false, follow: false },
};

/**
 * The checkout is server-rendered from the live Medusa cart, so a customer who
 * lands here with a stale tab sees the real basket rather than one reconstructed
 * from client state.
 */
export default async function CheckoutPage() {
  const cart = await readCartState();

  // Nothing to check out. Bouncing to the shop beats an empty form.
  if (cart.count === 0) redirect("/shop");

  return <CheckoutFlow initialCart={cart} />;
}
