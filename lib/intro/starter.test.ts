import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgeAnswer } from "@/lib/consent/state";
import {
  createIntroStarter,
  isAgeGateOpen,
  isIntroActive,
  resetAgeGateOpenForTests,
  resetIntroActiveForTests,
  setAgeGateOpen,
  setIntroActive,
  subscribeAgeGateOpen,
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
 * Nachbau des Sichtbarkeits-Kanals der Altersabfrage (ConsentGate meldet
 * über setAgeGateOpen, hier ohne DOM nachgestellt). `open = true` heisst:
 * die Abfrage steht gerade vor dem Besucher.
 */
function gateChannel(initialOpen = false) {
  let open = initialOpen;
  const listeners = new Set<() => void>();
  return {
    isOpen: () => open,
    onGateChange(cb: () => void) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    set(next: boolean) {
      if (open === next) return;
      open = next;
      for (const cb of [...listeners]) cb();
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

/**
 * Starter mit ECHTEM decideIntro und echtem Speicher verdrahtet — genau die
 * Falle der Abfolge-Umstellung: decideIntro setzt beim ersten Aufruf den
 * sessionStorage-Marker «gesehen». Die Tests prüfen darum nicht nur, OB
 * gestartet wird, sondern auch, dass der Marker erst dann steht.
 */
function wire(storage: IntroStorage, gate = gateChannel()) {
  const channel = ageChannel();
  const onPlay = vi.fn();
  const onSkip = vi.fn();
  const decide = vi.fn(() =>
    decideIntro({ prefersReducedMotion: false, storage }),
  );
  const starter = createIntroStarter({
    decide,
    onAgeChange: channel.onAgeChange,
    isGateOpen: gate.isOpen,
    onGateChange: gate.onGateChange,
    onPlay,
    onSkip,
  });
  return { starter, channel, gate, onPlay, onSkip, decide };
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

describe("createIntroStarter — sichtbare Abfrage schlägt das Cookie (der Desktop-Bug)", () => {
  beforeEach(() => {
    resetIntroDecisionForTests();
  });

  it("ERSTBESUCH AUS SERVER-SICHT, Cookie sagt trotzdem «adult» (Cache/zweiter Tab): KEIN Start über der offenen Abfrage, kein Marker — das Intro kommt erst, wenn die Abfrage zu ist", () => {
    // Genau die gemeldete Desktop-Situation: das HTML kam ohne Cookie
    // zustande (Abfrage gerendert und offen), aber document.cookie trägt
    // bereits «18plus» — etwa weil ein Cache die cookielose Variante an
    // einen Browser mit Jahres-Cookie auslieferte oder ein zweiter Tab das
    // Cookie zwischen Request und Hydration setzte. Der alte Wächter
    // glaubte dem Cookie und spielte das Intro ÜBER der Abfrage — die
    // ploppte dann mitten in der Animation hervor.
    const storage = memoryStorage();
    const gate = gateChannel(true); // die Abfrage steht vor dem Besucher
    const { starter, onPlay, onSkip, decide } = wire(storage, gate);

    starter.begin("adult"); // Cookie-Wahrheit beim Mount

    // Solange die Abfrage offen ist: NICHTS — kein Play, kein decide,
    // und vor allem kein «gesehen»-Marker.
    expect(onPlay).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
    expect(decide).not.toHaveBeenCalled();
    expect(storage.data[INTRO_SESSION_KEY]).toBeUndefined();

    // Der Besucher bestätigt, ConsentGate räumt die Abfrage weg — JETZT
    // (und erst jetzt) startet das Intro, aus dem Stand.
    gate.set(false);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(storage.data[INTRO_SESSION_KEY]).toBe("1");
  });

  it("Bestätigungs-Klick: der Alters-Kanal meldet «adult», während die Abfrage noch im DOM steht — gestartet wird erst mit ihrem Schliessen", () => {
    const storage = memoryStorage();
    const gate = gateChannel(true);
    const { starter, channel, onPlay, decide } = wire(storage, gate);

    starter.begin(null);
    // writeAgeAnswer feuert synchron im Klick — React hat die Abfrage da
    // noch nicht weggeräumt.
    channel.fire("adult");
    expect(onPlay).not.toHaveBeenCalled();
    expect(decide).not.toHaveBeenCalled();

    // ConsentGate nimmt die Abfrage aus dem DOM (Layout-Effekt meldet zu).
    gate.set(false);
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it("Sperrseite bleibt Sperrseite: das Schliess-Signal allein startet nichts, solange das Alter nicht «adult» ist", () => {
    const storage = memoryStorage();
    const gate = gateChannel(true);
    const { starter, onPlay, decide } = wire(storage, gate);

    starter.begin(null);
    gate.set(false); // Abfrage weg, aber keine Bestätigung (z. B. Unmount)

    expect(onPlay).not.toHaveBeenCalled();
    expect(decide).not.toHaveBeenCalled();
    expect(storage.data[INTRO_SESSION_KEY]).toBeUndefined();
  });

  it("entschieden ist entschieden: nach dem Start ist auch der Sichtbarkeits-Kanal abbestellt", () => {
    const storage = memoryStorage();
    const gate = gateChannel(true);
    const { starter, channel, onPlay } = wire(storage, gate);

    starter.begin(null);
    channel.fire("adult");
    gate.set(false);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(gate.listenerCount).toBe(0);

    gate.set(true);
    gate.set(false); // späteres Auf/Zu (Footer o. Ä.) startet nichts mehr
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it("dispose bestellt auch den Sichtbarkeits-Kanal ab", () => {
    const storage = memoryStorage();
    const gate = gateChannel(true);
    const { starter, channel, onPlay } = wire(storage, gate);

    starter.begin("adult");
    starter.dispose();
    expect(gate.listenerCount).toBe(0);

    gate.set(false);
    channel.fire("adult");
    expect(onPlay).not.toHaveBeenCalled();
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

describe("ageGateOpen-Store — ConsentGate meldet die Sichtbarkeit der Abfrage", () => {
  beforeEach(() => {
    resetAgeGateOpenForTests();
  });

  it("initial zu (Seiten ohne Abfrage: Intro darf sofort), meldet Auf und Zu genau einmal", () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribeAgeGateOpen(() => seen.push(isAgeGateOpen()));

    expect(isAgeGateOpen()).toBe(false);
    setAgeGateOpen(true);
    setAgeGateOpen(true); // unverändert -> keine zweite Meldung
    setAgeGateOpen(false);

    expect(seen).toEqual([true, false]);
    unsubscribe();
    setAgeGateOpen(true);
    expect(seen).toEqual([true, false]);
  });
});
