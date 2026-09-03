/**
 * Verbindung Kasse ↔ Kundenkonto — server-only.
 *
 * Zwei Aufgaben, beide aus `saveContactAndAddress` heraus aufgerufen:
 *
 *   1. `attachCartToCustomer` — der Warenkorb bekommt die `customer_id` der
 *      Sitzung (`POST /store/carts/:id/customer`). Erst dadurch taucht die
 *      spätere Bestellung unter /konto/bestellungen auf: `/store/orders`
 *      filtert serverseitig auf die `actor_id` aus dem Token.
 *
 *   2. `saveAddressToAccount` — die Lieferadresse wandert ins Adressbuch,
 *      damit die nächste Bestellung sie kennt (das Vorausfüllen in
 *      `lib/checkout/prefill.ts` liest sie dort wieder heraus).
 *
 * ⚠️ BEIDE FUNKTIONEN DÜRFEN DIE KASSE NIE ANHALTEN. Sie sind Komfort, nicht
 * Voraussetzung: eine Bestellung, die scheitert, weil das Adressbuch gerade
 * nicht schreibbar war, wäre ein Eigentor. Jeder Fehler wird geschluckt und
 * ohne Personendaten protokolliert.
 *
 * Das Token wird PRO AUFRUF als Header übergeben — nie am memoisierten
 * SDK-Client hinterlegen, siehe lib/auth/session.ts.
 */

import "server-only"

import type Medusa from "@medusajs/js-sdk"
import type { HttpTypes } from "@medusajs/types"
import { toAddressView } from "@/lib/auth/adapters"
import { decodeJwtClaims } from "@/lib/auth/jwt"
import { bearer } from "@/lib/auth/session"
import type { CheckoutAddress } from "@/lib/cart/types"
import { findMatchingAddress } from "./prefill"

/** Wie `lib/auth/customer.ts`: Fehlerort ja, Personendaten und Token nie. */
function warn(where: string, err: unknown) {
  console.warn(
    `[checkout:konto] ${where} fehlgeschlagen: ${
      err instanceof Error ? err.message : "unbekannter Fehler"
    }`,
  )
}

/**
 * Ordnet den Warenkorb dem angemeldeten Konto zu, falls (noch) nicht
 * geschehen. Idempotent gedacht: gehört der Cart schon dieser Kundin, passiert
 * nichts; gehört er einem ANDEREN Konto (geteilter Browser, Abmelden und neu
 * Anmelden), versucht die Übertragung es trotzdem — Medusa entscheidet, ob
 * das zulässig ist.
 */
export async function attachCartToCustomer(
  sdk: Medusa,
  // Medusas Typ sagt `string | undefined`, die API liefert praktisch auch
  // `null` — beides heisst hier dasselbe: noch keinem Konto zugeordnet.
  cart: Pick<HttpTypes.StoreCart, "id"> & { customer_id?: string | null },
  token: string,
): Promise<void> {
  const actorId = decodeJwtClaims(token)?.actor_id
  if (actorId && cart.customer_id === actorId) return

  try {
    await sdk.store.cart.transferCart(cart.id, {}, bearer(token))
  } catch (err) {
    // Nicht fatal: die Bestellung geht auch ohne Zuordnung durch — sie fehlt
    // dann nur in der Kontoübersicht. Siehe Kopfkommentar.
    warn("cart.transfer", err)
  }
}

/**
 * Sichert die Lieferadresse im Adressbuch des Kontos.
 *
 * Kein Duplikat, wenn dieselbe Adresse (Name, Strasse, PLZ, Ort, Land) schon
 * da ist. Die erste Adresse überhaupt wird Standard-Lieferadresse, damit das
 * Vorausfüllen sie beim nächsten Mal eindeutig findet.
 */
export async function saveAddressToAccount(
  sdk: Medusa,
  token: string,
  address: CheckoutAddress,
): Promise<void> {
  try {
    const { addresses } = await sdk.store.customer.listAddress(
      { limit: 50 },
      bearer(token),
    )
    const existing = (addresses ?? []).map(toAddressView)

    if (findMatchingAddress(existing, address)) return

    await sdk.store.customer.createAddress(
      {
        first_name: address.firstName,
        last_name: address.lastName,
        company: address.company || undefined,
        address_1: address.address1,
        address_2: address.address2 || undefined,
        postal_code: address.postalCode,
        city: address.city,
        country_code: address.countryCode,
        phone: address.phone || undefined,
        is_default_shipping: existing.length === 0,
        is_default_billing: existing.length === 0,
      },
      {},
      bearer(token),
    )
  } catch (err) {
    warn("adresse.sichern", err)
  }
}
