/**
 * Lesen — nicht Prüfen — von Medusas Auth-Token.
 *
 * ⚠️ HIER WIRD NICHTS VERIFIZIERT, UND DAS IST ABSICHT.
 * Die Signatur zu prüfen bräuchte `JWT_SECRET` in der Storefront. Das ist in
 * dieser Architektur genau das falsche Geheimnis am falschen Ort: ein
 * gemeinsam genutztes Storefront-Image bedient viele Mandanten mit je eigenem
 * Backend — es dürfte deren Signierschlüssel gar nicht kennen. Die einzige
 * Instanz, die ein Token beurteilt, ist das jeweilige Medusa-Backend, und es
 * tut das bei JEDEM Aufruf.
 *
 * Was hier gebraucht wird, ist etwas anderes: das Ablaufdatum. Danach richtet
 * sich, wie lange das Cookie gilt und ab wann die Storefront einen Besucher
 * als abgemeldet behandelt, ohne dafür erst das Backend zu fragen. Ein
 * gefälschtes `exp` bringt einem Angreifer nichts — es verlängert nur die
 * Lebensdauer eines Cookies, dessen Inhalt das Backend trotzdem ablehnt.
 *
 * Bewusst ohne `server-only`: reine Funktionen, direkt testbar.
 */

export interface MedusaAuthClaims {
  /** Ablauf, Sekunden seit Epoche. Medusa setzt ihn immer — siehe unten. */
  exp?: number
  iat?: number
  /** Die Kunden-ID. Leer, wenn die Identität an kein Kundenkonto hängt. */
  actor_id?: string
  actor_type?: string
  auth_identity_id?: string
}

/**
 * Dekodiert die Nutzlast. `null` bei allem, was kein wohlgeformtes JWT ist —
 * ein kaputtes Cookie muss "nicht angemeldet" bedeuten und nicht einen
 * Renderfehler.
 */
export function decodeJwtClaims(token: string | undefined | null): MedusaAuthClaims | null {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 3) return null

  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf-8")
    const parsed: unknown = JSON.parse(json)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    return parsed as MedusaAuthClaims
  } catch {
    return null
  }
}

/** Ablaufzeitpunkt in Millisekunden, oder `null`. */
export function getTokenExpiryMs(token: string | undefined | null): number | null {
  const claims = decodeJwtClaims(token)
  const exp = claims?.exp
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= 0) return null
  return exp * 1000
}

/**
 * Sekunden bis zum Ablauf, abgerundet, nie negativ. `null`, wenn kein
 * verwertbares `exp` vorhanden ist.
 */
export function secondsUntilExpiry(
  token: string | undefined | null,
  nowMs: number = Date.now(),
): number | null {
  const expMs = getTokenExpiryMs(token)
  if (expMs === null) return null
  return Math.max(0, Math.floor((expMs - nowMs) / 1000))
}

/**
 * Taugt dieses Token noch als Sitzung?
 *
 * Drei Bedingungen, alle notwendig:
 *
 *  1. `exp` ist vorhanden. Medusas `generateJwtToken` wirft, wenn kein
 *     `expiresIn` gesetzt ist — ein Auth-Token OHNE `exp` kann also von
 *     diesem Backend gar nicht stammen. Es abzulehnen kostet nichts.
 *  2. `exp` liegt in der Zukunft. Das Backend würde es ohnehin ablehnen; es
 *     hier zu erkennen erspart einen sinnlosen Netzwerkweg und lässt die
 *     Seite sofort als abgemeldet rendern.
 *  3. `actor_id` ist gesetzt. Fehlt sie, hängt die Identität an keinem
 *     Kundenkonto — die Anmeldung "gelingt" dann, aber `/store/customers/me`
 *     antwortet mit 401. Genau dieser Zustand entsteht bei einem Import, der
 *     die Verknüpfung `app_metadata.customer_id` vergisst; er darf nicht als
 *     angemeldete Sitzung durchgehen.
 */
export function isUsableSessionToken(
  token: string | undefined | null,
  nowMs: number = Date.now(),
): boolean {
  const claims = decodeJwtClaims(token)
  if (!claims) return false
  if (typeof claims.exp !== "number" || !Number.isFinite(claims.exp)) return false
  if (claims.exp * 1000 <= nowMs) return false
  if (typeof claims.actor_id !== "string" || claims.actor_id.length === 0) return false
  return true
}
