import { describe, expect, it } from "vitest";
import {
  BURN_PLAYED_KEY,
  BURN_TOTAL_MS,
  decideBurnClick,
  hasBurnPlayed,
  markBurnPlayed,
  type BurnClickContext,
  type BurnMemory,
} from "./burn-cta";

/** Ein Klick ohne Besonderheiten — die Tests überschreiben je ein Feld. */
function plainClick(overrides: Partial<BurnClickContext> = {}): BurnClickContext {
  return {
    running: false,
    modifiedClick: false,
    reducedMotion: false,
    alreadyPlayed: false,
    overlayOpen: false,
    ...overrides,
  };
}

/** sessionStorage-Attrappe, die sich wie die echte verhält. */
function fakeMemory(): BurnMemory & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
  };
}

/** Storage, dessen ZUGRIFFE werfen — privater Modus mancher Browser. */
function throwingMemory(): BurnMemory {
  return {
    getItem() {
      throw new DOMException("blocked", "SecurityError");
    },
    setItem() {
      throw new DOMException("blocked", "SecurityError");
    },
  };
}

// ---------------------------------------------------------------------------
// Die Klick-Entscheidung
// ---------------------------------------------------------------------------

describe("decideBurnClick", () => {
  it("erster Klick der Sitzung: brennen", () => {
    expect(decideBurnClick(plainClick())).toBe("animate");
  });

  it("prefers-reduced-motion: SOFORT weiterleiten, nicht abgeschwächt animieren", () => {
    expect(decideBurnClick(plainClick({ reducedMotion: true }))).toBe(
      "navigate",
    );
  });

  it("schon gelaufen in dieser Sitzung: still weiterleiten", () => {
    expect(decideBurnClick(plainClick({ alreadyPlayed: true }))).toBe(
      "navigate",
    );
  });

  it("zweiter Klick während der Animation: schlucken, nichts verdoppeln", () => {
    expect(decideBurnClick(plainClick({ running: true }))).toBe("ignore");
  });

  it("Einblendung (Altersabfrage/Cookie-Hinweis) vorne: keine Animation", () => {
    expect(decideBurnClick(plainClick({ overlayOpen: true }))).toBe(
      "navigate",
    );
  });

  it("Modifikator-Klick gehört dem Browser — auch während der Animation", () => {
    expect(decideBurnClick(plainClick({ modifiedClick: true }))).toBe(
      "navigate",
    );
    expect(
      decideBurnClick(plainClick({ modifiedClick: true, running: true })),
    ).toBe("navigate");
    expect(
      decideBurnClick(plainClick({ modifiedClick: true, reducedMotion: true })),
    ).toBe("navigate");
  });
});

// ---------------------------------------------------------------------------
// Einmal je Sitzung — das Gedächtnis
// ---------------------------------------------------------------------------

describe("hasBurnPlayed / markBurnPlayed", () => {
  it("frische Sitzung: noch nicht gelaufen", () => {
    expect(hasBurnPlayed(fakeMemory())).toBe(false);
  });

  it("nach markBurnPlayed gilt die Sitzung als verbraucht", () => {
    const memory = fakeMemory();
    markBurnPlayed(memory);
    expect(hasBurnPlayed(memory)).toBe(true);
    expect(memory.store.get(BURN_PLAYED_KEY)).toBe("1");
  });

  it("gelaufen => der nächste Klick navigiert nur noch", () => {
    const memory = fakeMemory();
    markBurnPlayed(memory);
    expect(
      decideBurnClick(plainClick({ alreadyPlayed: hasBurnPlayed(memory) })),
    ).toBe("navigate");
  });

  it("kein Storage (Zugriff auf sessionStorage warf): alles läuft weiter", () => {
    expect(hasBurnPlayed(null)).toBe(false);
    expect(() => markBurnPlayed(null)).not.toThrow();
  });

  it("werfendes Storage macht nichts kaputt — weder Lesen noch Schreiben", () => {
    const memory = throwingMemory();
    expect(hasBurnPlayed(memory)).toBe(false);
    expect(() => markBurnPlayed(memory)).not.toThrow();
    // und die Entscheidung bleibt funktionsfähig: Animation darf laufen
    expect(
      decideBurnClick(plainClick({ alreadyPlayed: hasBurnPlayed(memory) })),
    ).toBe("animate");
  });

  it("fremde Werte im Schlüssel zählen nicht als gelaufen", () => {
    const memory = fakeMemory();
    memory.store.set(BURN_PLAYED_KEY, "true");
    expect(hasBurnPlayed(memory)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Die harte Obergrenze
// ---------------------------------------------------------------------------

describe("BURN_TOTAL_MS", () => {
  it("bleibt unter einer Sekunde — länger wirkt langsam, nicht aufwendig", () => {
    expect(BURN_TOTAL_MS).toBeLessThan(1000);
  });
});
