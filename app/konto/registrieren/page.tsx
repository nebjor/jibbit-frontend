import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { RegisterForm } from "@/components/account/RegisterForm"
import { readSessionToken } from "@/lib/auth/session"
import styles from "../konto.module.css"

export const metadata: Metadata = {
  title: "Konto anlegen",
  robots: { index: false, follow: true },
}

export default async function RegistrierenPage() {
  if (await readSessionToken()) redirect("/konto")

  return (
    <div className={`page ${styles.wrap} ${styles.narrow}`}>
      <div>
        <h1 className={styles.title}>Konto anlegen</h1>
        <p className={styles.lead}>
          Damit du deine Bestellungen wiederfindest und beim nächsten Mal nicht alles
          neu tippen musst. Für eine Bestellung ist ein Konto nicht nötig.
        </p>
      </div>

      <RegisterForm />

      <p className={styles.footNote}>
        Wir speichern nur, was für Bestellung und Versand nötig ist. Was genau, steht in
        der <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>

      <p className={styles.footNote}>
        Schon ein Konto? <Link href="/konto/anmelden">Hier anmelden.</Link>
      </p>
    </div>
  )
}
