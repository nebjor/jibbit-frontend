import "server-only"

import type Medusa from "@medusajs/js-sdk"
import { getSdkForTenant, isBackendConfigured } from "@/lib/medusa"
import { getTenantContext } from "@/lib/tenant/context"
import type { TenantConfig } from "@/lib/tenant/types"
import { toAddressView, toCustomerView, toOrderView } from "./adapters"
import { bearer, readSessionToken } from "./session"
import type { AddressView, CustomerView, OrderView } from "./types"

/**
 * Lesezugriffe auf das eigene Konto — der einzige Weg, auf dem Seiten an
 * Kundendaten kommen.
 *
 * ZWEI REGELN, DIE HIER GELTEN
 *
 * 1. Kein Fallback auf Platzhalterdaten. `lib/data.ts` fällt für den Katalog
 *    bewusst auf den Mock-Katalog zurück, damit `next build` grün bleibt.
 *    Für ein Kundenkonto wäre das falsch: erfundene Bestellungen anzuzeigen
 *    ist schlimmer, als gar nichts anzuzeigen. Ist das Backend weg, gibt es
 *    `null` bzw. eine leere Liste, und die Seite sagt das auch.
 *
 * 2. Das Token wird PRO AUFRUF als Header übergeben. Der SDK-Client ist pro
 *    Mandant memoisiert und wird von allen gleichzeitigen Anfragen geteilt;
 *    ein am Client hinterlegtes Token (`sdk.auth.login()`, `client.setToken()`)
 *    wäre das Token, das der nächste fremde Request mitbekommt.
 */

interface Session {
  tenant: TenantConfig
  sdk: Medusa
  token: string
}

/** Auflösung von Mandant, Client und Sitzung — oder `null`, wenn abgemeldet. */
async function resolveSession(): Promise<Session | null> {
  const token = await readSessionToken()
  if (!token) return null

  const tenant = await getTenantContext()
  if (!isBackendConfigured(tenant)) return null

  return { tenant, sdk: getSdkForTenant(tenant), token }
}

/**
 * Meldet einen Fehler, ohne dabei Personendaten oder das Token zu
 * protokollieren. `err.message` aus dem SDK enthält die Medusa-Meldung, aber
 * weder Header noch Body — der Aufrufpfad steht im Klartext dabei, damit ein
 * Fehler zuordenbar bleibt.
 */
function warn(tenantId: string, where: string, err: unknown) {
  console.warn(
    `[konto:${tenantId}] ${where} fehlgeschlagen: ${
      err instanceof Error ? err.message : "unbekannter Fehler"
    }`,
  )
}

/** Das eigene Kundenkonto, oder `null` wenn nicht (mehr) angemeldet. */
export async function getCurrentCustomer(): Promise<CustomerView | null> {
  const session = await resolveSession()
  if (!session) return null

  try {
    const { customer } = await session.sdk.store.customer.retrieve(
      { fields: "id,email,first_name,last_name,phone,company_name,metadata" },
      bearer(session.token),
    )
    return customer ? toCustomerView(customer) : null
  } catch (err) {
    // 401 heisst hier: Token abgelaufen oder Konto entfernt. Beides ist
    // "nicht angemeldet" und kein Fehler, den die Seite anzeigen müsste.
    warn(session.tenant.id, "customer.retrieve", err)
    return null
  }
}

export async function getAddresses(): Promise<AddressView[]> {
  const session = await resolveSession()
  if (!session) return []

  try {
    const { addresses } = await session.sdk.store.customer.listAddress(
      { limit: 50 },
      bearer(session.token),
    )
    return (addresses ?? []).map(toAddressView)
  } catch (err) {
    warn(session.tenant.id, "customer.listAddress", err)
    return []
  }
}

/**
 * Die eigenen Bestellungen.
 *
 * ANNAHME, DIE HIER GETROFFEN WIRD: Bestellungen entstehen mit gesetzter
 * `customer_id`. `/store/orders` filtert serverseitig auf die `actor_id` aus
 * dem Token — eine Bestellung ohne diese Verknüpfung taucht hier nie auf.
 *
 * Für Gastbestellungen ist das richtig so und auch nicht anders möglich: sie
 * gehören per Definition zu keinem Konto. Wer als Gast bestellt und sich
 * später registriert, sieht die alte Bestellung deshalb NICHT in dieser Liste.
 * Medusa hat dafür `POST /store/orders/:id/transfer/request` — das gehört zur
 * Kassenstrecke und ist hier bewusst nicht gebaut, siehe PR.
 */
export async function getOrders(limit = 20): Promise<OrderView[]> {
  const session = await resolveSession()
  if (!session) return []

  try {
    const { orders } = await session.sdk.store.order.list(
      {
        limit,
        order: "-created_at",
        fields:
          "id,display_id,status,payment_status,fulfillment_status,currency_code,total,created_at,*items",
      },
      bearer(session.token),
    )
    return (orders ?? []).map(toOrderView)
  } catch (err) {
    warn(session.tenant.id, "order.list", err)
    return []
  }
}
