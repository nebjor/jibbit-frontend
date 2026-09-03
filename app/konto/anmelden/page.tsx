import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/account/LoginForm"
import { PASSWORT_GESETZT } from "@/lib/auth/messages"
import { isSafeNextPath } from "@/lib/auth/next-path"
import { readSessionToken } from "@/lib/auth/session"
import { requiresAccount } from "@/lib/checkout/account-requirement"
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
  const params = await searchParams
  // Nur relative Ziele weiterreichen — die Action prüft es noch einmal, aber
  // ein absoluter Wert soll gar nicht erst im Formular stehen.
  const next = isSafeNextPath(params.next) ? params.next : undefined

  // Wer schon angemeldet ist, soll hier nicht landen — und wer mit einem Ziel
  // kam (etwa aus der Kasse), direkt dort weitermachen statt im Kontobereich.
  if (await readSessionToken()) redirect(next ?? "/konto")

  // Aus der Kasse hergeschickt? Dann sag, warum — und dass nichts verloren geht.
  const ausDerKasse = next?.startsWith("/checkout") === true

  return (
    <div className={`page ${styles.wrap} ${styles.narrow}`}>
      <div>
        <h1 className={styles.title}>Anmelden</h1>
        <p className={styles.lead}>
          {ausDerKasse
            ? "Zum Bestellen brauchst du ein Konto. Melde dich an — dein Warenkorb bleibt, wie er ist, und du kommst direkt zur Kasse zurück."
            : requiresAccount()
              ? "Bestellungen aufgeben und nachschauen, Adressen verwalten."
              : "Bestellungen nachschauen, Adressen verwalten. Bestellen geht auch ohne Konto."}
        </p>
      </div>

      {params.gesetzt === "1" ? (
        <p className={styles.footNote} role="status">
          {PASSWORT_GESETZT}
        </p>
      ) : null}

      <LoginForm next={next} />

      <p className={styles.footNote}>
        Noch kein Konto?{" "}
        <Link
          href={
            next
              ? `/konto/registrieren?next=${encodeURIComponent(next)}`
              : "/konto/registrieren"
          }
        >
          Jetzt eines anlegen.
        </Link>
      </p>
    </div>
  )
}
