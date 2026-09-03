import Link from "next/link"
import { redirect } from "next/navigation"
import { LogoutForm } from "@/components/account/AccountActions"
import { readSessionToken } from "@/lib/auth/session"
import styles from "../konto.module.css"

/**
 * Der Zaun um den Kontobereich.
 *
 * WARUM HIER UND NICHT IN `proxy.ts`
 * Der Proxy löst für JEDE Anfrage den Mandanten auf und ist ausdrücklich nicht
 * der Ort für Logik ("not intended for slow data fetching", siehe die
 * Kommentare dort). Die Absicherung endet deshalb an dieser Route-Gruppe.
 * Ob auch die KASSE eine Anmeldung verlangt, entscheidet nicht dieser Zaun,
 * sondern der Schalter in `lib/checkout/account-requirement.ts` — geprüft in
 * `app/checkout/page.tsx`, mit Rückweg über `?next=/checkout`.
 *
 * Der Layout-Check ist die Bequemlichkeit für den Menschen davor, nicht die
 * Sicherheitsgrenze. Die liegt in jeder einzelnen Server Action (jede prüft
 * `readSessionToken()` selbst) und letztlich im Backend, das jedes Token bei
 * jedem Aufruf prüft. Ein gerendertes Layout ist keine Zugriffskontrolle.
 */
export default async function KontoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await readSessionToken())) {
    redirect("/konto/anmelden")
  }

  return (
    <div className={`page ${styles.shell}`}>
      <nav className={styles.nav} aria-label="Kontobereich">
        <Link href="/konto">Übersicht</Link>
        <Link href="/konto/bestellungen">Bestellungen</Link>
        <Link href="/konto/adressen">Adressen</Link>
        <Link href="/konto/profil">Profil</Link>
      </nav>

      {children}

      <div>
        <LogoutForm />
      </div>
    </div>
  )
}
