/**
 * Vorausfüllen des Adressschritts aus dem Kundenkonto — der eigentliche Zweck
 * der Kontopflicht. Wer angemeldet ist und eine Adresse hinterlegt hat, soll
 * die Kasse ausgefüllt vorfinden.
 *
 * Reine Funktionen ohne `server-only`: die Auswahl-Logik ist direkt testbar,
 * geladen werden die Daten in `app/checkout/page.tsx`.
 */

import type { AddressView, CustomerView } from "@/lib/auth/types"
import type { CheckoutAddress } from "@/lib/cart/types"
import { SUPPORTED_COUNTRIES } from "./address"

/** Namens-Fallback, wenn die Adresse selbst keinen Namen trägt. */
interface NameFallback {
  firstName?: string
  lastName?: string
  phone?: string
}

/** Konto-Adresse -> Kassen-Adresse, Lücken aus dem Profil aufgefüllt. */
export function toCheckoutAddress(
  view: AddressView,
  fallback: NameFallback = {},
): CheckoutAddress {
  return {
    firstName: view.firstName || fallback.firstName || "",
    lastName: view.lastName || fallback.lastName || "",
    company: view.company || undefined,
    address1: view.address1,
    address2: view.address2 || undefined,
    postalCode: view.postalCode,
    city: view.city,
    countryCode: view.countryCode,
    phone: view.phone || fallback.phone || undefined,
  }
}

function deliverable(view: AddressView): boolean {
  return SUPPORTED_COUNTRIES.some((c) => c.code === view.countryCode)
}

/**
 * Welche Konto-Adresse in die Kasse gehört: die Standard-Lieferadresse, sonst
 * die erste, an die der Shop überhaupt liefern kann. `null`, wenn es keine
 * gibt — dann bleibt das Formular leer, wie bisher.
 *
 * Adressen ausserhalb des Liefergebiets (z. B. "de" aus dem Odoo-Import)
 * werden übersprungen: sie vorzuschlagen hiesse, ein Formular vorzufüllen,
 * das sich so nicht abschicken lässt.
 */
export function pickPrefillAddress(
  addresses: readonly AddressView[],
  customer?: CustomerView | null,
): CheckoutAddress | null {
  const candidates = addresses.filter(deliverable)
  const chosen = candidates.find((a) => a.isDefaultShipping) ?? candidates[0]
  if (!chosen) return null
  return toCheckoutAddress(chosen, {
    firstName: customer?.firstName,
    lastName: customer?.lastName,
    phone: customer?.phone,
  })
}

const fold = (value: string | undefined) => (value ?? "").trim().toLowerCase()

/**
 * Gibt es diese Lieferadresse im Konto schon? Verglichen wird, was einen
 * Umschlag adressiert: Name, Strasse, PLZ, Ort, Land. Telefon und Firma
 * unterscheiden keine Lieferadresse — wer nur die Telefonnummer ändert, soll
 * keinen Duplikat-Eintrag im Adressbuch erzeugen.
 */
export function findMatchingAddress(
  addresses: readonly AddressView[],
  address: CheckoutAddress,
): AddressView | undefined {
  return addresses.find(
    (a) =>
      fold(a.firstName) === fold(address.firstName) &&
      fold(a.lastName) === fold(address.lastName) &&
      fold(a.address1) === fold(address.address1) &&
      fold(a.address2) === fold(address.address2) &&
      fold(a.postalCode) === fold(address.postalCode) &&
      fold(a.city) === fold(address.city) &&
      fold(a.countryCode) === fold(address.countryCode),
  )
}
