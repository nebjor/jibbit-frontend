import "server-only"

import { cookies } from "next/headers"
import { isUsableSessionToken, secondsUntilExpiry } from "./jwt"

/**
 * Die Sitzung — ein httpOnly-Cookie, das nie im Browser lesbar ist.
 *
 * WARUM NICHT localStorage
 * Medusas JS-SDK legt sein Token per Voreinstellung in `localStorage`. Damit
 * kann jedes Script auf der Seite es auslesen; ein einziger XSS reicht, um
 * fremde Konten zu übernehmen, und Content-Security-Policy hilft dagegen nur
 * so weit, wie sie lückenlos ist. Das Token bleibt hier stattdessen komplett
 * auf dem Server: es geht als httpOnly-Cookie an den Browser, kommt bei jedem
 * Request zurück, und nur der Server hängt es an die Aufrufe ans Backend. Im
 * Browser-Bundle steht es nie.
 *
 * WARUM KEIN `domain`-ATTRIBUT
 * Ohne `domain` ist das Cookie host-only: `shop-a.jibbit.app` bekommt es
 * zurück, `shop-b.jibbit.app` nicht. Mit `domain=.jibbit.app` würde jeder
 * Mandant die Sitzungen aller anderen mitgeschickt bekommen — bei einem
 * gemeinsam genutzten Image der direkte Weg zum mandantenübergreifenden
 * Kontozugriff. Das Attribut fehlt hier absichtlich; wer es ergänzt, hebt die
 * Trennung auf, die `proxy.ts` und `lib/medusa.ts` mühsam herstellen.
 */

export const SESSION_COOKIE = "jb_session"

/**
 * `secure` nur ausserhalb der Entwicklung: unter `http://localhost` würde ein
 * Secure-Cookie vom Browser verworfen, und niemand könnte sich lokal anmelden.
 */
const secureCookies = process.env.NODE_ENV === "production"

/**
 * `lax` statt `strict`: Bei `strict` schickt der Browser das Cookie nicht mit,
 * wenn jemand von aussen auf die Seite kommt — der Klick aus der
 * Bestellbestätigungs-E-Mail landete dann auf einer Seite, die einen
 * angemeldeten Menschen als Gast begrüsst. `lax` schickt es bei normalen
 * Navigationen mit und bei fremden POSTs nicht, was der CSRF-Fall ist, auf den
 * es ankommt. Next prüft bei Server Actions zusätzlich `Origin` gegen `Host`.
 */
const SAME_SITE = "lax" as const

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  // Ein abgelaufenes Cookie ist dasselbe wie keines. Es hier abzufangen spart
  // einen 401 vom Backend und lässt die Seite direkt als abgemeldet rendern.
  if (!isUsableSessionToken(token)) return null
  return token
}

/**
 * Setzt das Sitzungscookie. Nur aus einer Server Action oder einem Route
 * Handler aufrufbar — beim Rendern eines Server Components sind die Header
 * schon unterwegs.
 */
export async function writeSessionToken(token: string): Promise<void> {
  const store = await cookies()
  // Die Lebensdauer des Cookies folgt dem Token, nicht einer eigenen Zahl.
  // Wäre das Cookie länger gültig, sähe die Storefront einen angemeldeten
  // Besucher, dessen Aufrufe das Backend längst mit 401 beantwortet.
  const maxAge = secondsUntilExpiry(token)

  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: SAME_SITE,
    path: "/",
    // Kein `domain` — siehe Kommentar oben.
    ...(maxAge !== null ? { maxAge } : {}),
  })
}

export async function clearSession(): Promise<void> {
  const store = await cookies()
  // `delete` allein reicht nicht in jedem Fall: Next setzt dabei kein
  // ausdrückliches Ablaufdatum für ein Cookie, dessen Attribute abweichen.
  // Ein leerer Wert mit maxAge 0 und denselben Attributen räumt sicher ab.
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: secureCookies,
    sameSite: SAME_SITE,
    path: "/",
    maxAge: 0,
  })
}

/**
 * Der Authorization-Header für einen Aufruf ans Backend.
 *
 * ⚠️ Immer PRO AUFRUF übergeben, nie am SDK-Client hinterlegen. Der Client aus
 * `lib/medusa.ts` ist pro Mandant memoisiert und wird von allen gleichzeitigen
 * Anfragen geteilt — ein dort gesetztes Token wäre das Token, das die nächste
 * fremde Anfrage mitbekommt. Deshalb ruft dieses Projekt auch nie
 * `sdk.auth.login()` auf: die Methode legt das Token intern im Client ab.
 */
export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` }
}
