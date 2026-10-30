import { describe, expect, it } from "vitest";
import {
  bannerUeberschrift,
  dismissKey,
  formatGiltBis,
  formatRestzeit,
  heroAktion,
  parseAktionen,
  produktHinweis,
  restMillisekunden,
  waehleBanner,
} from "./aktionen";

const JETZT = Date.parse("2026-10-29T18:48:00Z");
const MIN = 60_000;
const H = 60 * MIN;

const roh = (over: Record<string, unknown> = {}) => ({
  code: "EROEFFNUNG20",
  titel: "Eröffnung",
  prozent: 20,
  gilt_ab: "2026-10-29T17:30:00Z",
  gilt_bis: "2026-10-30T18:30:00Z",
  nur_teilsortiment: false,
  auf_artikel: true,
  ...over,
});

describe("formatRestzeit", () => {
  it("Stunden und Minuten", () => {
    expect(formatRestzeit(23 * H + 12 * MIN)).toBe("23 h 12 min");
    expect(formatRestzeit(1 * H)).toBe("1 h 0 min");
  });
  it("nur Minuten unter einer Stunde", () => {
    expect(formatRestzeit(45 * MIN + 59_000)).toBe("45 min");
  });
  it("unter einer Minute", () => {
    expect(formatRestzeit(59_999)).toBe("weniger als 1 min");
  });
  it("ab 24 Stunden in Tagen", () => {
    expect(formatRestzeit(24 * H)).toBe("1 Tag");
    expect(formatRestzeit(25 * H + 59 * MIN)).toBe("1 Tag 1 h");
    expect(formatRestzeit(50 * H)).toBe("2 Tage 2 h");
  });
});

describe("restMillisekunden", () => {
  it("rechnet bis zum Ende", () => {
    expect(restMillisekunden("2026-10-30T18:30:00Z", JETZT)).toBe(23 * H + 42 * MIN);
  });
  it("abgelaufen, unbefristet oder kaputt → null", () => {
    expect(restMillisekunden("2026-10-29T18:48:00Z", JETZT)).toBeNull();
    expect(restMillisekunden("2026-10-01T00:00:00Z", JETZT)).toBeNull();
    expect(restMillisekunden(null, JETZT)).toBeNull();
    expect(restMillisekunden("kein Datum", JETZT)).toBeNull();
  });
});

describe("parseAktionen", () => {
  it("mappt eine laufende Aktion nach camelCase", () => {
    expect(parseAktionen({ aktionen: [roh()] }, JETZT)).toEqual([
      {
        code: "EROEFFNUNG20",
        titel: "Eröffnung",
        prozent: 20,
        betrag: undefined,
        waehrung: undefined,
        giltAb: "2026-10-29T17:30:00Z",
        giltBis: "2026-10-30T18:30:00Z",
        nurTeilsortiment: false,
        aufArtikel: true,
      },
    ]);
  });
  it("verwirft abgelaufene und noch nicht gestartete", () => {
    expect(parseAktionen({ aktionen: [roh({ gilt_bis: "2026-10-29T18:00:00Z" })] }, JETZT)).toEqual([]);
    expect(parseAktionen({ aktionen: [roh({ gilt_ab: "2026-10-29T19:30:00Z" })] }, JETZT)).toEqual([]);
  });
  it("unbefristet ist erlaubt", () => {
    expect(parseAktionen({ aktionen: [roh({ gilt_ab: null, gilt_bis: null })] }, JETZT)).toHaveLength(1);
  });
  it("verwirft Einträge ohne Code oder ohne Rabattwert", () => {
    const liste = [roh({ code: "" }), roh({ prozent: 0 }), roh({ prozent: undefined }), null, "x"];
    expect(parseAktionen({ aktionen: liste }, JETZT)).toEqual([]);
  });
  it("Fremdes → leere Liste", () => {
    for (const x of [null, undefined, "x", 3, {}, { aktionen: "x" }]) {
      expect(parseAktionen(x, JETZT)).toEqual([]);
    }
  });
});

describe("Texte", () => {
  const a = (over = {}) => parseAktionen({ aktionen: [roh(over)] }, JETZT)[0];
  it("Überschrift", () => {
    expect(bannerUeberschrift(a())).toBe("Zusätzlich 20 % auf alles");
    expect(bannerUeberschrift(a({ nur_teilsortiment: true }))).toBe("Zusätzlich 20 % auf ausgewählte Artikel");
    expect(bannerUeberschrift(a({ prozent: undefined, betrag: 5, waehrung: "CHF" }))).toBe(
      "CHF 5 Rabatt auf deinen Einkauf",
    );
  });
  it("Produkthinweis nur bei Prozent-Aktion auf das ganze Sortiment", () => {
    expect(produktHinweis([a()])).toBe("Zusätzlich 20 % Aktionsrabatt wird an der Kasse abgezogen");
    expect(produktHinweis([a({ nur_teilsortiment: true })])).toBeNull();
    expect(produktHinweis([a({ auf_artikel: false })])).toBeNull();
    expect(produktHinweis([a({ prozent: undefined, betrag: 5 })])).toBeNull();
    expect(produktHinweis([])).toBeNull();
  });
  it("wählt die zuerst endende Aktion", () => {
    const spaet = a({ code: "B", gilt_bis: "2026-11-30T00:00:00Z" });
    const frueh = a({ code: "A" });
    const offen = a({ code: "C", gilt_bis: null });
    expect(waehleBanner([offen, spaet, frueh])?.code).toBe("A");
    expect(waehleBanner([])).toBeUndefined();
  });
  it("Merker-Schlüssel hängt am Code der Aktion", () => {
    expect(dismissKey({ code: "X" })).not.toBe(dismissKey({ code: "Y" }));
  });
});

describe("formatGiltBis / heroAktion", () => {
  it("schreibt das Ende in Schweizer Zeit (Sommerzeit)", () => {
    expect(formatGiltBis("2026-10-30T18:30:00.000Z")).toBe("30. Oktober, 19:30 Uhr");
  });

  it("schreibt das Ende in Schweizer Zeit (Winterzeit)", () => {
    expect(formatGiltBis("2026-12-01T08:05:00.000Z")).toBe("1. Dezember, 09:05 Uhr");
  });

  it("rollt über Mitternacht in Zürcher Zeit", () => {
    expect(formatGiltBis("2026-03-31T22:30:00.000Z")).toBe("1. April, 00:30 Uhr");
  });

  it("gibt bei ungültigem Datum null zurück", () => {
    expect(formatGiltBis("morgen")).toBeNull();
  });

  const basis = { code: "A", titel: "", giltAb: null, giltBis: null, aufArtikel: true };
  it("nimmt für den Hero nur Aktionen auf das ganze Sortiment", () => {
    expect(heroAktion([{ ...basis, nurTeilsortiment: true, prozent: 10 }])).toBeUndefined();
    expect(heroAktion([{ ...basis, aufArtikel: false, nurTeilsortiment: false, prozent: 10 }])).toBeUndefined();
    expect(heroAktion([{ ...basis, nurTeilsortiment: false, prozent: 10 }])?.code).toBe("A");
  });
});
