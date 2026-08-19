import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentCustomer } from "@/lib/auth/customer"
import styles from "../konto.module.css"

export const metadata: Metadata = {
  title: "Konto",
  robots: { index: false, follow: false },
}

export default async function KontoUebersicht() {
  const customer = await getCurrentCustomer()
  // Cookie da, Backend sagt aber "kennt dich nicht": Token abgelaufen oder
  // Konto entfernt. Zurück zur Anmeldung, statt eine halbe Seite zu zeigen.
  if (!customer) redirect("/konto/anmelden")

  const name = customer.firstName || customer.email

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>Hallo {name}</h1>
      </div>

      {customer.importedFromOdoo ? (
        <p className={styles.lead}>
          Dein Konto stammt aus unserem früheren Shop. Deine Angaben sind mitgezogen,
          deine Bestellungen von damals liegen aber weiterhin dort — hier siehst du alles
          ab dem Umzug.
        </p>
      ) : null}

      <div className={styles.tiles}>
        <Link href="/konto/bestellungen" className={styles.tile}>
          <span className={styles.tileTitle}>Bestellungen</span>
          <span className={styles.tileText}>Was du bestellt hast und wo es steht.</span>
        </Link>
        <Link href="/konto/adressen" className={styles.tile}>
          <span className={styles.tileTitle}>Adressen</span>
          <span className={styles.tileText}>
            Liefer- und Rechnungsadressen für die nächste Bestellung.
          </span>
        </Link>
        <Link href="/konto/profil" className={styles.tile}>
          <span className={styles.tileTitle}>Profil</span>
          <span className={styles.tileText}>Name, Telefon, Passwort.</span>
        </Link>
      </div>
    </>
  )
}
