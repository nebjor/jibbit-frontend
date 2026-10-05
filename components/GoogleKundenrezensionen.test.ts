import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Vertragstests auf dem QUELLTEXT der Komponente (vitest läuft in Node,
 * ohne React-Rendering — dasselbe Muster wie components/intro/SmokeCloud.test.ts).
 * Abgesichert wird, was ein Refactoring still kaputt machen könnte:
 *
 *  1. Client-Komponente mit next/script, afterInteractive — kein SSR des
 *     Google-Skripts, kein <script>-Tag von Hand.
 *  2. Die vier Wächter: Merchant-ID, eigene Domain (STORE.domain),
 *     Einwilligung (lib/consent/client), Nutzlast (payload.ts).
 *  3. `window.renderOptIn` wird definiert und über `?onload=renderOptIn`
 *     angesprochen — Googles dokumentierter Haken.
 *  4. Ein Merker gegen Doppelausführung.
 */

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

const tsx = read("./GoogleKundenrezensionen.tsx");
const page = read("../app/checkout/bestellung/[id]/page.tsx");
const code = tsx.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("GoogleKundenrezensionen — Ladevertrag", () => {
  it("ist eine Client-Komponente und lädt Googles Skript über next/script", () => {
    expect(tsx.startsWith('"use client";')).toBe(true);
    expect(code).toMatch(/from "next\/script"/);
    expect(code).toMatch(/strategy="afterInteractive"/);
    // Kein handgeschriebenes <script> (klein — gross ist next/script):
    // next/script dedupliziert und lädt erst nach der Hydration.
    expect(code).not.toMatch(/<script\b/);
    expect(code).not.toMatch(/dangerouslySetInnerHTML/);
    expect(code).not.toMatch(/document\.createElement\(\s*["']script/);
  });

  it("spricht Googles onload-Haken an und definiert renderOptIn davor", () => {
    expect(code).toContain(
      "https://apis.google.com/js/platform.js?onload=renderOptIn",
    );
    expect(code).toMatch(/window\.renderOptIn\s*=/);
    expect(code).toMatch(/gapi\?\.load\("surveyoptin"/);
    expect(code).toMatch(/surveyoptin\?\.render\(/);
  });
});

describe("GoogleKundenrezensionen — die vier Wächter", () => {
  it("rendert nur auf jibbits eigener Domain (STORE.domain)", () => {
    expect(code).toMatch(/domain === STORE\.domain/);
  });

  it("rendert nur mit Merchant-ID", () => {
    expect(code).toMatch(/merchantId !== null/);
  });

  it("hängt an der Einwilligung aus lib/consent — laden erst nach Erteilen", () => {
    expect(code).toMatch(/from "@\/lib\/consent\/client"/);
    expect(code).toMatch(/isAnalyticsAllowed\(\)/);
    expect(code).toMatch(/onConsentChange\(/);
  });

  it("baut die Nutzlast ausschliesslich über payload.ts (null => nichts)", () => {
    expect(code).toMatch(/kundenrezensionenPayload\(/);
    expect(code).toMatch(/from "@\/lib\/google-kundenrezensionen\/payload"/);
    // Keine Google-Feldnamen in der Komponente: die Nutzlast wird dort
    // gebaut, wo sie getestet ist.
    expect(code).not.toMatch(/estimated_delivery_date|delivery_country/);
  });

  it("führt render höchstens einmal pro Seitenansicht aus", () => {
    expect(code).toMatch(/useRef\(false\)/);
    expect(code).toMatch(/armed\.current = true/);
  });
});

describe("Bestätigungsseite — Einbindung", () => {
  it("reicht Merchant-ID (Laufzeit), Mandantendomain und Bestelldaten durch", () => {
    expect(page).toMatch(/<GoogleKundenrezensionen/);
    expect(page).toMatch(/merchantId=\{getKundenrezensionenMerchantId\(\)\}/);
    expect(page).toMatch(/domain=\{tenant\.theme\.domain\}/);
    for (const field of ["email", "countryCode", "createdAt", "gtins"]) {
      expect(page, field).toMatch(new RegExp(`\\b${field}:`));
    }
  });

  it("liest die Merchant-ID NICHT als NEXT_PUBLIC_ in den Build", () => {
    expect(tsx).not.toMatch(/NEXT_PUBLIC_/);
    expect(page).not.toMatch(/NEXT_PUBLIC_/);
    expect(read("../lib/google-kundenrezensionen/server.ts")).toMatch(
      /process\.env\.GOOGLE_KUNDENREZENSIONEN_MERCHANT_ID/,
    );
  });
});
