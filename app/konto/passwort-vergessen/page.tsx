import type { Metadata } from "next"
import Link from "next/link"
import { PasswordForgotForm } from "@/components/account/PasswordForgotForm"
import styles from "../konto.module.css"

export const metadata: Metadata = {
  title: "Passwort vergessen",
  robots: { index: false, follow: true },
}

export default function PasswortVergessenPage() {
  return (
    <div className={`page ${styles.wrap} ${styles.narrow}`}>
      <div>
        <h1 className={styles.title}>Passwort vergessen</h1>
        <p className={styles.lead}>
          Gib deine E-Mail-Adresse an. Wenn dazu ein Konto besteht, schicken wir dir
          einen Link, mit dem du ein neues Passwort setzen kannst.
        </p>
      </div>

      <PasswordForgotForm />

      <p className={styles.footNote}>
        <strong>Aus unserem früheren Shop?</strong> Dann ist das hier dein Weg: dein Konto
        ist mitgezogen, dein Passwort konnte es technisch nicht — die beiden Systeme
        verschlüsseln Passwörter unterschiedlich, und aus dem einen lässt sich das andere
        nicht herstellen. Einmal neu setzen, danach ist alles wie vorher.
      </p>

      <p className={styles.footNote}>
        <Link href="/konto/anmelden">Zurück zur Anmeldung</Link>
      </p>
    </div>
  )
}
