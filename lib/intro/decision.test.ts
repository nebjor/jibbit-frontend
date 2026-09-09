import { beforeEach, describe, expect, it } from "vitest";
import {
  decideIntro,
  markIntroDone,
  resetIntroDecisionForTests,
  type IntroStorage,
} from "./decision";
import { INTRO_SESSION_KEY } from "./timings";

function memoryStorage(initial: Record<string, string> = {}): IntroStorage & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe("decideIntro", () => {
  beforeEach(() => {
    resetIntroDecisionForTests();
  });

  it("spielt beim ersten Besuch und setzt den Sitzungs-Marker", () => {
    const storage = memoryStorage();
    expect(decideIntro({ prefersReducedMotion: false, storage })).toBe("play");
    expect(storage.data[INTRO_SESSION_KEY]).toBe("1");
  });

  it("spielt NICHT, wenn der Sitzungs-Marker schon gesetzt ist", () => {
    const storage = memoryStorage({ [INTRO_SESSION_KEY]: "1" });
    expect(decideIntro({ prefersReducedMotion: false, storage })).toBe("skip");
  });

  it("prefers-reduced-motion überspringt das Intro GANZ — ohne Speicherzugriff", () => {
    const storage: IntroStorage = {
      getItem: () => {
        throw new Error("darf nicht gelesen werden");
      },
      setItem: () => {
        throw new Error("darf nicht geschrieben werden");
      },
    };
    expect(decideIntro({ prefersReducedMotion: true, storage })).toBe("skip");
  });

  it("ein werfender sessionStorage (privater Modus) macht nichts kaputt: kein Intro, kein Fehler", () => {
    const storage: IntroStorage = {
      getItem: () => {
        throw new DOMException("QuotaExceededError");
      },
      setItem: () => {
        throw new DOMException("QuotaExceededError");
      },
    };
    expect(() =>
      decideIntro({ prefersReducedMotion: false, storage }),
    ).not.toThrow();
    resetIntroDecisionForTests();
    expect(decideIntro({ prefersReducedMotion: false, storage })).toBe("skip");
  });

  it("nur das Schreiben scheitert (Quota): der Besuch ist nachweislich der erste, also spielen", () => {
    const storage: IntroStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("QuotaExceededError");
      },
    };
    expect(decideIntro({ prefersReducedMotion: false, storage })).toBe("play");
  });

  it("ohne Speicher (storage === null) kein Intro", () => {
    expect(decideIntro({ prefersReducedMotion: false, storage: null })).toBe(
      "skip",
    );
  });

  it("Strict-Mode-Doppel-Mount: zweiter Aufruf im selben Ladekontext bleibt «play»", () => {
    const storage = memoryStorage();
    expect(decideIntro({ prefersReducedMotion: false, storage })).toBe("play");
    // Der Marker steht jetzt — ohne Cache ergäbe das fälschlich «skip».
    expect(decideIntro({ prefersReducedMotion: false, storage })).toBe("play");
  });

  it("nach markIntroDone spielt dieselbe Seitenansicht nie wieder", () => {
    const storage = memoryStorage();
    expect(decideIntro({ prefersReducedMotion: false, storage })).toBe("play");
    markIntroDone();
    expect(decideIntro({ prefersReducedMotion: false, storage })).toBe("skip");
  });
});
