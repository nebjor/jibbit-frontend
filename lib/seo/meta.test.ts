import { describe, expect, it } from "vitest";
import { metaDescription } from "./meta";

describe("metaDescription", () => {
  it("lässt kurze Texte unverändert und zieht Zeilenumbrüche zusammen", () => {
    expect(metaDescription("Zeile eins.\n\n- Punkt  zwei")).toBe(
      "Zeile eins. - Punkt zwei",
    );
  });

  it("kürzt auf höchstens 160 Zeichen an einer Wortgrenze", () => {
    const text = "Wort ".repeat(60);
    const out = metaDescription(text);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith("…")).toBe(true);
    expect(
      out
        .replace("…", "")
        .trim()
        .split(" ")
        .every((w) => w === "Wort"),
    ).toBe(true);
  });

  it("schneidet nicht mitten im Wort, wenn es keine Wortgrenze gibt", () => {
    expect(metaDescription("x".repeat(300)).length).toBe(160);
  });
});
