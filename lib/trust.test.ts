import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BUSINESS, SHIPPING } from "./config";
import { formatPrice } from "./format";
import {
  formatRating,
  formatReviewCount,
  GOOGLE_PROFIL,
  googleTrustItem,
  paymentMethodsOffered,
  profilOhneZahl,
  SHIPS_FROM_COUNTRY,
  TRUST_FACTS,
} from "./trust";

/**
 * Jede Zeile der Vertrauenszeile ist eine Zusage. Diese Tests binden die
 * Texte an ihre Quelle (lib/config.ts, Places-Profil) — ändert sich die
 * Tatsache, ohne dass der Text folgt, fällt der Test.
 */

const byId = (id: string) => {
  const item = TRUST_FACTS.find((i) => i.id === id);
  if (!item) throw new Error(`Eintrag «${id}» fehlt`);
  return item;
};

describe("Fakten — Texte an ihre Quellen gebunden", () => {
  it("sind genau drei, in dieser Reihenfolge", () => {
    expect(TRUST_FACTS.map((i) => i.id)).toEqual(["schweiz", "gratisversand", "zahlung"]);
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

  it("«Sichere Zahlung» setzt angebotene Zahlungsarten voraus und verlinkt die Seite dazu", () => {
    expect(paymentMethodsOffered()).toBe(true);
    expect(byId("zahlung").text).toBe("Sichere Zahlung");
    expect(byId("zahlung").href).toBe("/service/zahlungsarten");
  });

  it("verlinken intern auf die belegenden Seiten", () => {
    expect(byId("schweiz").href).toBe("/service/versand");
    expect(byId("gratisversand").href).toBe("/service/versand");
    for (const i of TRUST_FACTS) expect(i.href).toMatch(/^\/[a-z]/);
  });

  it("tragen keine Sterne, Noten oder Rezensionszahlen", () => {
    const all = TRUST_FACTS.map((i) => i.text).join(" ");
    expect(all).not.toMatch(/[★☆⭐]/);
    expect(all).not.toMatch(/\d\s*[.,]\s*\d\s*(\/|von|bei)\s*(5|Google)/);
    expect(all).not.toMatch(/\d+\s*(Sterne|Bewertungen|Rezensionen)/i);
    expect(all).not.toMatch(/\b(sehr gut|ausgezeichnet|exzellent|Top-?Shop)\b/i);
  });
});

describe("Google-Unternehmensprofil", () => {
  it("GOOGLE_PROFIL kennt nur Identität und Link — KEINE Zahlen im Code", () => {
    expect(Object.keys(GOOGLE_PROFIL).sort()).toEqual(["name", "textQuery", "url"]);
    expect(GOOGLE_PROFIL.url).toMatch(/^https:\/\/www\.google\.com\/maps\/place\//);
    expect(GOOGLE_PROFIL.url).toContain("Jibbit");
    // Dasselbe Ladenlokal wie die Anbieterkennzeichnung.
    expect(GOOGLE_PROFIL.textQuery).toContain(BUSINESS.street);
    expect(GOOGLE_PROFIL.textQuery).toContain(BUSINESS.city);
  });

  it("formatiert «5.0» und «26 Bewertungen» / «1 Bewertung»", () => {
    expect(formatRating(5)).toBe("5.0");
    expect(formatRating(4.75)).toBe("4.8");
    expect(formatReviewCount(26)).toBe("26 Bewertungen");
    expect(formatReviewCount(1)).toBe("1 Bewertung");
  });

  it("mit Zahl: Text, Sterne und vorlesbare Langform aus dem übergebenen Profil", () => {
    const g = googleTrustItem({
      url: GOOGLE_PROFIL.url,
      rating: 4.6,
      count: 41,
      stand: "2026-12-01",
      source: "places",
    });
    expect(g.text).toBe("4.6 bei Google · 41 Bewertungen");
    expect(g.rating).toBe(4.6);
    expect(g.href).toBe(GOOGLE_PROFIL.url);
    expect(g.ariaLabel).toBe(
      "4.6 von 5 Sternen bei Google, 41 Bewertungen — Unternehmensprofil auf Google Maps öffnen",
    );
  });

  it("ohne Zahl: «Bewertungen auf Google» als Link, keine Sterne, keine Ziffer", () => {
    const g = googleTrustItem(profilOhneZahl());
    expect(g.text).toBe("Bewertungen auf Google");
    expect(g.rating).toBeNull();
    expect(g.href).toBe(GOOGLE_PROFIL.url);
    expect(g.text).not.toMatch(/\d/);
    expect(g.ariaLabel).not.toMatch(/\d/);
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
