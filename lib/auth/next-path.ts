/**
 * Prüfung von `next`-Weiterleitungszielen — EINE Implementierung für alle
 * Stellen, die nach Anmeldung oder Registrierung irgendwohin zurückführen.
 *
 * Ein `next` aus Formular oder URL ist Benutzereingabe. Ohne Prüfung wäre es
 * eine offene Weiterleitung: ein Phishing-Link, der auf der echten Shop-Domain
 * beginnt und auf einer fremden endet.
 *
 * Der Rückschrägstrich-Fall ist der, den man übersieht: Browser normalisieren
 * `/\boese.example` zu `//boese.example` und landen auf einem fremden Host,
 * obwohl der Pfad mit einem einzelnen `/` beginnt. Eine Prüfung nur auf `//`
 * geht genau daran vorbei.
 *
 * Bewusst ohne `server-only`: reine Funktion, direkt testbar.
 */

/** Ist `raw` ein relatives, gefahrloses Weiterleitungsziel? */
export function isSafeNextPath(raw: string | undefined | null): raw is string {
  if (!raw) return false
  return raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")
}

/** `raw`, wenn gefahrlos — sonst `fallback`. */
export function safeNextPath(
  raw: string | undefined | null,
  fallback: string,
): string {
  return isSafeNextPath(raw) ? raw : fallback
}
