/**
 * Sichtbare Kontodaten — dieselbe Trennung wie in `lib/types.ts`:
 * Komponenten lesen NIE eine rohe Medusa-Entität.
 *
 * DATENSPARSAMKEIT (DSG Art. 6): hier steht bewusst nur, was eine Seite auch
 * wirklich anzeigt. Medusas `StoreCustomer` bringt unter anderem
 * `created_by`, `deleted_at` und beliebige `metadata` mit; nichts davon geht
 * die Storefront etwas an, und was nicht durch den Adapter kommt, kann auch
 * nicht versehentlich in einer Server-Action-Antwort im Browser landen.
 */

export interface CustomerView {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string
  companyName: string
  /** Aus dem Odoo-Import übernommen. Nur für den Hinweis im Kontobereich. */
  importedFromOdoo: boolean
}

export interface AddressView {
  id: string
  /** Frei wählbarer Name der Adresse, z.B. "Zuhause". */
  label: string
  firstName: string
  lastName: string
  company: string
  address1: string
  address2: string
  postalCode: string
  city: string
  /** ISO-3166-1 alpha-2, klein. "ch", "li", "de". */
  countryCode: string
  phone: string
  isDefaultShipping: boolean
  isDefaultBilling: boolean
}

export interface OrderLineView {
  id: string
  title: string
  variantTitle: string
  quantity: number
  /** Dezimalbetrag, wie überall in Medusa v2 — nie durch 100 teilen. */
  total: number
}

export interface OrderView {
  id: string
  /** Die Nummer, die auch auf der Rechnung steht. */
  displayId: string
  /** ISO-Zeitstempel; formatiert wird erst in der Komponente. */
  createdAt: string
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  /** Abholung im Laden statt Versand (lib/checkout/pickup.ts). */
  pickup: boolean
  currency: string
  total: number
  items: OrderLineView[]
}

/** Rückgabe jeder Server Action in diesem Bereich. */
export interface FormState {
  /** `null` = noch nichts abgeschickt. */
  ok: boolean | null
  message?: string
  /** Feldname -> Meldung. Nur für Eingaben, die der Browser nicht abfängt. */
  fieldErrors?: Record<string, string>
}

export const IDLE_FORM_STATE: FormState = { ok: null }
