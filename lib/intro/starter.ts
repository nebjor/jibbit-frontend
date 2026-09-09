import type { AgeAnswer } from "@/lib/consent/state";
import type { IntroDecision } from "./decision";

/**
 * ABFOLGE ALTERSABFRAGE -> INTRO — der Startwächter.
 *
 * Die Altersabfrage ist eine Bedingung fürs Betreten, das Intro eine
 * Inszenierung: ERST bestätigen, DANN spielen. Dieser Wächter sorgt dafür —
 * bewusst ohne React und ohne DOM (wie lib/intro/machine.ts), damit die
 * Reihenfolge in Vitest prüfbar ist. IntroOverlay.tsx ist nur die Anbindung.
 *
 * DIE FALLE, DIE ER ENTSCHÄRFT: `decideIntro` (lib/intro/decision.ts) setzt
 * beim ERSTEN Aufruf den sessionStorage-Marker «Intro gesehen». Würde es
 * schon ausgewertet, während die Altersabfrage noch offen ist, gälte das
 * Intro als gesehen, ohne je gelaufen zu sein — der Besucher hätte es
 * verpasst, während er den Knopf gesucht hat. Deshalb rührt dieser Wächter
 * `decide()` (und damit den Marker) erst an, wenn das Alter mit «adult»
 * bestätigt ist; das Intro startet also aus dem Stand, wenn die Abfrage
 * verschwindet.
 *
 *   begin(age)   mit dem AKTUELLEN Alters-Stand aufrufen:
 *                  «adult»  -> sofort entscheiden (Cookie von früher — die
 *                              Abfrage erscheint gar nicht, das Intro spielt
 *                              direkt)
 *                  null     -> warten, bis der Alters-Kanal «adult» meldet
 *                              (der Besucher bestätigt gerade)
 *                  «minor»  -> Sperrseite: kein Intro. (Setzt der Besucher
 *                              die Antwort zurück und bestätigt doch, meldet
 *                              der Kanal «adult» und das Intro darf noch.)
 *   dispose()    React-Unmount-Cleanup: abbestellen, nie mehr starten.
 *
 * Entschieden wird höchstens EINMAL; danach ist der Kanal abbestellt.
 */
export function createIntroStarter(opts: {
  /** decideIntro, verpackt mit seiner Umgebung — setzt den Marker! */
  decide: () => IntroDecision;
  /** Alters-Kanal (lib/consent/client.ts, onAgeAnswerChange). */
  onAgeChange: (cb: (age: AgeAnswer) => void) => () => void;
  /** Entscheidung «play»: Intro jetzt wirklich starten. */
  onPlay: () => void;
  /** Entscheidung «skip»: nichts spielt — Vor-Hydrations-Deckel wegräumen. */
  onSkip: () => void;
}) {
  let settled = false;
  let unsubscribe: (() => void) | null = null;

  const settle = () => {
    settled = true;
    if (unsubscribe !== null) {
      unsubscribe();
      unsubscribe = null;
    }
  };

  const tryStart = (age: AgeAnswer) => {
    if (settled) return;
    // Abfrage offen (null) oder verneint («minor»): decide() NICHT anrufen —
    // sonst stünde der «gesehen»-Marker, bevor je ein Bild lief.
    if (age !== "adult") return;
    settle();
    if (opts.decide() === "play") {
      opts.onPlay();
    } else {
      opts.onSkip();
    }
  };

  return {
    begin(age: AgeAnswer) {
      tryStart(age);
      if (!settled && unsubscribe === null) {
        unsubscribe = opts.onAgeChange(tryStart);
      }
    },
    dispose: settle,
  };
}

/* ---------------------------------------------------------------------------
 * «Läuft das Intro gerade?» — winziger Store für die ABFOLGE INTRO ->
 * COOKIE-HINWEIS. ConsentGate.tsx (components/consent/) hält den Hinweis
 * zurück, solange hier `true` steht, und zeigt ihn erst, wenn das Intro
 * fertig oder übersprungen ist. Auf Seiten ohne Intro (alles ausser der
 * Startseite) bleibt der Wert schlicht `false` — der Hinweis erscheint dort
 * wie bisher direkt nach der Altersbestätigung.
 * ------------------------------------------------------------------------- */

let introActive = false;
const introActiveListeners = new Set<() => void>();

/** Nur IntroOverlay.tsx schreibt hier: true beim Start, false am Ende. */
export function setIntroActive(active: boolean): void {
  if (introActive === active) return;
  introActive = active;
  // Kopie: ein Listener darf sich beim Aufruf abbestellen.
  for (const listener of [...introActiveListeners]) listener();
}

/** Snapshot für useSyncExternalStore. Serverseitig immer false. */
export function isIntroActive(): boolean {
  return introActive;
}

export function subscribeIntroActive(listener: () => void): () => void {
  introActiveListeners.add(listener);
  return () => {
    introActiveListeners.delete(listener);
  };
}

/** Nur für Tests — Produktion setzt den Store nie hart zurück. */
export function resetIntroActiveForTests(): void {
  introActive = false;
  introActiveListeners.clear();
}
