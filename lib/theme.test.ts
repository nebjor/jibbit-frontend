import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_GROUND, themeColorOf, themeCss, validTokens } from "./theme";

describe("themeColorOf", () => {
  it("DEFAULT_GROUND entspricht --c-ground in app/tokens.css", () => {
    const css = readFileSync(
      fileURLToPath(new URL("../app/tokens.css", import.meta.url)),
      "utf8",
    );
    const m = css.match(/--c-ground:\s*(#[0-9a-fA-F]{6})/);
    expect(m?.[1].toLowerCase()).toBe(DEFAULT_GROUND.toLowerCase());
  });

  it("ohne Angaben: Standard (jibbit unverändert)", () => {
    expect(themeColorOf({})).toBe("#F6F5F3");
  });

  it("nimmt --c-ground aus den Tokens, ausdrücklicher themeColor hat Vorrang", () => {
    expect(themeColorOf({ tokens: { "--c-ground": "#eef5ee" } })).toBe("#eef5ee");
    expect(
      themeColorOf({ themeColor: "#112233", tokens: { "--c-ground": "#eef5ee" } }),
    ).toBe("#112233");
  });
});

describe("themeCss", () => {
  it("keine Überschreibung -> null (kein <style> im HTML)", () => {
    expect(themeCss({})).toBeNull();
    expect(themeCss({ tokens: {} })).toBeNull();
  });

  it("schreibt Variablen mit erhöhter Spezifität", () => {
    expect(themeCss({ tokens: { "--c-accent": "#2f7d32", "--radius": "8px" } })).toBe(
      ":root:root{--c-accent:#2f7d32;--radius:8px}",
    );
  });

  it("verwirft ungültige Namen und Werte (kein Ausbruch aus dem Style-Block)", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = {
      "color": "red",
      "--Bad": "1",
      "--x": "red;} body{display:none",
      "--y": "</style><script>",
      "--z": "",
      "--ok": "#fff",
    };
    expect(validTokens(bad)).toEqual([["--ok", "#fff"]]);
    expect(themeCss({ tokens: bad })).toBe(":root:root{--ok:#fff}");
    err.mockRestore();
  });
});
