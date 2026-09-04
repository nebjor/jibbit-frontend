/**
 * ALTERSABFRAGE & COOKIE-EINWILLIGUNG — reine Zustandslogik.
 *
 * Bewusst ohne DOM und ohne `next/headers`, damit sie unter Vitest
 * (environment: node) testbar ist. Gelesen/geschrieben wird an zwei Orten:
 * serverseitig in lib/consent/server.ts (fürs erste Rendern, damit nichts
 * aufblitzt) und clientseitig in lib/consent/client.ts (für die Interaktion).
 *
 * Zwei getrennte Entscheide, zwei getrennte Cookies:
 *
 * 1. ALTERSABFRAGE (`jibbit_alterscheck`).
 *    ⚠️ WARUM ES SIE GIBT — BITTE NICHT ALS ÜBERFLÜSSIG ENTFERNEN:
 *    Für dieses Sortiment (Papers, Filter, Grinder, Aschenbecher — kein
 *    Tabak, kein Nikotin, kein CBD/THC) kennt die Schweiz KEINE gesetzliche
 *    Altersgrenze; das Tabakproduktegesetz greift hier nicht. Die Grenze
 *    «ab 18» steht aber in den EIGENEN AGB (Ziffer 3): der Shop verkauft
 *    nur an Erwachsene. Die Abfrage macht aus dieser Vertragsbedingung eine
 *    durchgesetzte Regel statt einer leeren Behauptung. Wer sie löscht,
 *    macht die AGB unglaubwürdig — nicht den Code schlanker.
 *
 * 2. COOKIE-EINWILLIGUNG (`jibbit_cookie_consent`).
 *    Nach revidiertem DSG verlangt Analyse auf der eigenen Seite nur
 *    Transparenz — Besucher aus der EU bringen aber die DSGVO mit, und
 *    Analysewerkzeuge (geplant: PostHog, wird separat eingebaut) sollen
 *    ohne Einwilligung gar nicht erst LADEN. Deshalb die harte Regel:
 *    kein gültiges Einwilligungs-Cookie => keine Analyse
 *    (`isAnalyticsAllowed(null) === false`). Zwingend Notwendiges
 *    (Warenkorb, Anmeldung) läuft immer und braucht keine Einwilligung.
 *
 * MULTI-TENANCY: Beide Cookies werden OHNE `Domain`-Attribut gesetzt —
 * der Browser bindet sie an genau den Host, der sie gesetzt hat (gleiche
 * Begründung wie beim Warenkorb-Cookie, siehe lib/cart/cookie.ts).
 */

export const AGE_COOKIE = "jibbit_alterscheck";
export const CONSENT_COOKIE = "jibbit_cookie_consent";

/**
 * Version des Einwilligungsformats. Wird sie erhöht (z. B. weil neue
 * Kategorien dazukommen), sind alte Cookies ungültig und der Hinweis
 * fragt erneut — eine Einwilligung zu Frage A gilt nicht für Frage B.
 */
export const CONSENT_VERSION = 1;

/** «Ja» merken wir uns ein Jahr — die Frage nervt sonst bei jedem Besuch. */
export const AGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Die Einwilligung gilt sechs Monate, dann fragen wir neu. Kein Jahr:
 * eine Einwilligung, an die sich niemand mehr erinnert, ist keine gute.
 */
export const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

/** `null` = noch nie geantwortet (erster Besuch). */
export type AgeAnswer = "adult" | "minor" | null;

export interface ConsentDecision {
  /** Formatversion, siehe CONSENT_VERSION. */
  v: number;
  /** Die eigentliche Wahl: darf Analyse laufen? */
  analytics: boolean;
  /** Zeitpunkt der Entscheidung (ISO), für Nachvollziehbarkeit. */
  ts: string;
}

// ---------------------------------------------------------------------------
// Cookie-Werte lesen/schreiben (nur die WERTE — wo sie herkommen, entscheiden
// server.ts und client.ts)
// ---------------------------------------------------------------------------

const AGE_ADULT = "18plus";
const AGE_MINOR = "u18";

export function parseAgeAnswer(raw: string | undefined | null): AgeAnswer {
  if (raw === AGE_ADULT) return "adult";
  if (raw === AGE_MINOR) return "minor";
  // Unbekannter oder manipulierter Wert: wie unbeantwortet behandeln —
  // die Abfrage kommt dann einfach wieder.
  return null;
}

export function serializeAgeAnswer(answer: "adult" | "minor"): string {
  return answer === "adult" ? AGE_ADULT : AGE_MINOR;
}

export function parseConsent(
  raw: string | undefined | null,
): ConsentDecision | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(raw));
  } catch {
    // Kaputtes Cookie => wie keine Einwilligung. NIE in Richtung
    // «erlaubt» raten.
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const c = parsed as Record<string, unknown>;
  if (c.v !== CONSENT_VERSION) return null;
  if (typeof c.analytics !== "boolean") return null;
  return {
    v: CONSENT_VERSION,
    analytics: c.analytics,
    ts: typeof c.ts === "string" ? c.ts : "",
  };
}

export function serializeConsent(analytics: boolean, now: Date): string {
  return encodeURIComponent(
    JSON.stringify({
      v: CONSENT_VERSION,
      analytics,
      ts: now.toISOString(),
    } satisfies ConsentDecision),
  );
}

// ---------------------------------------------------------------------------
// Die beiden Fragen, auf die alles andere andockt
// ---------------------------------------------------------------------------

/**
 * DIE Frage für den PostHog-Einbau (und jedes andere Analysewerkzeug):
 * darf Analyse laufen? `null` (keine oder ungültige Einwilligung) heisst
 * NEIN — Analyse ist opt-in, niemals Default.
 */
export function isAnalyticsAllowed(
  consent: ConsentDecision | null,
): boolean {
  return consent !== null && consent.analytics === true;
}

export type OverlayStep = "age-gate" | "consent-banner" | "none";

/**
 * Welche Einblendung ist dran? GENAU EINE aufs Mal — beide übereinander
 * wären unbedienbar. Reihenfolge beim ersten Besuch:
 *
 *   1. Altersabfrage (blockiert den Shop, bis geantwortet ist),
 *   2. erst nach «ja, 18+» der Cookie-Hinweis,
 *   3. danach nichts mehr.
 *
 * Wer «nein» antwortet, bleibt bei der (ruhigen) Sperrseite der
 * Altersabfrage — ein Cookie-Hinweis wäre dort sinnlos, es läuft ohnehin
 * keine Analyse (keine Einwilligung erteilt und kein Shop benutzbar).
 */
export function overlayStep(
  age: AgeAnswer,
  consent: ConsentDecision | null,
): OverlayStep {
  if (age === null || age === "minor") return "age-gate";
  if (consent === null) return "consent-banner";
  return "none";
}
