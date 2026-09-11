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
 * ZWEI WAHRHEITEN, EIN WÄCHTER: Das Alter kennt der Wächter aus dem Cookie
 * (readAgeAnswer) und aus dem Kanal — ob die ABFRAGE aber gerade VOR dem
 * Besucher steht, entscheidet das server-gerenderte HTML plus der
 * Client-Zustand des ConsentGate, nicht das Cookie. Die beiden können
 * auseinanderlaufen: ein zweiter Tab setzt das Cookie zwischen Request und
 * Hydration, ein Cache/Proxy liefert die cookielose HTML-Variante an einen
 * Browser, der das 12-Monats-Cookie längst trägt. Wer dann nur aufs Cookie
 * schaut, spielt das Intro ÜBER der offenen Abfrage (z-Stapel) — und die
 * Abfrage ploppt mitten in der Animation hervor (der Desktop-Bug). Darum
 * prüft der Wächter zusätzlich `isGateOpen()` (gespeist vom ConsentGate,
 * Store unten) und wartet auch bei bestätigtem Alter, bis die Abfrage
 * wirklich zu ist.
 *
 *   begin(age)   mit dem AKTUELLEN Alters-Stand aufrufen:
 *                  «adult»  -> sofort entscheiden — ausser die Abfrage ist
 *                              (wider das Cookie) noch offen: dann warten,
 *                              bis sie zugeht
 *                  null     -> warten, bis der Alters-Kanal «adult» meldet
 *                              (der Besucher bestätigt gerade)
 *                  «minor»  -> Sperrseite: kein Intro. (Setzt der Besucher
 *                              die Antwort zurück und bestätigt doch, meldet
 *                              der Kanal «adult» und das Intro darf noch.)
 *   dispose()    React-Unmount-Cleanup: abbestellen, nie mehr starten.
 *
 * Entschieden wird höchstens EINMAL; danach sind beide Kanäle abbestellt.
 */
export function createIntroStarter(opts: {
  /** decideIntro, verpackt mit seiner Umgebung — setzt den Marker! */
  decide: () => IntroDecision;
  /** Alters-Kanal (lib/consent/client.ts, onAgeAnswerChange). */
  onAgeChange: (cb: (age: AgeAnswer) => void) => () => void;
  /** Steht die Altersabfrage gerade vor dem Besucher? (Store unten.) */
  isGateOpen: () => boolean;
  /** Sichtbarkeits-Kanal der Abfrage (subscribeAgeGateOpen unten). */
  onGateChange: (cb: () => void) => () => void;
  /** Entscheidung «play»: Intro jetzt wirklich starten. */
  onPlay: () => void;
  /** Entscheidung «skip»: nichts spielt — Vor-Hydrations-Deckel wegräumen. */
  onSkip: () => void;
}) {
  let settled = false;
  let lastAge: AgeAnswer = null;
  let unsubAge: (() => void) | null = null;
  let unsubGate: (() => void) | null = null;

  const settle = () => {
    settled = true;
    if (unsubAge !== null) {
      unsubAge();
      unsubAge = null;
    }
    if (unsubGate !== null) {
      unsubGate();
      unsubGate = null;
    }
  };

  const tryStart = () => {
    if (settled) return;
    // Abfrage offen (null) oder verneint («minor»): decide() NICHT anrufen —
    // sonst stünde der «gesehen»-Marker, bevor je ein Bild lief.
    if (lastAge !== "adult") return;
    // Cookie sagt «adult», aber die Abfrage steht (noch) vor dem Besucher —
    // etwa nach dem Bestätigungs-Klick, bevor React sie weggeräumt hat, oder
    // weil Server-HTML und Cookie auseinanderliefen (Kopfkommentar). Erst
    // wenn sie zu ist, darf die Inszenierung los; den Weckruf liefert der
    // Sichtbarkeits-Kanal.
    if (opts.isGateOpen()) return;
    settle();
    if (opts.decide() === "play") {
      opts.onPlay();
    } else {
      opts.onSkip();
    }
  };

  return {
    begin(age: AgeAnswer) {
      lastAge = age;
      tryStart();
      if (!settled && unsubAge === null) {
        unsubAge = opts.onAgeChange((next) => {
          lastAge = next;
          tryStart();
        });
        unsubGate = opts.onGateChange(tryStart);
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

/* ---------------------------------------------------------------------------
 * «Steht die Altersabfrage gerade vor dem Besucher?» — das Gegenstück in
 * die andere Richtung. NUR ConsentGate.tsx schreibt hier (Layout-Effekt:
 * der läuft VOR den passiven Effekten des — womöglich später gestreamten —
 * Seiteninhalts, der Wächter oben liest also nie einen veralteten Wert).
 * Der Wächter liest und abonniert; am VERHALTEN der Einwilligungslogik
 * ändert dieser Kanal nichts — er meldet nur, was ohnehin sichtbar ist.
 *
 * Serverseitig/initial `false`: solange kein ConsentGate etwas gemeldet
 * hat, gilt die Abfrage als zu — exakt das bisherige Verhalten, damit das
 * Intro auf Seiten ohne Gate (bestätigtes Cookie) sofort spielen darf.
 * ------------------------------------------------------------------------- */

let ageGateOpen = false;
const ageGateListeners = new Set<() => void>();

/** Nur ConsentGate.tsx schreibt hier: true solange die Abfrage gezeigt wird. */
export function setAgeGateOpen(open: boolean): void {
  if (ageGateOpen === open) return;
  ageGateOpen = open;
  for (const listener of [...ageGateListeners]) listener();
}

export function isAgeGateOpen(): boolean {
  return ageGateOpen;
}

export function subscribeAgeGateOpen(listener: () => void): () => void {
  ageGateListeners.add(listener);
  return () => {
    ageGateListeners.delete(listener);
  };
}

/** Nur für Tests — Produktion setzt den Store nie hart zurück. */
export function resetAgeGateOpenForTests(): void {
  ageGateOpen = false;
  ageGateListeners.clear();
}
