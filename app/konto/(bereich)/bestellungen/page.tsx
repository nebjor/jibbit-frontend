import type { Metadata } from "next"
import Link from "next/link"
import { getOrders } from "@/lib/auth/customer"
import { formatMoney } from "@/lib/format"
import { STORE } from "@/lib/config"
import styles from "../../konto.module.css"

export const metadata: Metadata = {
  title: "Bestellungen",
  robots: { index: false, follow: false },
}

/**
 * Medusas Statuswerte sind englische Bezeichner. Die Liste bildet nur ab, was
 * dieser Shop überhaupt erzeugen kann; alles andere wird unübersetzt gezeigt,
 * statt hinter einem falschen deutschen Wort zu verschwinden.
 */
const STATUS_DE: Record<string, string> = {
  pending: "in Bearbeitung",
  completed: "abgeschlossen",
  canceled: "storniert",
  draft: "Entwurf",
  archived: "archiviert",
  requires_action: "Aktion nötig",
  not_paid: "nicht bezahlt",
  awaiting: "Zahlung ausstehend",
  authorized: "autorisiert",
  partially_authorized: "teilweise autorisiert",
  captured: "bezahlt",
  partially_captured: "teilweise bezahlt",
  refunded: "erstattet",
  partially_refunded: "teilweise erstattet",
  not_fulfilled: "noch nicht versandt",
  partially_fulfilled: "teilweise versandt",
  fulfilled: "verpackt",
  partially_shipped: "teilweise unterwegs",
  shipped: "unterwegs",
  delivered: "zugestellt",
  partially_delivered: "teilweise zugestellt",
  partially_returned: "teilweise zurück",
  returned: "zurückgeschickt",
}

function de(status: string): string {
  return STATUS_DE[status] ?? status.replace(/_/g, " ")
}

const datum = new Intl.DateTimeFormat(STORE.locale, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

export default async function BestellungenPage() {
  const orders = await getOrders()

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>Bestellungen</h1>
      </div>

      {orders.length === 0 ? (
        <>
          <p className={styles.lead}>Hier ist noch nichts.</p>
          <p className={styles.footNote}>
            Bestellungen, die du als Gast aufgegeben hast — also ohne angemeldet zu sein —
            erscheinen nicht in dieser Liste. Sie hängen an keinem Konto. Schreib uns über{" "}
            <Link href="/service/kontakt">Kontakt</Link>, wenn du zu einer Gastbestellung
            etwas brauchst.
          </p>
          <p className={styles.footNote}>
            <Link href="/shop">Zum Shop</Link>
          </p>
        </>
      ) : (
        <div className={styles.orders}>
          {orders.map((o) => (
            <article key={o.id} className={styles.order}>
              <div className={styles.orderHead}>
                <span className={styles.orderNo}>Nr. {o.displayId}</span>
                <span className={styles.orderMeta}>
                  {datum.format(new Date(o.createdAt))}
                </span>
              </div>

              <div className={styles.orderStates}>
                <span className={styles.state}>{de(o.status)}</span>
                <span className={styles.state}>Zahlung: {de(o.paymentStatus)}</span>
                <span className={styles.state}>Versand: {de(o.fulfillmentStatus)}</span>
              </div>

              {o.items.length ? (
                <ul className={styles.lines}>
                  {o.items.map((i) => (
                    <li key={i.id} className={styles.line}>
                      <span>
                        <span className="tnum">{i.quantity}</span>&times; {i.title}
                        {i.variantTitle ? ` · ${i.variantTitle}` : ""}
                      </span>
                      <span className="tnum">{formatMoney(i.total, o.currency)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className={styles.orderTotal}>
                <span>Total</span>
                <span className="tnum">{formatMoney(o.total, o.currency)}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
