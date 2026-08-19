import type { Metadata } from "next"
import { AddressBook } from "@/components/account/AddressBook"
import { getAddresses } from "@/lib/auth/customer"
import styles from "../../konto.module.css"

export const metadata: Metadata = {
  title: "Adressen",
  robots: { index: false, follow: false },
}

export default async function AdressenPage() {
  const addresses = await getAddresses()

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>Adressen</h1>
      </div>

      <p className={styles.lead}>
        Gespeicherte Adressen ersparen dir das Tippen beim Bestellen. Du musst hier
        nichts hinterlegen — beim Bestellen lässt sich jede Adresse auch direkt eingeben.
      </p>

      <AddressBook addresses={addresses} />
    </>
  )
}
