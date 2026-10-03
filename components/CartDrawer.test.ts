import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Vertragstests der Schubladen-Animation auf dem QUELLTEXT (vitest läuft in
 * Node, kein DOM). Abgesichert wird, was die Bewegung trägt:
 *
 *  1. Beide Zustände (`data-state` open/closed) sind im CSS beschrieben,
 *     und zwar ausschliesslich über transform und opacity.
 *  2. Die Komponente hält die Schublade während des Austritts im DOM
 *     (usePresence) und sperrt das Scrollen über den gemeinsamen Hook —
 *     kein eigenes `document.body.style.overflow` mehr (das war der
 *     Layout-Shift).
 *  3. Reduzierte Bewegung schiebt nicht.
 */

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

const css = read("./CartDrawer.module.css").replace(/\/\*[\s\S]*?\*\//g, "");
const tsx = read("./CartDrawer.tsx");
const tokens = read("../app/tokens.css");

const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({
  selector: m[1].trim(),
  body: m[2],
}));
const bodyOf = (selector: string) =>
  rules.find((r) => r.selector === selector)?.body ?? "";

describe("CartDrawer — Öffnen/Schliessen", () => {
  it("Panel und Scrim haben einen geschlossenen Ausgangszustand mit Transition", () => {
    expect(bodyOf(".panel")).toMatch(/transform:\s*translateX\(100%\)/);
    expect(bodyOf(".panel")).toMatch(/transition:\s*transform/);
    expect(bodyOf(".scrim")).toMatch(/opacity:\s*0/);
    expect(bodyOf(".scrim")).toMatch(/transition:\s*opacity/);
  });

  it("der offene Zustand hängt an data-state=open", () => {
    expect(bodyOf('.overlay[data-state="open"] .panel')).toMatch(
      /transform:\s*none/,
    );
    expect(bodyOf('.overlay[data-state="open"] .scrim')).toMatch(
      /opacity:\s*1/,
    );
  });

  it("animiert nur transform und opacity", () => {
    for (const r of rules) {
      for (const m of r.body.matchAll(/transition(?:-property)?:\s*([^;]+);/g)) {
        for (const prop of m[1].split(",").map((p) => p.trim().split(/\s+/)[0])) {
          expect(["transform", "opacity"]).toContain(prop);
        }
      }
    }
  });

  it("reduzierte Bewegung: kein Schieben", () => {
    const reduced = css.match(
      /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/,
    );
    expect(reduced).not.toBeNull();
    expect(reduced![1]).toMatch(/\.panel\s*\{[^}]*transform:\s*none/);
  });

  it("die Dauer-Tokens existieren", () => {
    for (const token of ["--dur-overlay", "--dur-overlay-out", "--ease-in"]) {
      expect(css).toContain(`var(${token})`);
      expect(tokens).toMatch(new RegExp(`${token}:\\s*[^;]+;`));
    }
  });

  it("bleibt während des Austritts im DOM und ist dabei inert", () => {
    expect(tsx).toMatch(/usePresence\(isOpen, panelRef\)/);
    expect(tsx).toMatch(/if \(!presence\.mounted\) return null/);
    expect(tsx).toMatch(/data-state=\{presence\.state\}/);
    expect(tsx).toMatch(/inert=\{!isOpen \|\| undefined\}/);
    expect(tsx).toMatch(/onTransitionEnd=\{presence\.onTransitionEnd\}/);
  });

  it("sperrt das Scrollen über den gemeinsamen Hook, nicht per Hand", () => {
    // Gesperrt bis zum Aushängen, nicht nur bis isOpen=false — sonst springt
    // das hinausfahrende Panel, wenn die Scrollleiste zurückkommt.
    expect(tsx).toMatch(/useScrollLock\(presence\.mounted\)/);
    expect(tsx).not.toMatch(/document\.body\.style/);
    // Auch die anderen Overlays teilen die Sperre.
    expect(read("./search/SearchBox.tsx")).not.toMatch(/document\.body\.style/);
    expect(read("./consent/ConsentGate.tsx")).not.toMatch(/document\.body\.style/);
  });
});
