import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { getAddresses, getCurrentCustomer } from "@/lib/auth/customer";
import { readSessionToken } from "@/lib/auth/session";
import { readCartState } from "@/lib/cart/server";
import { requiresAccount } from "@/lib/checkout/account-requirement";
import { pickPrefillAddress } from "@/lib/checkout/prefill";
import type { CheckoutAddress } from "@/lib/cart/types";

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
 *
 * KONTOPFLICHT: Ob eine Anmeldung verlangt wird, entscheidet allein
 * `lib/checkout/account-requirement.ts`. Die Umleitung führt über
 * `?next=/checkout` GENAU HIERHER zurück — der Warenkorb hängt an einem
 * eigenen Cookie (`jibbit_cart_id`), das von Anmeldung und Registrierung
 * unberührt bleibt, und überlebt den Umweg deshalb vollständig.
 *
 * Geprüft wird das Sitzungscookie, nicht das Backend: ein lokal gültiges
 * Token zählt als angemeldet, auch wenn das Backend gerade nicht antwortet.
 * Andernfalls würde ein Netzwerkschluckauf zahlende Kundschaft zur Anmeldung
 * schicken, wo sie längst angemeldet ist.
 */
export default async function CheckoutPage() {
  const cart = await readCartState();

  // Nothing to check out. Bouncing to the shop beats an empty form.
  if (cart.count === 0) redirect("/shop");

  const sessionToken = await readSessionToken();

  if (requiresAccount() && !sessionToken) {
    redirect(`/konto/anmelden?next=${encodeURIComponent("/checkout")}`);
  }

  // Vorausfüllen aus dem Konto — der Zweck der ganzen Kontopflicht. Läuft
  // unabhängig vom Schalter: auch ohne Pflicht profitiert, wer angemeldet ist.
  // Was der Cart schon weiss (halb ausgefüllte Kasse), hat Vorrang.
  let prefillEmail: string | null = null;
  let prefillAddress: CheckoutAddress | null = null;
  if (sessionToken && (!cart.email || !cart.address)) {
    const customer = await getCurrentCustomer();
    if (customer) {
      prefillEmail = customer.email || null;
      const addresses = await getAddresses();
      prefillAddress = pickPrefillAddress(addresses, customer);
    }
  }

  return (
    <CheckoutFlow
      initialCart={cart}
      prefillEmail={prefillEmail}
      prefillAddress={prefillAddress}
    />
  );
}
