import Link from "next/link"
import { readSessionToken } from "@/lib/auth/session"
import styles from "./AccountLink.module.css"

/**
 * Kopfzeile: "Anmelden" oder "Konto".
 *
 * Absichtlich ein Server Component und absichtlich OHNE Backend-Aufruf: die
 * Frage "angemeldet oder nicht" beantwortet das Cookie allein. Ein
 * `/store/customers/me` an dieser Stelle hinge an jeder einzelnen Seite des
 * Shops — auch an denen, die mit Konten nichts zu tun haben.
 *
 * Der Preis dafür: kurz nach Ablauf des Tokens könnte hier "Konto" stehen,
 * obwohl die Sitzung schon tot ist. Kann nicht passieren — `readSessionToken`
 * prüft `exp` selbst und liefert dann null.
 */
export async function AccountLink() {
  const token = await readSessionToken()

  return token ? (
    <Link href="/konto" className={styles.link}>
      Konto
    </Link>
  ) : (
    <Link href="/konto/anmelden" className={styles.link}>
      Anmelden
    </Link>
  )
}
