import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Eigenschaftstests der Rauchwolke — auf dem QUELLTEXT von CSS-Modul,
 * Komponente und tokens.css (vitest läuft in Node, CSS-Module werden dort
 * nicht angewandt; ein Browser-Rendering gibt es im Test nicht).
 *
 * Abgesichert wird genau das, woran der Platzhalter gescheitert ist:
 *
 *  1. VOLLSTÄNDIGE DECKUNG während «grow»: eine Fläche mit inset: 0 wird
 *     innerhalb des smokeGrow-Budgets voll deckend — auf jedem
 *     Seitenverhältnis, unabhängig von der Schwaden-Geometrie. Auf breiten
 *     Bildschirmen bricht diese Eigenschaft zuerst.
 *  2. SICHTBARKEIT: der Rauchton (--c-smoke) setzt sich vom Intro-Grund
 *     (--c-ground) messbar ab — der alte --c-line-Schleier tat das nicht.
 *  3. VERTRAG: nur transform und opacity werden animiert (schwache
 *     Handys), und im Wolken-CSS steht kein Farbliteral (Colorway-Wechsel
 *     nimmt die Wolke mit).
 */

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

const css = read("./SmokeCloud.module.css");
const tsx = read("./SmokeCloud.tsx");
const tokens = read("../../app/tokens.css");

/** CSS-Kommentare raus, damit Prosa keine Treffer/Fehltreffer erzeugt. */
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Alle Regeln als { selector, body } — reicht für flaches Modul-CSS. */
const rules = [...cssCode.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({
  selector: m[1].trim(),
  body: m[2],
}));

function ruleWhere(pred: (selector: string) => boolean) {
  return rules.filter((r) => pred(r.selector));
}

/** Erster Basis-Block einer Klasse (ohne Zustands-Selektor davor). */
function baseBlock(cls: string): string {
  const rule = rules.find((r) =>
    r.selector.split(",").some((s) => s.trim() === `.${cls}`),
  );
  if (!rule) throw new Error(`Kein Basis-Block .${cls} gefunden`);
  return rule.body;
}

function tokenHex(source: string, name: string): string {
  const m = source.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\b`));
  if (!m) throw new Error(`Token ${name} nicht (als 6-stelliges Hex) gefunden`);
  return m[1];
}

/** Relative Luminanz nach WCAG. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrastRatio(hexA: string, hexB: string): number {
  const [lo, hi] = [luminance(hexA), luminance(hexB)].sort((a, b) => a - b);
  return (hi + 0.05) / (lo + 0.05);
}

describe("SmokeCloud: vollständige Deckung während «grow»", () => {
  it("hat eine Deckfläche mit inset: 0 in Wolkenfarbe", () => {
    const cover = baseBlock("cover");
    expect(cover).toMatch(/position:\s*absolute/);
    expect(cover).toMatch(/inset:\s*0/);
    expect(cover).toMatch(/background:\s*var\(--c-smoke\)/);
  });

  it("die Deckfläche wird in «grow» voll deckend und bleibt es in «fade»", () => {
    for (const state of ["grow", "fade"]) {
      const hit = ruleWhere(
        (sel) => sel.includes(`[data-state="${state}"]`) && sel.includes(".cover"),
      ).find((r) => /opacity:\s*1\b/.test(r.body));
      expect(hit, `Deckfläche muss in «${state}» opacity: 1 erreichen`).toBeDefined();
    }
  });

  it("Verzögerung + Dauer der Deckfläche bleiben im smokeGrow-Budget", () => {
    const cover = baseBlock("cover");
    const factors = [
      ...cover.matchAll(/calc\(var\(--t-smoke-grow\)\s*\*\s*([0-9.]+)\)/g),
    ].map((m) => Number(m[1]));
    expect(factors.length).toBeGreaterThanOrEqual(1);
    const sum = factors.reduce((a, b) => a + b, 0);
    // Übergang + Verzögerung müssen enden, BEVOR die Phase weiterschaltet.
    expect(sum).toBeLessThan(1);
    // Und feste ms-Dauern, die am Budget vorbeiliefen, gibt es nicht.
    expect(cover).not.toMatch(/transition[^;]*\b\d+m?s\b/);
  });

  it("die Komponente rendert die Deckfläche", () => {
    expect(tsx).toContain("styles.cover");
  });
});

describe("SmokeCloud: Sichtbarkeit der Farbe", () => {
  it("--c-smoke existiert in tokens.css und kontrastiert stark mit --c-ground", () => {
    const smoke = tokenHex(tokens, "--c-smoke");
    const ground = tokenHex(tokens, "--c-ground");
    // Der alte Fehler: --c-line (#dedcd7) auf --c-ground (#f6f5f3) lag bei
    // ~1.2:1 und war auf grossen Flächen unsichtbar. Wir verlangen einen
    // satten Abstand, nicht bloss «irgendwie anders».
    expect(contrastRatio(smoke, ground)).toBeGreaterThanOrEqual(4.5);
  });

  it("im Wolken-CSS steht kein Farbliteral — nur Tokens", () => {
    expect(cssCode).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(cssCode).not.toMatch(/\b(?:rgb|rgba|hsl|hsla|oklch|color)\s*\(/);
  });
});

describe("SmokeCloud: Vertrag der Austauschstelle", () => {
  it("animiert ausschliesslich transform und opacity", () => {
    for (const { selector, body } of rules) {
      for (const m of body.matchAll(/transition:\s*([^;]+)(?:;|$)/g)) {
        // calc()/var()-Ausdrücke hier sind kommafrei — einfacher Split reicht.
        for (const part of m[1].split(",")) {
          const property = part.trim().split(/\s+/)[0];
          if (!property) continue;
          expect(
            ["transform", "opacity"],
            `Übergang «${property}» in «${selector}» ist nicht erlaubt`,
          ).toContain(property);
        }
      }
      const transitionProps = body.match(/transition-property:\s*([^;]+)/);
      if (transitionProps) {
        for (const p of transitionProps[1].split(",")) {
          expect(["transform", "opacity"]).toContain(p.trim());
        }
      }
    }
  });

  it("im Zustand «gone» ist die Wolke abgeschaltet (display: none)", () => {
    const gone = ruleWhere((sel) => sel.includes('[data-state="gone"]'));
    expect(gone.some((r) => /display:\s*none/.test(r.body))).toBe(true);
  });
});
