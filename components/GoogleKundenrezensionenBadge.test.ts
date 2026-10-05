import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Vertragstests auf dem QUELLTEXT (Muster: GoogleKundenrezensionen.test.ts).
 * Die Entscheidungslogik selbst ist in lib/google-kundenrezensionen/badge.test.ts
 * geprüft; hier geht es darum, dass die Komponente sie auch BENUTZT und das
 * Skript nur über next/script nach erteilter Einwilligung lädt.
 */

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

const tsx = read("./GoogleKundenrezensionenBadge.tsx");
const layout = read("../app/layout.tsx");
const server = read("../lib/google-kundenrezensionen/server.ts");
const optIn = read("./GoogleKundenrezensionen.tsx");
const code = tsx.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("GoogleKundenrezensionenBadge — Ladevertrag", () => {
  it("ist eine Client-Komponente und lädt Googles Skript über next/script", () => {
    expect(tsx.startsWith('"use client";')).toBe(true);
    expect(code).toMatch(/from "next\/script"/);
    expect(code).toMatch(/strategy="afterInteractive"/);
    expect(code).not.toMatch(/<script\b/);
    expect(code).not.toMatch(/dangerouslySetInnerHTML/);
    expect(code).not.toMatch(/document\.createElement\(\s*["']script/);
  });

  it("entscheidet über badgeConfigured/badgeAllowed aus lib — nicht mit eigener Logik", () => {
    expect(code).toMatch(/from "@\/lib\/google-kundenrezensionen\/badge"/);
    expect(code).toMatch(/badgeConfigured\(\{ enabled, merchantId, domain \}\)/);
    expect(code).toMatch(/badgeAllowed\(\{ enabled, merchantId, domain, consent \}\)/);
    expect(code).toMatch(/src=\{MERCHANT_WIDGET_SRC\}/);
    expect(code).toMatch(/merchantwidget\?\.start\(\{ \.\.\.MERCHANT_WIDGET_OPTIONS \}\)/);
    // Keine zweite Skript-URL in der Komponente.
    expect(code).not.toMatch(/https?:\/\//);
  });

  it("hängt an der Einwilligung aus lib/consent — laden erst nach Erteilen", () => {
    expect(code).toMatch(/from "@\/lib\/consent\/client"/);
    // Cookie als externe Quelle: Momentaufnahme + Abonnement, Server «nein».
    expect(code).toMatch(/useSyncExternalStore\(\s*subscribeConsent,\s*isAnalyticsAllowed,\s*\(\) => false,?\s*\)/);
    expect(code).toMatch(/onConsentChange\(/);
    // Ohne alle vier Wächter kein Script-Element — die Komponente rendert null.
    expect(code).toMatch(/if \(!badgeAllowed\(\{ enabled, merchantId, domain, consent \}\)\) return null;/);
  });

  it("startet das Widget höchstens einmal", () => {
    expect(code).toMatch(/useRef\(false\)/);
    expect(code).toMatch(/started\.current = true/);
  });

  it("lässt das Opt-in-Modul (#60) unangetastet — eigenes Skript, kein platform.js", () => {
    expect(code).not.toMatch(/platform\.js|renderOptIn|renderBadge|ratingbadge/);
    expect(optIn).toContain(
      "https://apis.google.com/js/platform.js?onload=renderOptIn",
    );
  });
});

describe("Layout — Einbindung und Schalter", () => {
  it("reicht Schalter, Merchant-ID (Laufzeit) und Mandantendomain durch", () => {
    expect(layout).toMatch(/<GoogleKundenrezensionenBadge/);
    expect(layout).toMatch(/enabled=\{badgeEnabled\}/);
    expect(layout).toMatch(/merchantId=\{merchantId\}/);
    expect(layout).toMatch(/domain=\{tenant\.theme\.domain\}/);
  });

  it("liest den Schalter serverseitig zur Laufzeit, nicht als NEXT_PUBLIC_", () => {
    expect(server).toMatch(/process\.env\.GOOGLE_KUNDENREZENSIONEN_BADGE/);
    expect(server).toMatch(/parseBadgeSwitch\(/);
    expect(tsx).not.toMatch(/NEXT_PUBLIC_|process\.env/);
  });
});
