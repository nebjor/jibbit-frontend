import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Vertragstests auf dem QUELLTEXT (vitest läuft in Node, ohne React —
 * dasselbe Muster wie GoogleKundenrezensionen.test.ts):
 *
 *  1. Server-Komponente ohne Client-JS, Texte NUR aus lib/trust.ts, die
 *     Google-Zahl NUR aus lib/google-profil.ts (nie hartkodiert).
 *  2. Feste Höhe im CSS, eine Zeile, kein Umbruch (keine Layoutverschiebung).
 *  3. Externer Link (Google Maps) mit target=_blank und rel=noopener.
 *  4. Eingebaut in app/layout.tsx VOR dem Header; der alte Promo-Streifen
 *     ist aus Header.tsx verschwunden (ein Streifen, nicht zwei).
 */

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

const tsx = read("./TrustBar.tsx");
const css = read("./TrustBar.module.css");
const layout = read("../app/layout.tsx");
const header = read("./Header.tsx");
const headerCss = read("./Header.module.css");
const code = tsx.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("TrustBar — Aufbau", () => {
  it("ist eine (async) Server-Komponente ohne Client-JS", () => {
    expect(tsx).not.toMatch(/"use client"/);
    expect(code).not.toMatch(/from "react"/);
    expect(code).not.toMatch(/use(State|Effect|Ref)\(/);
    expect(code).not.toMatch(/next\/script/);
    expect(code).toMatch(/export async function TrustBar\(\)/);
  });

  it("nimmt Texte aus lib/trust.ts und die Google-Zahl aus lib/google-profil.ts", () => {
    expect(code).toMatch(/from "@\/lib\/trust"/);
    expect(code).toMatch(/from "@\/lib\/google-profil"/);
    expect(code).toMatch(/await getGoogleProfil\(\)/);
    expect(code).toMatch(/trustItems\(profil\)/);
    expect(code).toMatch(/\{item\.text\}/);
    // Kein hartkodierter Werbetext und keine Zahl in der Komponente —
    // Zusagen gehören in lib/trust.ts, wo ihre Quelle dokumentiert ist.
    expect(code).not.toMatch(/Versand|Gratis|TWINT|CHF|Bewertung|bei Google/);
    expect(code).not.toMatch(/\d\s*[.,]\s*\d\s*(\/|von|bei)/);
  });

  it("öffnet den externen Profil-Link sicher im neuen Tab", () => {
    expect(code).toMatch(/item\.external/);
    expect(code).toMatch(/target="_blank"/);
    expect(code).toMatch(/rel="noopener"/);
  });

  it("der Stern ist ein Symbol für das Profil, kein Text — und das CSS kennt keine Sterne", () => {
    expect(code).toMatch(/kind === "star"/);
    expect(code).not.toMatch(/[★☆⭐]/);
    expect(cssCode).not.toMatch(/[★☆⭐]/);
    expect(cssCode).not.toMatch(/\bstars?\b|\bsterne?\b|\brating\b/i);
  });

  it("hat eine feste Höhe und bricht nie um", () => {
    expect(css).toMatch(/\.bar\s*\{[^}]*\bheight:\s*28px/);
    expect(css).toMatch(/@media \(min-width: 768px\)[\s\S]*\.bar\s*\{[^}]*\bheight:\s*32px/);
    expect(css).toMatch(/white-space:\s*nowrap/);
    expect(css).toMatch(/overflow-x:\s*auto/);
    expect(css).toMatch(/scroll-snap-type/);
    // Nur Tokens, keine Farbliterale.
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe("TrustBar — Einbau", () => {
  it("steht in app/layout.tsx direkt vor dem Header", () => {
    expect(layout).toMatch(/<TrustBar \/>\s*<Header \/>/);
  });

  it("der alte Promo-Streifen ist aus dem Header verschwunden", () => {
    expect(header).not.toMatch(/styles\.promo/);
    expect(header).not.toMatch(/PRICE_CLAIM/);
    expect(headerCss).not.toMatch(/\.promo/);
  });
});
