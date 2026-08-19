import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { ChangePasswordForm } from "@/components/account/AccountActions"
import { ProfileForm } from "@/components/account/ProfileForm"
import { getCurrentCustomer } from "@/lib/auth/customer"
import styles from "../../konto.module.css"

export const metadata: Metadata = {
  title: "Profil",
  robots: { index: false, follow: false },
}

export default async function ProfilPage() {
  const customer = await getCurrentCustomer()
  if (!customer) redirect("/konto/anmelden")

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>Profil</h1>
      </div>

      <div className={styles.panel}>
        <ProfileForm customer={customer} />
      </div>

      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>Passwort</h2>
        <ChangePasswordForm />
      </div>

      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>Konto löschen</h2>
        <p className={styles.footNote}>
          Du kannst dein Konto löschen lassen. Schreib uns dazu kurz über{" "}
          <a href="/service/kontakt">Kontakt</a> — wir melden uns und bestätigen dir die
          Löschung. Bestellungen bleiben davon unberührt: sie unterliegen der
          zehnjährigen Aufbewahrungspflicht nach Art. 958f OR und lassen sich nicht auf
          Zuruf entfernen.
        </p>
      </div>
    </>
  )
}
