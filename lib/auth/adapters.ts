import type {
  StoreCustomer,
  StoreCustomerAddress,
  StoreOrder,
} from "@medusajs/types"
import type { AddressView, CustomerView, OrderView } from "./types"

/**
 * ADAPTER — Medusa-Entitäten aus dem Kontobereich zu Sichttypen.
 *
 * Gleiche Rolle wie `lib/adapters.ts` für den Katalog, nur getrennt gehalten:
 * dort geht es um Produkte, hier um Personendaten. Alles, was diese Funktionen
 * nicht abbilden, kann nicht ins Browser-Bundle rutschen.
 */

export function toCustomerView(c: StoreCustomer): CustomerView {
  return {
    id: c.id,
    email: c.email ?? "",
    firstName: c.first_name ?? "",
    lastName: c.last_name ?? "",
    phone: c.phone ?? "",
    companyName: c.company_name ?? "",
    importedFromOdoo: c.metadata?.imported_from === "odoo",
  }
}

export function toAddressView(a: StoreCustomerAddress): AddressView {
  return {
    id: a.id,
    label: a.address_name ?? "",
    firstName: a.first_name ?? "",
    lastName: a.last_name ?? "",
    company: a.company ?? "",
    address1: a.address_1 ?? "",
    address2: a.address_2 ?? "",
    postalCode: a.postal_code ?? "",
    city: a.city ?? "",
    countryCode: (a.country_code ?? "ch").toLowerCase(),
    phone: a.phone ?? "",
    isDefaultShipping: Boolean(a.is_default_shipping),
    isDefaultBilling: Boolean(a.is_default_billing),
  }
}

export function toOrderView(o: StoreOrder): OrderView {
  return {
    id: o.id,
    // `display_id` ist die kurze, für Menschen gedachte Nummer. Sie kann
    // fehlen, wenn `fields` sie nicht anfordert — dann bleibt die lange ID,
    // damit im Support überhaupt etwas nennbar ist.
    displayId: o.display_id != null ? String(o.display_id) : o.id,
    createdAt:
      typeof o.created_at === "string" ? o.created_at : o.created_at.toISOString(),
    status: o.status ?? "",
    paymentStatus: o.payment_status ?? "",
    fulfillmentStatus: o.fulfillment_status ?? "",
    currency: (o.currency_code ?? "chf").toUpperCase(),
    total: o.total ?? 0,
    items: (o.items ?? []).map((i) => ({
      id: i.id,
      title: i.product_title ?? i.title ?? "",
      // Bei einer Variante namens "Standard" wäre die Zeile "Produkt ·
      // Standard" — die zweite Hälfte trägt nichts bei.
      variantTitle: i.variant_title && i.variant_title !== i.title ? i.variant_title : "",
      quantity: i.quantity ?? 0,
      total: i.total ?? 0,
    })),
  }
}
