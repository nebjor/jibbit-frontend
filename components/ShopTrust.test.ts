import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Vertragstests auf dem QUELLTEXT (vitest läuft in Node, ohne React —
 * dasselbe Muster wie GoogleKundenrezensionen.test.ts):
 *
 *  1. Async Server-Komponente ohne Client-JS; Texte NUR aus lib/trust.ts,
 *     die Google-Zahl NUR aus lib/google-profil.ts (nie hartkodiert).
 *  2. Ohne Zahl keine Sterne-Grafik (nur ein Umriss-Stern als Symbol).
 *  3. Externer Profil-Link mit target=_blank und rel=noopener.
 *  4. Eingebaut im Shop-Kopf (app/page.tsx, app/suche/page.tsx), NICHT im
 *     Layout; der Promo-Streifen im Header steht wie auf main.
 */

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

const tsx = read("./ShopTrust.tsx");
const css = read("./ShopTrust.module.css");
const layout = read("../app/layout.tsx");
const home = read("../app/page.tsx");
const suche = read("../app/suche/page.tsx");
const header = read("./Header.tsx");
const code = tsx.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("ShopTrust — Aufbau", () => {
  it("ist eine async Server-Komponente ohne Client-JS", () => {
    expect(tsx).not.toMatch(/"use client"/);
    expect(code).not.toMatch(/from "react"/);
    expect(code).not.toMatch(/use(State|Effect|Ref)\(/);
    expect(code).toMatch(/export async function ShopTrust\(\)/);
  });

  it("nimmt Texte aus lib/trust.ts und die Google-Zahl aus lib/google-profil.ts", () => {
    expect(code).toMatch(/from "@\/lib\/trust"/);
    expect(code).toMatch(/from "@\/lib\/google-profil"/);
    expect(code).toMatch(/await getGoogleProfil\(\)/);
    expect(code).toMatch(/googleTrustItem\(profil\)/);
    expect(code).toMatch(/TRUST_FACTS\.map\(/);
    expect(code).toMatch(/\{google\.text\}/);
    expect(code).toMatch(/\{fact\.text\}/);
    // Kein hartkodierter Werbetext und keine Zahl in der Komponente.
    expect(code).not.toMatch(/Versand|Gratis|TWINT|CHF|Bewertung|bei Google/);
    expect(code).not.toMatch(/\d\s*[.,]\s*\d\s*(\/|von|bei)/);
  });

  it("zeigt Sterne nur mit Zahl — sonst einen einzelnen Umriss-Stern", () => {
    expect(code).toMatch(/google\.rating === null\s*\?\s*\(\s*<Star className=\{styles\.starSingle\} filled=\{false\}/);
    expect(code).toMatch(/<Stars rating=\{google\.rating\} \/>/);
    // Füllung proportional zur Bewertung, nicht gerundet.
    expect(code).toMatch(/\(rating \/ 5\) \* 100/);
    expect(cssCode).toMatch(/\.starFill\s*\{[^}]*overflow:\s*hidden/);
    expect(code).not.toMatch(/[★☆⭐]/);
  });

  it("öffnet den externen Profil-Link sicher im neuen Tab", () => {
    expect(code).toMatch(/href=\{google\.href\}/);
    expect(code).toMatch(/target="_blank"/);
    expect(code).toMatch(/rel="noopener"/);
    expect(code).toMatch(/aria-label=\{google\.ariaLabel\}/);
  });

  it("nur Tokens im CSS, keine Farbliterale", () => {
    expect(cssCode).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe("ShopTrust — Einbau", () => {
  it("steht im Shop-Kopf (Katalog und Suche), nicht im Layout", () => {
    expect(home).toMatch(/<ShopTrust \/>/);
    expect(suche).toMatch(/<ShopTrust \/>/);
    expect(layout).not.toMatch(/ShopTrust|TrustBar/);
  });

  it("der Promo-Streifen im Header steht wie auf main", () => {
    expect(header).toMatch(/styles\.promo/);
    expect(header).toMatch(/PRICE_CLAIM\.short/);
  });
});
