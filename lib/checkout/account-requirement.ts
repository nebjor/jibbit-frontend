/**
 * KONTOPFLICHT AN DER KASSE — der eine Schalter.
 *
 * Der Betreiber will, dass Bestellungen nur mit Kundenkonto möglich sind,
 * damit niemand die Adressdaten bei jeder Bestellung neu eintippt. Dieser
 * Schalter ist bewusst die EINZIGE Stelle, an der das entschieden wird —
 * alles andere (Zugangsprüfung in `app/checkout/page.tsx`, die Texte auf den
 * Anmelde-/Registrierungsseiten, der Absatz in der Datenschutzerklärung)
 * fragt hier nach.
 *
 * ══ SO SCHALTET MAN DIE PFLICHT AB ════════════════════════════════════════
 *
 *   1. Umgebungsvariable (ohne Codeänderung):
 *        CHECKOUT_REQUIRE_ACCOUNT=false   → Gastbestellung wieder möglich
 *        CHECKOUT_REQUIRE_ACCOUNT=true    → Kontopflicht erzwungen
 *      Akzeptiert werden auch 0/1, off/on, nein/ja.
 *
 *   2. Oder die Konstante REQUIRE_ACCOUNT_DEFAULT unten umstellen — sie gilt,
 *      wenn die Umgebungsvariable fehlt oder keinen der Werte oben trägt.
 *
 * Alle betroffenen Seiten rendern in diesem Projekt dynamisch (der
 * Mandanten-Proxy erzwingt das ohnehin) — ein Neustart des Prozesses mit der
 * neuen Umgebungsvariable genügt, ein neuer Build ist nicht nötig. Damit
 * stellen Kasse, Anmeldetexte und Datenschutzerklärung gemeinsam um.
 *
 * Bewusst ohne `server-only` und ohne Abhängigkeiten: reine Funktion, direkt
 * testbar, enthält kein Geheimnis.
 */

/** Gilt, wenn CHECKOUT_REQUIRE_ACCOUNT nicht (verwertbar) gesetzt ist. */
export const REQUIRE_ACCOUNT_DEFAULT = true

const OFF = new Set(["0", "false", "off", "nein", "no"])
const ON = new Set(["1", "true", "on", "ja", "yes"])

/** Müssen Kundinnen und Kunden für eine Bestellung angemeldet sein? */
export function requiresAccount(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = env.CHECKOUT_REQUIRE_ACCOUNT?.trim().toLowerCase()
  if (raw && OFF.has(raw)) return false
  if (raw && ON.has(raw)) return true
  return REQUIRE_ACCOUNT_DEFAULT
}
