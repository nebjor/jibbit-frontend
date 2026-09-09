import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgeAnswer } from "@/lib/consent/state";
import {
  createIntroStarter,
  isIntroActive,
  resetIntroActiveForTests,
  setIntroActive,
  subscribeIntroActive,
} from "./starter";
import {
  decideIntro,
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

/** Nachbau des Alters-Kanals (lib/consent/client.ts) ohne DOM. */
function ageChannel() {
  let cb: ((age: AgeAnswer) => void) | null = null;
  let unsubscribed = false;
  return {
    onAgeChange(fn: (age: AgeAnswer) => void) {
      cb = fn;
      return () => {
        unsubscribed = true;
        cb = null;
      };
    },
    fire(age: AgeAnswer) {
      cb?.(age);
    },
    get subscribed() {
      return cb !== null;
    },
    get unsubscribed() {
      return unsubscribed;
    },
  };
}

/**
 * Starter mit ECHTEM decideIntro und echtem Speicher verdrahtet — genau die
 * Falle der Abfolge-Umstellung: decideIntro setzt beim ersten Aufruf den
 * sessionStorage-Marker «gesehen». Die Tests prüfen darum nicht nur, OB
 * gestartet wird, sondern auch, dass der Marker erst dann steht.
 */
function wire(storage: IntroStorage) {
  const channel = ageChannel();
  const onPlay = vi.fn();
  const onSkip = vi.fn();
  const decide = vi.fn(() =>
    decideIntro({ prefersReducedMotion: false, storage }),
  );
  const starter = createIntroStarter({
    decide,
    onAgeChange: channel.onAgeChange,
    onPlay,
    onSkip,
  });
  return { starter, channel, onPlay, onSkip, decide };
}

describe("createIntroStarter — Abfolge Altersabfrage -> Intro", () => {
  beforeEach(() => {
    resetIntroDecisionForTests();
  });

  it("offene Altersabfrage (age null): kein Start, decide unangetastet, Marker NICHT gesetzt", () => {
    const storage = memoryStorage();
    const { starter, onPlay, onSkip, decide } = wire(storage);

    starter.begin(null);

    expect(onPlay).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
    expect(decide).not.toHaveBeenCalled();
    // DIE Falle: der «gesehen»-Marker darf nicht stehen, solange der
    // Besucher noch vor der Abfrage sitzt — sonst liefe das Intro nie.
    expect(storage.data[INTRO_SESSION_KEY]).toBeUndefined();
  });

  it("nach der Bestätigung («adult» über den Kanal) startet das Intro — und erst JETZT steht der Marker", () => {
    const storage = memoryStorage();
    const { starter, channel, onPlay } = wire(storage);

    starter.begin(null);
    expect(storage.data[INTRO_SESSION_KEY]).toBeUndefined();

    channel.fire("adult");

    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(storage.data[INTRO_SESSION_KEY]).toBe("1");
  });

  it("bereits bestätigtes Alter (Cookie): Intro startet sofort, ohne auf den Kanal zu warten", () => {
    const storage = memoryStorage();
    const { starter, channel, onPlay } = wire(storage);

    starter.begin("adult");

    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(storage.data[INTRO_SESSION_KEY]).toBe("1");
    // Entschieden ist entschieden — der Kanal wurde gar nicht erst abonniert.
    expect(channel.subscribed).toBe(false);
  });

  it("Verneinung: Sperrseite ohne Intro — weder beim Start noch über den Kanal, Marker bleibt weg", () => {
    const storage = memoryStorage();
    const { starter, channel, onPlay, onSkip, decide } = wire(storage);

    starter.begin("minor");
    channel.fire("minor");

    expect(onPlay).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
    expect(decide).not.toHaveBeenCalled();
    expect(storage.data[INTRO_SESSION_KEY]).toBeUndefined();
  });

  it("Verneinung zurückgenommen und doch bestätigt: das Intro darf noch", () => {
    const storage = memoryStorage();
    const { starter, channel, onPlay } = wire(storage);

    starter.begin("minor");
    channel.fire(null); // «andere Antwort» auf der Sperrseite
    expect(onPlay).not.toHaveBeenCalled();

    channel.fire("adult");
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it("Intro in dieser Sitzung schon gesehen: Bestätigung führt zu onSkip (Deckel wegräumen), nicht zu onPlay", () => {
    const storage = memoryStorage({ [INTRO_SESSION_KEY]: "1" });
    const { starter, channel, onPlay, onSkip } = wire(storage);

    starter.begin(null);
    channel.fire("adult");

    expect(onPlay).not.toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("entscheidet höchstens einmal: weitere Kanal-Meldungen nach dem Start bewirken nichts", () => {
    const storage = memoryStorage();
    const { starter, channel, onPlay, decide } = wire(storage);

    starter.begin(null);
    channel.fire("adult");
    channel.fire("adult");

    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(decide).toHaveBeenCalledTimes(1);
    expect(channel.unsubscribed).toBe(true);
  });

  it("dispose (React-Unmount) vor der Bestätigung: abbestellt, späteres «adult» startet nichts mehr", () => {
    const storage = memoryStorage();
    const { starter, channel, onPlay, decide } = wire(storage);

    starter.begin(null);
    starter.dispose();
    expect(channel.unsubscribed).toBe(true);

    channel.fire("adult");
    expect(onPlay).not.toHaveBeenCalled();
    expect(decide).not.toHaveBeenCalled();
    expect(storage.data[INTRO_SESSION_KEY]).toBeUndefined();
  });
});

describe("introActive-Store — Abfolge Intro -> Cookie-Hinweis", () => {
  beforeEach(() => {
    resetIntroActiveForTests();
  });

  it("meldet Start und Ende des Intros an Abonnenten (ConsentGate hält den Hinweis solange zurück)", () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribeIntroActive(() => seen.push(isIntroActive()));

    expect(isIntroActive()).toBe(false);
    setIntroActive(true);
    setIntroActive(true); // unverändert -> keine zweite Meldung
    setIntroActive(false);

    expect(seen).toEqual([true, false]);
    unsubscribe();
    setIntroActive(true);
    expect(seen).toEqual([true, false]);
  });
});
