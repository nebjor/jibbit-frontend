import {
  INTRO_PHASE_ORDER,
  INTRO_TIMINGS,
  type IntroPhase,
} from "./timings";

export type IntroEnd = "completed" | "skipped";

/**
 * Die Phasen-Maschine des Intros — bewusst OHNE React und ohne DOM, damit
 * Phasenfolge, Dauern und das Abbrechen in Vitest (Node-Umgebung, wie alle
 * Tests hier) prüfbar sind. IntroOverlay.tsx ist nur die dünne Anbindung:
 * `onPhase` setzt dort ein `data-phase`-Attribut, die Übergänge macht CSS.
 *
 *   start()   beginnt bei der ersten Phase und schaltet per setTimeout weiter
 *   skip()    bricht SOFORT ab (Klick/Taste/Scrollen) -> onDone("skipped")
 *   dispose() räumt Timer ab ohne onDone — für React-Unmount-Cleanup
 */
export function createIntroMachine(opts: {
  onPhase: (phase: IntroPhase) => void;
  onDone: (end: IntroEnd) => void;
  timings?: Readonly<Record<IntroPhase, number>>;
}) {
  const timings = opts.timings ?? INTRO_TIMINGS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let started = false;
  let ended = false;

  const end = (why: IntroEnd) => {
    if (ended) return;
    ended = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    opts.onDone(why);
  };

  const run = (index: number) => {
    if (ended) return;
    if (index >= INTRO_PHASE_ORDER.length) {
      end("completed");
      return;
    }
    const phase = INTRO_PHASE_ORDER[index];
    opts.onPhase(phase);
    timer = setTimeout(() => run(index + 1), timings[phase]);
  };

  return {
    start() {
      if (started || ended) return;
      started = true;
      run(0);
    },
    skip() {
      if (started) end("skipped");
    },
    dispose() {
      ended = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
