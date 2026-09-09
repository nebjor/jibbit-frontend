import { INTRO_SESSION_KEY } from "./timings";

export type IntroDecision = "play" | "skip";

/** Nur die zwei Methoden, die wir brauchen — so bleibt der Test trivial. */
export type IntroStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * Entscheidung pro SEITENLADEKONTEXT gemerkt (Modul-Variable), aus zwei
 * Gründen:
 *
 * 1. Reacts Strict Mode (dev) mountet Effekte doppelt. Ohne Cache hätte der
 *    erste Mount den sessionStorage-Marker gesetzt und der zweite läse
 *    «schon gesehen» — das Intro liefe in der Entwicklung nie.
 * 2. Soft-Navigation zurück auf die Startseite mountet das Overlay erneut;
 *    nach einem beendeten Intro (markIntroDone) bleibt die Antwort «skip»,
 *    auch wenn ein privater Modus den sessionStorage wegwirft.
 *
 * WIRFT der Speicher (alte private Modi), gilt: lieber KEIN Intro als bei
 * jedem Aufruf eines — die Auflage «nur beim ersten Besuch» wiegt schwerer
 * als die Inszenierung. Nur das SCHREIBEN darf scheitern (Quota): dann
 * wissen wir sicher, dass es der erste Besuch ist, und spielen trotzdem.
 *
 * ⚠️ NEBENWIRKUNG: `decideIntro` SETZT beim ersten «play» den Marker.
 * Deshalb NIE aufrufen, solange die Altersabfrage noch offen ist — sonst
 * gälte das Intro als gesehen, ohne je gelaufen zu sein. Den richtigen
 * Zeitpunkt wählt der Startwächter (lib/intro/starter.ts): erst nach
 * bestätigtem «adult».
 */
let cached: IntroDecision | null = null;

export function decideIntro(env: {
  prefersReducedMotion: boolean;
  storage: IntroStorage | null;
}): IntroDecision {
  if (cached !== null) return cached;

  // Auflage: prefers-reduced-motion heisst GAR KEIN Intro, nicht abgeschwächt.
  if (env.prefersReducedMotion) return (cached = "skip");
  if (env.storage === null) return (cached = "skip");

  let seen: string | null;
  try {
    seen = env.storage.getItem(INTRO_SESSION_KEY);
  } catch {
    return (cached = "skip");
  }
  if (seen !== null) return (cached = "skip");

  try {
    env.storage.setItem(INTRO_SESSION_KEY, "1");
  } catch {
    // Merken unmöglich, Besuch aber nachweislich der erste: trotzdem spielen.
  }
  return (cached = "play");
}

/** Nach Durchlauf ODER Abbruch: diese Seitenansicht spielt nie wieder. */
export function markIntroDone() {
  cached = "skip";
}

/** Nur für Tests — Produktion setzt den Cache nie zurück. */
export function resetIntroDecisionForTests() {
  cached = null;
}
