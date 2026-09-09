"use client";

/**
 * EINWILLIGUNG — CLIENTSEITIGE SCHNITTSTELLE.
 *
 * ═══ HIER DOCKT POSTHOG AN ═════════════════════════════════════════════
 * Der (separat geplante) PostHog-Einbau braucht genau drei Dinge und
 * bekommt sie hier, ohne dass an den Dialog-Komponenten etwas umgebaut
 * werden muss:
 *
 *   isAnalyticsAllowed()          — darf Analyse (jetzt gerade) laufen?
 *   onConsentChange(cb)           — reagiert auf Erteilen UND Widerruf
 *   (und sonst nichts: laden erst NACH erteilter Einwilligung, stoppen
 *    beim Widerruf.)
 *
 * Beispiel für später:
 *   if (isAnalyticsAllowed()) initAnalytics();
 *   onConsentChange((c) => c?.analytics ? initAnalytics() : stopAnalytics());
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Die Cookies sind absichtlich NICHT httpOnly: dieser Code (und später der
 * Analyse-Loader) muss sie im Browser lesen. Inhalt ist eine Ja/Nein-Antwort
 * bzw. die Einwilligungswahl — nichts, was vor Skripten geheim sein müsste.
 * Kein `Domain`-Attribut (Mandantenisolation, siehe lib/consent/state.ts).
 */

import {
  AGE_COOKIE,
  AGE_COOKIE_MAX_AGE,
  CONSENT_COOKIE,
  CONSENT_COOKIE_MAX_AGE,
  CONSENT_VERSION,
  isAnalyticsAllowed as decide,
  parseAgeAnswer,
  parseConsent,
  serializeAgeAnswer,
  serializeConsent,
  type AgeAnswer,
  type ConsentDecision,
} from "./state";

/** Einwilligung erteilt/geändert/widerrufen — Detail: ConsentDecision|null. */
export const CONSENT_CHANGED_EVENT = "jibbit:consent-changed";
/** Der Footer-Link «Cookie-Einstellungen» will den Dialog (wieder) öffnen. */
export const CONSENT_OPEN_EVENT = "jibbit:consent-open";
/**
 * Altersantwort gegeben/zurückgesetzt — Detail: AgeAnswer. Reine
 * ZUSTANDSERWEITERUNG für Mithörer ausserhalb des ConsentGate (derzeit
 * einzig das Startseiten-Intro, lib/intro/starter.ts: es darf erst nach
 * bestätigtem «adult» starten). Am Verhalten der Einwilligung selbst
 * ändert dieser Kanal nichts — er meldet nur, was ohnehin geschieht.
 */
export const AGE_CHANGED_EVENT = "jibbit:age-changed";

// ---------------------------------------------------------------------------
// Cookies lesen/schreiben
// ---------------------------------------------------------------------------

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split("; ")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
}

function writeCookie(name: string, value: string, maxAge?: number): void {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  const age = maxAge === undefined ? "" : `; max-age=${maxAge}`;
  // Kein Domain-Attribut — siehe Kopfkommentar.
  document.cookie = `${name}=${value}; path=/${age}; samesite=lax${secure}`;
}

// ---------------------------------------------------------------------------
// Altersabfrage
// ---------------------------------------------------------------------------

export function readAgeAnswer(): AgeAnswer {
  return parseAgeAnswer(readCookie(AGE_COOKIE));
}

export function writeAgeAnswer(answer: "adult" | "minor"): void {
  // «Nein» nur als Sitzungs-Cookie: wer sich vertippt hat oder später
  // volljährig wiederkommt, ist nicht ein Jahr lang ausgesperrt. «Ja»
  // bleibt ein Jahr, damit die Frage nicht bei jedem Besuch wiederkommt.
  writeCookie(
    AGE_COOKIE,
    serializeAgeAnswer(answer),
    answer === "adult" ? AGE_COOKIE_MAX_AGE : undefined,
  );
  dispatchAgeChanged(answer);
}

export function clearAgeAnswer(): void {
  writeCookie(AGE_COOKIE, "", 0);
  dispatchAgeChanged(null);
}

function dispatchAgeChanged(age: AgeAnswer): void {
  window.dispatchEvent(
    new CustomEvent<AgeAnswer>(AGE_CHANGED_EVENT, { detail: age }),
  );
}

/**
 * Auf die Altersantwort reagieren (siehe AGE_CHANGED_EVENT). Gibt die
 * Abmeldefunktion zurück — gleiches Muster wie onConsentChange.
 */
export function onAgeAnswerChange(cb: (age: AgeAnswer) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<AgeAnswer>).detail);
  window.addEventListener(AGE_CHANGED_EVENT, handler);
  return () => window.removeEventListener(AGE_CHANGED_EVENT, handler);
}

// ---------------------------------------------------------------------------
// Einwilligung — die abfragbare Wahrheit
// ---------------------------------------------------------------------------

export function getConsent(): ConsentDecision | null {
  return parseConsent(readCookie(CONSENT_COOKIE));
}

/** DIE Frage für Analysewerkzeuge. Ohne gültige Einwilligung: false. */
export function isAnalyticsAllowed(): boolean {
  return decide(getConsent());
}

/**
 * Wahl speichern — sowohl Erteilen (`true`) als auch Ablehnen/Widerruf
 * (`false`) werden als Cookie festgehalten, damit der Hinweis nicht bei
 * jedem Besuch erneut aufgeht. Benachrichtigt alle Abonnenten.
 */
export function writeConsent(analytics: boolean): ConsentDecision {
  const decision: ConsentDecision = {
    v: CONSENT_VERSION,
    analytics,
    ts: new Date().toISOString(),
  };
  writeCookie(
    CONSENT_COOKIE,
    serializeConsent(analytics, new Date(decision.ts)),
    CONSENT_COOKIE_MAX_AGE,
  );
  window.dispatchEvent(
    new CustomEvent<ConsentDecision | null>(CONSENT_CHANGED_EVENT, {
      detail: decision,
    }),
  );
  return decision;
}

/**
 * Auf Änderungen reagieren — insbesondere auf den WIDERRUF: ein laufendes
 * Analysewerkzeug muss dann sofort stoppen, nicht erst beim nächsten
 * Seitenaufruf. Gibt die Abmeldefunktion zurück.
 */
export function onConsentChange(
  cb: (consent: ConsentDecision | null) => void,
): () => void {
  const handler = (e: Event) =>
    cb((e as CustomEvent<ConsentDecision | null>).detail);
  window.addEventListener(CONSENT_CHANGED_EVENT, handler);
  return () => window.removeEventListener(CONSENT_CHANGED_EVENT, handler);
}

// ---------------------------------------------------------------------------
// Widerruf / erneutes Öffnen
// ---------------------------------------------------------------------------

/**
 * Öffnet den Einwilligungsdialog erneut (Footer-Link «Cookie-Einstellungen»).
 * Eine Einwilligung, die man nicht zurücknehmen kann, ist keine — der
 * Widerruf ist darum genau einen Klick vom Footer entfernt und damit so
 * leicht wie das Erteilen.
 */
export function openConsentSettings(): void {
  window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT));
}

export function onConsentSettingsOpen(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(CONSENT_OPEN_EVENT, handler);
  return () => window.removeEventListener(CONSENT_OPEN_EVENT, handler);
}
