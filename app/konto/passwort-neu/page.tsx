import type { Metadata } from "next"
import Link from "next/link"
import { PasswordResetForm } from "@/components/account/PasswordResetForm"
import { RESET_LINK_FEHLT } from "@/lib/auth/messages"
import styles from "../konto.module.css"

export const metadata: Metadata = {
  title: "Neues Passwort setzen",
  // Diese Seite trägt ein Token in der Adresse. Sie darf unter keinen
  // Umständen in einen Suchindex geraten — `noindex, nofollow`, und die
  // Formularseite selbst verlinkt auch nichts mit dem Token.
  robots: { index: false, follow: false },
}

export default async function PasswortNeuPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <div className={`page ${styles.wrap} ${styles.narrow}`}>
      <div>
        <h1 className={styles.title}>Neues Passwort setzen</h1>
        <p className={styles.lead}>
          Der Link aus der E-Mail gilt 15 Minuten. Ist er abgelaufen, fordere einfach
          einen neuen an — das geht beliebig oft.
        </p>
      </div>

      {token ? (
        <PasswordResetForm token={token} />
      ) : (
        <>
          <p role="status">{RESET_LINK_FEHLT}</p>
          <p className={styles.footNote}>
            <Link href="/konto/passwort-vergessen">Neuen Link anfordern</Link>
          </p>
        </>
      )}
    </div>
  )
}
