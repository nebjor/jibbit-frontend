import { describe, expect, it } from "vitest";
import {
  CONSENT_VERSION,
  isAnalyticsAllowed,
  overlayStep,
  parseAgeAnswer,
  parseConsent,
  serializeAgeAnswer,
  serializeConsent,
} from "./state";

// ---------------------------------------------------------------------------
// Altersantwort: Cookie-Wert <-> Zustand
// ---------------------------------------------------------------------------

describe("parseAgeAnswer", () => {
  it("erster Besuch: kein Cookie => unbeantwortet", () => {
    expect(parseAgeAnswer(undefined)).toBeNull();
    expect(parseAgeAnswer(null)).toBeNull();
    expect(parseAgeAnswer("")).toBeNull();
  });

  it("unbekannte/manipulierte Werte gelten als unbeantwortet", () => {
    expect(parseAgeAnswer("ja")).toBeNull();
    expect(parseAgeAnswer("true")).toBeNull();
    expect(parseAgeAnswer("18PLUS")).toBeNull();
  });

  it("beide Antworten überleben die Runde durchs Cookie", () => {
    expect(parseAgeAnswer(serializeAgeAnswer("adult"))).toBe("adult");
    expect(parseAgeAnswer(serializeAgeAnswer("minor"))).toBe("minor");
  });
});

// ---------------------------------------------------------------------------
// Einwilligung: Cookie-Wert <-> Entscheidung
// ---------------------------------------------------------------------------

describe("parseConsent", () => {
  const now = new Date("2026-09-04T12:00:00.000Z");

  it("kein Cookie => keine Einwilligung", () => {
    expect(parseConsent(undefined)).toBeNull();
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent("")).toBeNull();
  });

  it("kaputte Werte => keine Einwilligung (nie in Richtung erlaubt raten)", () => {
    expect(parseConsent("nicht-json")).toBeNull();
    expect(parseConsent("%7Bkaputt")).toBeNull();
    expect(parseConsent(encodeURIComponent('"nur-ein-string"'))).toBeNull();
    expect(parseConsent(encodeURIComponent("null"))).toBeNull();
  });

  it("falsche Formatversion => Einwilligung verfällt", () => {
    const old = encodeURIComponent(
      JSON.stringify({ v: CONSENT_VERSION + 1, analytics: true, ts: "x" }),
    );
    expect(parseConsent(old)).toBeNull();
  });

  it("analytics muss ein Boolean sein", () => {
    const bogus = encodeURIComponent(
      JSON.stringify({ v: CONSENT_VERSION, analytics: "true", ts: "x" }),
    );
    expect(parseConsent(bogus)).toBeNull();
  });

  it("erteilte und verweigerte Einwilligung überleben die Runde", () => {
    const granted = parseConsent(serializeConsent(true, now));
    expect(granted).toEqual({
      v: CONSENT_VERSION,
      analytics: true,
      ts: now.toISOString(),
    });

    const denied = parseConsent(serializeConsent(false, now));
    expect(denied).toEqual({
      v: CONSENT_VERSION,
      analytics: false,
      ts: now.toISOString(),
    });
  });
});

// ---------------------------------------------------------------------------
// Die eine Frage, an der PostHog später andockt
// ---------------------------------------------------------------------------

describe("isAnalyticsAllowed", () => {
  const now = new Date();

  it("ohne Einwilligung ist Analyse NICHT erlaubt (erster Besuch)", () => {
    expect(isAnalyticsAllowed(null)).toBe(false);
  });

  it("verweigerte Einwilligung: nicht erlaubt", () => {
    expect(isAnalyticsAllowed(parseConsent(serializeConsent(false, now)))).toBe(
      false,
    );
  });

  it("erteilte Einwilligung: erlaubt", () => {
    expect(isAnalyticsAllowed(parseConsent(serializeConsent(true, now)))).toBe(
      true,
    );
  });

  it("Widerruf: die neue Wahl überschreibt die alte", () => {
    // Erteilt …
    let cookie = serializeConsent(true, now);
    expect(isAnalyticsAllowed(parseConsent(cookie))).toBe(true);
    // … dann widerrufen (der Footer-Link schreibt denselben Cookie neu).
    cookie = serializeConsent(false, new Date(now.getTime() + 1000));
    expect(isAnalyticsAllowed(parseConsent(cookie))).toBe(false);
  });

  it("abgelaufene Formatversion zählt als kein Einverständnis", () => {
    const old = encodeURIComponent(
      JSON.stringify({ v: CONSENT_VERSION + 1, analytics: true, ts: "x" }),
    );
    expect(isAnalyticsAllowed(parseConsent(old))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Abfolge der Einblendungen: genau eine aufs Mal
// ---------------------------------------------------------------------------

describe("overlayStep", () => {
  const now = new Date();
  const granted = parseConsent(serializeConsent(true, now));
  const denied = parseConsent(serializeConsent(false, now));

  it("erster Besuch: zuerst die Altersabfrage — nicht der Cookie-Hinweis", () => {
    expect(overlayStep(null, null)).toBe("age-gate");
  });

  it("abgelehntes Alter: Sperrseite bleibt, kein Cookie-Hinweis obendrauf", () => {
    expect(overlayStep("minor", null)).toBe("age-gate");
    // Selbst mit (altem) Einwilligungs-Cookie bleibt die Sperre vorne.
    expect(overlayStep("minor", granted)).toBe("age-gate");
  });

  it("nach «ja, 18+» folgt der Cookie-Hinweis", () => {
    expect(overlayStep("adult", null)).toBe("consent-banner");
  });

  it("beides beantwortet: nichts mehr im Weg — egal wie die Wahl ausfiel", () => {
    expect(overlayStep("adult", granted)).toBe("none");
    expect(overlayStep("adult", denied)).toBe("none");
  });
});
