import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaymentIcons } from "./PaymentIcons";

/**
 * Zahlungsarten-Leiste im Footer: sechs echte Markenlogos als Inline-SVG.
 * Geprüft wird der Vertrag, nicht die Geometrie — Screenreader-Namen,
 * Markenfarben, SSR ohne Client-JS und ein Grössenbudget fürs HTML.
 */

const LABELS = [
  "TWINT",
  "Visa",
  "Mastercard",
  "PostFinance",
  "Apple Pay",
  "Google Pay",
];

const html = renderToStaticMarkup(createElement(PaymentIcons));

describe("PaymentIcons", () => {
  it("nennt jede Marke per role=img + aria-label, in der gewohnten Reihenfolge", () => {
    const labels = [...html.matchAll(/<svg[^>]*aria-label="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(labels).toEqual(LABELS);
    expect(html.match(/role="img"/g)).toHaveLength(LABELS.length);
    for (const label of LABELS) {
      expect(html).toContain(`<title>${label}</title>`);
    }
  });

  it("beschriftet die Liste und zeigt keine Text-Platzhalter mehr", () => {
    expect(html).toContain('aria-label="Zahlungsarten"');
    expect(html).not.toContain("<text");
  });

  it("zeigt die Marken in ihren Originalfarben, nicht in currentColor", () => {
    expect(html).not.toContain("currentColor");
    // Je ein unverwechselbarer Markenwert pro Logo.
    expect(html).toContain("#1434CB"); // Visa-Blau
    expect(html).toContain("#EB001B"); // Mastercard-Rot
    expect(html).toContain("#FF5F00"); // Mastercard-Orange (offizieller Wert)
    expect(html).toContain("#FFCC00"); // PostFinance-Gelb
    expect(html).toContain("#4285F4"); // Google-Blau
    expect(html).toContain("#00B4E6"); // TWINT-Signet (Verlaufsstart)
  });

  it("skaliert nur per CSS — kein width/height am <svg>, aber eine viewBox", () => {
    const svgs = html.match(/<svg[^>]*>/g) ?? [];
    expect(svgs).toHaveLength(LABELS.length);
    for (const tag of svgs) {
      expect(tag).toContain("viewBox=");
      expect(tag).not.toMatch(/\s(width|height)=/);
    }
  });

  it("bleibt unter dem Grössenbudget von 25 kB Markup", () => {
    expect(html.length).toBeLessThan(25_000);
  });

  it("ist eine Server-Komponente (kein 'use client')", () => {
    for (const rel of ["./PaymentIcons.tsx", "./PaymentLogos.tsx"]) {
      const src = readFileSync(
        fileURLToPath(new URL(rel, import.meta.url)),
        "utf8",
      );
      expect(src).not.toMatch(/^\s*["']use client["']/m);
    }
  });
});
