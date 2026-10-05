import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BUSINESS, PAYMENT_METHODS, SHIPPING } from "./config";
import { formatPrice } from "./format";
import {
  formatRating,
  formatReviewCount,
  GOOGLE_PROFIL,
  paymentShortFormsCovered,
  SHIPS_FROM_COUNTRY,
  TRUST_ITEMS,
  trustItems,
} from "./trust";

/**
 * Jede Zeile der Vertrauensleiste ist eine Zusage. Diese Tests binden die
 * Texte an ihre Quelle (lib/config.ts, GOOGLE_PROFIL, FAQ) — ändert sich die
 * Tatsache, ohne dass der Text folgt, fällt der Test.
 */

const byId = (id: string) => {
  const item = TRUST_ITEMS.find((i) => i.id === id);
  if (!item) throw new Error(`Eintrag «${id}» fehlt`);
  return item;
};

describe("Vertrauensleiste — Texte an ihre Quellen gebunden", () => {
  it("hat genau vier Einträge, das Google-Profil zuerst (mobil sichtbar)", () => {
    expect(TRUST_ITEMS.map((i) => i.id)).toEqual([
      "google",
      "schweiz",
      "gratisversand",
      "zahlung",
    ]);
  });

  it("«Versand aus der Schweiz» setzt den Firmensitz in CH voraus", () => {
    expect(SHIPS_FROM_COUNTRY).toBe("CH");
    expect(byId("schweiz").text).toBe("Versand aus der Schweiz");
  });

  it("nennt die Gratisversand-Schwelle aus SHIPPING.freeThreshold", () => {
    expect(byId("gratisversand").text).toBe(
      `Gratisversand ab ${formatPrice(SHIPPING.freeThreshold)}`,
    );
    // Intl setzt ein geschütztes Leerzeichen zwischen Währung und Betrag.
    expect(byId("gratisversand").text).toMatch(/CHF\s69\.00$/);
  });

  it("nennt nur Zahlungsarten, die PAYMENT_METHODS auch anbietet", () => {
    expect(paymentShortFormsCovered()).toBe(true);
    const text = byId("zahlung").text;
    for (const short of ["TWINT", "Karte", "PostFinance"]) {
      expect(text).toContain(short);
      expect(
        PAYMENT_METHODS.some((m) =>
          m.label.toLowerCase().includes(short.toLowerCase()),
        ),
        short,
      ).toBe(true);
    }
  });

  it("verlinkt intern auf die belegenden Seiten", () => {
    expect(byId("schweiz").href).toBe("/service/versand");
    expect(byId("gratisversand").href).toBe("/service/versand");
    expect(byId("zahlung").href).toBe("/service/zahlungsarten");
    for (const i of TRUST_ITEMS.filter((i) => !i.external)) {
      expect(i.href).toMatch(/^\/[a-z]/);
    }
  });
});

describe("Google-Unternehmensprofil (GOOGLE_PROFIL)", () => {
  it("ist plausibel: Bewertung 1–5 mit einer Nachkommastelle, Anzahl ≥ 1, Datum, Maps-URL", () => {
    expect(GOOGLE_PROFIL.rating).toBeGreaterThanOrEqual(1);
    expect(GOOGLE_PROFIL.rating).toBeLessThanOrEqual(5);
    expect(Math.round(GOOGLE_PROFIL.rating * 10) / 10).toBe(GOOGLE_PROFIL.rating);
    expect(Number.isInteger(GOOGLE_PROFIL.count)).toBe(true);
    expect(GOOGLE_PROFIL.count).toBeGreaterThanOrEqual(1);
    expect(GOOGLE_PROFIL.stand).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(GOOGLE_PROFIL.stand).getTime()).toBeLessThanOrEqual(Date.now());
    expect(GOOGLE_PROFIL.url).toMatch(/^https:\/\/www\.google\.com\/maps\/place\//);
    // Dasselbe Ladenlokal wie die Anbieterkennzeichnung.
    expect(GOOGLE_PROFIL.url).toContain("Jibbit");
    expect(BUSINESS.city).toBe("Winterthur");
  });

  it("formatiert «5.0» und «26 Bewertungen» / «1 Bewertung»", () => {
    expect(formatRating(5)).toBe("5.0");
    expect(formatRating(4.75)).toBe("4.8");
    expect(formatReviewCount(26)).toBe("26 Bewertungen");
    expect(formatReviewCount(1)).toBe("1 Bewertung");
  });

  it("der Google-Eintrag zeigt genau die Zahlen des Profils und verlinkt extern darauf", () => {
    const g = byId("google");
    expect(g.text).toBe(
      `${formatRating(GOOGLE_PROFIL.rating)} bei Google · ${formatReviewCount(GOOGLE_PROFIL.count)}`,
    );
    expect(g.href).toBe(GOOGLE_PROFIL.url);
    expect(g.external).toBe(true);
    expect(g.icon).toBe("star");
    expect(g.ariaLabel).toContain("von 5 Sternen bei Google");
  });

  it("nimmt die Zahlen aus dem übergebenen Profil (Places API), nicht aus der Konstante", () => {
    const live = trustItems({
      rating: 4.6,
      count: 41,
      stand: "2026-12-01",
      url: GOOGLE_PROFIL.url,
      source: "places",
    });
    expect(live[0].text).toBe("4.6 bei Google · 41 Bewertungen");
  });

  it("nur das Profil trägt eine Zahl — keine erfundenen Noten in den anderen Zeilen", () => {
    const others = TRUST_ITEMS.filter((i) => i.id !== "google")
      .map((i) => i.text)
      .join(" ");
    expect(others).not.toMatch(/[★☆⭐]/);
    expect(others).not.toMatch(/\d\s*[.,]\s*\d\s*(\/|von|bei)\s*(5|Google)/);
    expect(others).not.toMatch(/\d+\s*(Sterne|Bewertungen|Rezensionen)/i);
    expect(others).not.toMatch(/\b(sehr gut|ausgezeichnet|exzellent|Top-?Shop)\b/i);
  });

  it("KEIN aggregateRating im JSON-LD — Google-eigene Bewertungen dürfen nicht selbst ausgezeichnet werden", () => {
    const jsonld = readFileSync(
      fileURLToPath(new URL("./seo/jsonld.ts", import.meta.url)),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(jsonld).not.toMatch(/aggregateRating|AggregateRating|ratingValue|reviewCount/);
  });
});
