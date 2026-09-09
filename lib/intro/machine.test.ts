import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIntroMachine } from "./machine";
import {
  INTRO_PHASE_ORDER,
  INTRO_TIMINGS,
  INTRO_TOTAL_MS,
  type IntroPhase,
} from "./timings";

/**
 * Die Phasenfolge und die Gesamtdauer sind hier festgeschraubt: dreht der
 * Betreiber an lib/intro/timings.ts, rechnen die Tests mit — bricht jemand
 * die REIHENFOLGE oder das Abbrechen, schlagen sie fehl.
 */
describe("createIntroMachine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function build() {
    const phases: IntroPhase[] = [];
    const done: string[] = [];
    const machine = createIntroMachine({
      onPhase: (p) => phases.push(p),
      onDone: (end) => done.push(end),
    });
    return { machine, phases, done };
  }

  it("durchläuft alle Phasen in der definierten Reihenfolge", () => {
    const { machine, phases, done } = build();
    machine.start();
    // Erste Phase sofort, ohne Timer.
    expect(phases).toEqual(["white"]);

    for (let i = 1; i < INTRO_PHASE_ORDER.length; i++) {
      const previous = INTRO_PHASE_ORDER[i - 1];
      // Eine Millisekunde vor Phasenende passiert noch nichts …
      vi.advanceTimersByTime(INTRO_TIMINGS[previous] - 1);
      expect(phases).toHaveLength(i);
      // … genau mit Ablauf der Phasendauer kommt die nächste.
      vi.advanceTimersByTime(1);
      expect(phases[i]).toBe(INTRO_PHASE_ORDER[i]);
    }
    expect(phases).toEqual([...INTRO_PHASE_ORDER]);
    expect(done).toEqual([]);
  });

  it("meldet «completed» exakt nach der Gesamtdauer", () => {
    const { machine, done } = build();
    machine.start();
    vi.advanceTimersByTime(INTRO_TOTAL_MS - 1);
    expect(done).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(done).toEqual(["completed"]);
  });

  it("skip() bricht sofort ab und plant keine weiteren Phasen", () => {
    const { machine, phases, done } = build();
    machine.start();
    vi.advanceTimersByTime(INTRO_TIMINGS.white + 100); // mitten in jointIn
    machine.skip();
    expect(done).toEqual(["skipped"]);

    const seen = phases.length;
    vi.advanceTimersByTime(INTRO_TOTAL_MS);
    expect(phases).toHaveLength(seen); // nichts kam nach
    expect(done).toEqual(["skipped"]); // und «completed» kommt nie
  });

  it("skip() vor start() tut nichts", () => {
    const { machine, done } = build();
    machine.skip();
    expect(done).toEqual([]);
  });

  it("skip() nach dem Ende meldet nicht doppelt", () => {
    const { machine, done } = build();
    machine.start();
    vi.advanceTimersByTime(INTRO_TOTAL_MS);
    machine.skip();
    expect(done).toEqual(["completed"]);
  });

  it("dispose() räumt ab, ohne onDone auszulösen (React-Cleanup)", () => {
    const { machine, phases, done } = build();
    machine.start();
    machine.dispose();
    vi.advanceTimersByTime(INTRO_TOTAL_MS);
    expect(phases).toEqual(["white"]);
    expect(done).toEqual([]);
  });

  it("die Gesamtdauer ist die Summe der Phasendauern", () => {
    const sum = INTRO_PHASE_ORDER.reduce(
      (acc, phase) => acc + INTRO_TIMINGS[phase],
      0,
    );
    expect(INTRO_TOTAL_MS).toBe(sum);
  });
});
