import { describe, expect, it } from "vitest";
import type { CategoryView } from "@/lib/types";
import {
  categoryAnchor,
  categoryContent,
  parseSeoFaq,
  parseSeoText,
} from "./kategorien";

const cat = (handle: string, name: string, metadata?: Record<string, unknown>): CategoryView => ({
  id: handle,
  handle,
  name,
  description: "",
  ...(metadata ? { metadata } : {}),
});

const KNOWN = [
  cat("papers", "Papers"),
  cat("filter-tips", "Filter & Tips"),
  cat("aschenbecher", "Aschenbecher"),
];

/** Wörter, die in Shoptexten nichts verloren haben (Betreiber-Vorgabe). */
const VERBOTEN = [
  /\bcannabis\b/i,
  /\bhanf\b/i,
  /\bweed\b/i,
  /\bgras\b/i,
  /\bjoint/i,
  /\bthc\b/i,
  /\bcbd\b/i,
  /\brausch/i,
  /gesund/i,
  /schadstoff/i,
  /entgift/i,
  /heilt|heilung|therap/i,
  /ß/,
  /günstigste|billigste|bester preis|tiefstpreis/i,
];

describe("categoryContent — Standardtexte", () => {
  it.each(KNOWN)("$handle hat Titel, Beschreibung, H1, Kurztext, Ratgeber und 3-5 FAQs", (c) => {
    const content = categoryContent(c);
    expect(content.title.length).toBeGreaterThan(10);
    // Das Layout hängt « | <Shop>» an: Gesamtlänge bleibt im Rahmen der SERP.
    expect(content.title.length + " | jibbit".length).toBeLessThanOrEqual(62);
    expect(content.metaDescription.length).toBeGreaterThan(80);
    expect(content.metaDescription.length).toBeLessThanOrEqual(160);
    expect(content.h1).toMatch(/kaufen/i);
    expect(content.intro.length).toBeGreaterThan(80);
    expect(content.sections.length).toBeGreaterThanOrEqual(2);
    expect(content.faqs.length).toBeGreaterThanOrEqual(3);
    expect(content.faqs.length).toBeLessThanOrEqual(5);
  });

  it("trägt die Suchbegriffe in Titel und H1", () => {
    expect(categoryContent(KNOWN[0]).title).toMatch(/Papers kaufen/);
    expect(categoryContent(KNOWN[1]).title).toMatch(/Filter Tips kaufen/);
    expect(categoryContent(KNOWN[2]).title).toMatch(/Aschenbecher kaufen/);
    expect(categoryContent(KNOWN[1]).h1).toMatch(/Filter Tips kaufen/);
  });

  it("kommt ohne Gesundheitsversprechen, Drogenbezug und Superlative aus", () => {
    for (const c of KNOWN) {
      const content = categoryContent(c);
      const all = [
        content.title,
        content.metaDescription,
        content.h1,
        content.intro,
        ...content.sections.flatMap((s) => [s.heading ?? "", ...s.paragraphs]),
        ...content.faqs.flatMap((f) => [f.q, f.a]),
      ].join("\n");
      for (const pattern of VERBOTEN) {
        expect(all, `${c.handle}: ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("nennt die Gratisversand-Grenze aus der Konfiguration", () => {
    const faq = categoryContent(KNOWN[0]).faqs.find((f) => /gratis/i.test(f.q));
    expect(faq?.a).toContain("CHF 69");
  });
});

describe("categoryContent — Rückfall für neue Kategorien", () => {
  it("baut für jede unbekannte Kategorie eine brauchbare Seite", () => {
    const content = categoryContent(cat("bongs", "Bongs"));
    expect(content.title).toBe("Bongs kaufen in der Schweiz");
    expect(content.h1).toBe("Bongs kaufen in der Schweiz");
    expect(content.metaDescription).toContain("Bongs");
    expect(content.faqs.length).toBeGreaterThanOrEqual(3);
    expect(categoryAnchor(cat("bongs", "Bongs"))).toBe("Bongs kaufen");
  });

  it("nimmt die Beschreibung aus dem Admin als Kurztext", () => {
    const c = { ...cat("bongs", "Bongs"), description: "Unsere Auswahl." };
    expect(categoryContent(c).intro).toBe("Unsere Auswahl.");
  });
});

describe("categoryContent — Überschreiben über Medusa-Metadaten", () => {
  it("ersetzt genau die gepflegten Bausteine", () => {
    const content = categoryContent(
      cat("papers", "Papers", {
        seo_title: "Eigener Titel",
        seo_intro: "Eigener Kurztext.",
        seo_text: "## Eigene Überschrift\n\nAbsatz eins.\n\nAbsatz zwei.",
        seo_faq: JSON.stringify([{ q: "Frage?", a: "Antwort." }]),
      }),
    );
    expect(content.title).toBe("Eigener Titel");
    expect(content.intro).toBe("Eigener Kurztext.");
    expect(content.sections).toEqual([
      { heading: "Eigene Überschrift", paragraphs: ["Absatz eins.", "Absatz zwei."] },
    ]);
    expect(content.faqs).toEqual([{ q: "Frage?", a: "Antwort." }]);
    // Nicht gepflegt: Standard bleibt.
    expect(content.h1).toBe("Papers kaufen in der Schweiz");
  });

  it("ignoriert leere oder kaputte Angaben", () => {
    const content = categoryContent(
      cat("papers", "Papers", { seo_title: "  ", seo_faq: "{kaputt", seo_text: "" }),
    );
    expect(content.title).toMatch(/Papers kaufen/);
    expect(content.faqs.length).toBeGreaterThanOrEqual(3);
    expect(content.sections.length).toBeGreaterThanOrEqual(2);
  });
});

describe("parseSeoText / parseSeoFaq", () => {
  it("trennt Abschnitte an «## »", () => {
    expect(parseSeoText("Vorspann.\n\n## A\n\nText A.\n\n## B\n\nText B.")).toEqual([
      { paragraphs: ["Vorspann."] },
      { heading: "A", paragraphs: ["Text A."] },
      { heading: "B", paragraphs: ["Text B."] },
    ]);
  });

  it("nimmt FAQ als Array oder JSON-Text und verwirft unvollständige Einträge", () => {
    expect(parseSeoFaq([{ q: "F?", a: "A." }, { q: "nur Frage" }])).toEqual([{ q: "F?", a: "A." }]);
    expect(parseSeoFaq('[{"q":"F?","a":"A."}]')).toEqual([{ q: "F?", a: "A." }]);
    expect(parseSeoFaq("kein json")).toBeUndefined();
    expect(parseSeoFaq([])).toBeUndefined();
    expect(parseSeoFaq(undefined)).toBeUndefined();
  });
});
