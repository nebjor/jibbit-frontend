import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { RegisterForm } from "@/components/account/RegisterForm"
import { isSafeNextPath } from "@/lib/auth/next-path"
import { readSessionToken } from "@/lib/auth/session"
import { requiresAccount } from "@/lib/checkout/account-requirement"
import styles from "../konto.module.css"

export const metadata: Metadata = {
  title: "Konto anlegen",
  robots: { index: false, follow: true },
}

export default async function RegistrierenPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams
  // Nur relative Ziele weiterreichen — die Action prüft es noch einmal.
  const next = isSafeNextPath(params.next) ? params.next : undefined

  if (await readSessionToken()) redirect(next ?? "/konto")

  // Aus der Kasse hergeschickt? Dann ist das kein Umweg, sondern der Weg.
  const ausDerKasse = next?.startsWith("/checkout") === true

  return (
    <div className={`page ${styles.wrap} ${styles.narrow}`}>
      <div>
        <h1 className={styles.title}>Konto anlegen</h1>
        <p className={styles.lead}>
          {ausDerKasse
            ? "Konto anlegen und direkt weiterbestellen — dein Warenkorb bleibt, wie er ist. Beim nächsten Mal ist die Adresse dann schon ausgefüllt."
            : requiresAccount()
              ? "Zum Bestellen brauchst du ein Konto — dafür musst du deine Adresse nur einmal eintippen, und du findest jede Bestellung hier wieder."
              : "Damit du deine Bestellungen wiederfindest und beim nächsten Mal nicht alles neu tippen musst. Für eine Bestellung ist ein Konto nicht nötig."}
        </p>
      </div>

      <RegisterForm next={next} />

      <p className={styles.footNote}>
        Wir speichern nur, was für Bestellung und Versand nötig ist. Was genau, steht in
        der <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>

      <p className={styles.footNote}>
        Schon ein Konto?{" "}
        <Link
          href={
            next
              ? `/konto/anmelden?next=${encodeURIComponent(next)}`
              : "/konto/anmelden"
          }
        >
          Hier anmelden.
        </Link>
      </p>
    </div>
  )
}
