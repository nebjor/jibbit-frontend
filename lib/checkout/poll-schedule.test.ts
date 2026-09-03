import { describe, expect, it } from "vitest";
import {
  FAST_ATTEMPTS,
  FAST_DELAY_MS,
  SLOW_DELAY_MS,
  TOTAL_ATTEMPTS,
  delayBeforeAttempt,
} from "./poll-schedule";

/**
 * Regression: Die Rückkehrseite hörte nach Phase 1 auf zu fragen. Traf die
 * Zahlungsbestätigung später ein, blieb der Kunde auf «wir warten» stehen,
 * obwohl die Bestellung existierte.
 */
describe("Abfragetakt der Rückkehrseite", () => {
  it("wartet vor dem ersten Versuch nicht", () => {
    expect(delayBeforeAttempt(1)).toBe(0);
  });

  it("fragt in Phase 1 dicht nach", () => {
    expect(delayBeforeAttempt(2)).toBe(FAST_DELAY_MS);
    expect(delayBeforeAttempt(FAST_ATTEMPTS)).toBe(FAST_DELAY_MS);
  });

  it("schaltet danach auf den langsamen Takt", () => {
    expect(delayBeforeAttempt(FAST_ATTEMPTS + 1)).toBe(SLOW_DELAY_MS);
    expect(delayBeforeAttempt(TOTAL_ATTEMPTS)).toBe(SLOW_DELAY_MS);
  });

  it("hört nicht schon nach zwanzig Sekunden auf", () => {
    // Das war der gemeldete Fehler: Phase 1 allein sind ~20 s.
    const fensterPhase1 = (FAST_ATTEMPTS - 1) * FAST_DELAY_MS;
    expect(fensterPhase1).toBeLessThan(30_000);

    let gesamt = 0;
    for (let a = 1; a <= TOTAL_ATTEMPTS; a++) gesamt += delayBeforeAttempt(a);
    expect(gesamt).toBeGreaterThan(150_000); // deutlich über zwei Minuten
  });

  it("bleibt unter fuenf Minuten — danach ist Warten im Browser sinnlos", () => {
    let gesamt = 0;
    for (let a = 1; a <= TOTAL_ATTEMPTS; a++) gesamt += delayBeforeAttempt(a);
    expect(gesamt).toBeLessThan(300_000);
  });
});
