import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/account/LoginForm"
import { PASSWORT_GESETZT } from "@/lib/auth/messages"
import { readSessionToken } from "@/lib/auth/session"
import styles from "../konto.module.css"

export const metadata: Metadata = {
  title: "Anmelden",
  // Anmeldeseiten gehören nicht in den Index — sie haben keinen Inhalt, den
  // jemand sucht, und tauchen sonst als Treffer für den Markennamen auf.
  robots: { index: false, follow: true },
}

export default async function AnmeldenPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; gesetzt?: string }>
}) {
  // Wer schon angemeldet ist, soll hier nicht landen.
  if (await readSessionToken()) redirect("/konto")

  const params = await searchParams
  // Nur relative Ziele weiterreichen — die Action prüft es noch einmal, aber
  // ein absoluter Wert soll gar nicht erst im Formular stehen.
  const next =
    params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : undefined

  return (
    <div className={`page ${styles.wrap} ${styles.narrow}`}>
      <div>
        <h1 className={styles.title}>Anmelden</h1>
        <p className={styles.lead}>
          Bestellungen nachschauen, Adressen verwalten. Bestellen geht auch ohne Konto.
        </p>
      </div>

      {params.gesetzt === "1" ? (
        <p className={styles.footNote} role="status">
          {PASSWORT_GESETZT}
        </p>
      ) : null}

      <LoginForm next={next} />

      <p className={styles.footNote}>
        Noch kein Konto? <Link href="/konto/registrieren">Jetzt eines anlegen.</Link>
      </p>
    </div>
  )
}
