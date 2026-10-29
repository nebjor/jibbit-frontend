/**
 * Produktwunsch: Eingaben prüfen und für das Backend aufbereiten.
 *
 * Reine Funktionen ohne Next- und Browserbezug, damit sie sich einzeln
 * testen lassen. Dieselben Grenzen gelten im Backend (`POST /store/produktwunsch`);
 * dort zählen sie, hier sparen sie nur den Umweg.
 */

export const WUNSCH_MAX = 500
export const EMAIL_MAX = 254
export const KATEGORIE_MAX = 120
export const SUCHE_MAX = 200
export const URL_MAX = 500

/** Mindestabstand zwischen zwei Wünschen im selben Browser. */
export const SENDE_ABSTAND_MS = 60_000

export const MELDUNG_ERFOLG = "Danke! Wir melden uns, falls wir es aufnehmen."
export const MELDUNG_WUNSCH_FEHLT = "Bitte beschreibe kurz, welches Produkt dir fehlt."
export const MELDUNG_WUNSCH_ZU_LANG = `Bitte fasse dich kürzer (höchstens ${WUNSCH_MAX} Zeichen).`
export const MELDUNG_EMAIL_UNGUELTIG = "Diese E-Mail-Adresse sieht nicht richtig aus."
export const MELDUNG_ZU_OFT = "Du hast gerade schon einen Wunsch geschickt. Bitte warte eine Minute."
export const MELDUNG_ZU_VIELE = "Heute sind schon viele Wünsche von dir eingegangen. Bitte versuche es später noch einmal."
export const MELDUNG_FEHLER = "Das hat leider nicht geklappt. Bitte versuche es später noch einmal."

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface ProduktwunschPayload {
  wunsch: string
  email?: string
  kontext: { kategorie?: string; suche?: string; url?: string }
}

export type ProduktwunschPruefung =
  | { art: "ok"; payload: ProduktwunschPayload }
  /** Honeypot gefüllt: so tun, als wäre alles gut, und nichts senden. */
  | { art: "spam" }
  | { art: "ungueltig"; fieldErrors: Record<string, string> }

export interface ProduktwunschRoh {
  wunsch?: unknown
  email?: unknown
  kategorie?: unknown
  suche?: unknown
  url?: unknown
  /** Honeypot-Feld; Menschen sehen es nicht und lassen es leer. */
  website?: unknown
}

function text(value: unknown, max: number): string {
  // Steuerzeichen (ausser Zeilenumbruch im Wunsch) tragen nichts bei.
  const s = typeof value === "string" ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ") : ""
  return s.trim().slice(0, max)
}

/** Nur http(s)-Adressen als Kontext; alles andere fällt weg. */
function kontextUrl(value: unknown): string | undefined {
  const s = text(value, URL_MAX)
  if (!s) return undefined
  try {
    const u = new URL(s)
    return u.protocol === "http:" || u.protocol === "https:" ? s : undefined
  } catch {
    return undefined
  }
}

export function pruefeProduktwunsch(roh: ProduktwunschRoh): ProduktwunschPruefung {
  if (typeof roh.website === "string" && roh.website.trim() !== "") return { art: "spam" }

  const fieldErrors: Record<string, string> = {}

  const rohWunsch = typeof roh.wunsch === "string" ? roh.wunsch.trim() : ""
  const wunsch = text(roh.wunsch, WUNSCH_MAX + 1)
  if (!rohWunsch) fieldErrors.wunsch = MELDUNG_WUNSCH_FEHLT
  else if (wunsch.length > WUNSCH_MAX) fieldErrors.wunsch = MELDUNG_WUNSCH_ZU_LANG

  const email = text(roh.email, EMAIL_MAX + 1)
  if (email && (email.length > EMAIL_MAX || !EMAIL_RE.test(email))) {
    fieldErrors.email = MELDUNG_EMAIL_UNGUELTIG
  }

  if (Object.keys(fieldErrors).length) return { art: "ungueltig", fieldErrors }

  const kategorie = text(roh.kategorie, KATEGORIE_MAX)
  const suche = text(roh.suche, SUCHE_MAX)
  const url = kontextUrl(roh.url)

  return {
    art: "ok",
    payload: {
      wunsch,
      ...(email ? { email } : {}),
      kontext: {
        ...(kategorie ? { kategorie } : {}),
        ...(suche ? { suche } : {}),
        ...(url ? { url } : {}),
      },
    },
  }
}

/** Darf jetzt gesendet werden? `letzter` ist der Zeitstempel des letzten Versands. */
export function darfSenden(letzter: number | null, jetzt: number): boolean {
  if (letzter === null || !Number.isFinite(letzter)) return true
  // Eine Uhr, die rückwärts springt, sperrt nicht länger als eine Minute.
  if (letzter > jetzt) return true
  return jetzt - letzter >= SENDE_ABSTAND_MS
}

/** Backend-Status -> Meldung für Besucher. */
export function meldungFuerStatus(status: number | undefined): string {
  if (status === 429) return MELDUNG_ZU_VIELE
  return MELDUNG_FEHLER
}

/** Adresse des Besuchers aus den Proxy-Headern (letzter Eintrag: vom nächsten Proxy angehängt). */
export function besucherAdresse(realIp: string | null, forwardedFor: string | null): string | undefined {
  const kandidaten = [realIp?.trim(), forwardedFor?.split(",").pop()?.trim()]
  return kandidaten.find((k): k is string => Boolean(k) && /^[0-9a-fA-F:.]{3,45}$/.test(k as string))
}
