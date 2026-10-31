import type { ShopTheme, ShopThemeTokens } from "./shop-config";

/**
 * DESIGN-TOKENS PRO SHOP.
 *
 * `app/tokens.css` bleibt die Quelle der Standardwerte (Colorway «Kiosk»).
 * Ein Shop überschreibt einzelne Variablen in `shop.config.ts` unter
 * `theme.tokens`; der Root-Layout schreibt sie als EIN `<style>` ins Dokument.
 * Ohne Überschreibung (jibbit) gibt es kein Element — das HTML ist
 * unverändert.
 *
 * BROWSERFARBE: `<meta name="theme-color">` spiegelt `--c-ground`. Es gibt
 * deshalb keinen zweiten Wert zu pflegen: `themeColorOf` nimmt
 * `theme.themeColor`, sonst `tokens["--c-ground"]`, sonst den Standard. Ein
 * Mandant (`TenantConfig.theme.themeColor`, app/layout.tsx) hat für das
 * Meta-Tag Vorrang, färbt aber die Seite NICHT um — das Aussehen gehört dem
 * Deployment, nicht dem einzelnen Host. (Sonst würde ein Mandant mit
 * abweichendem Eintrag plötzlich eine andere Hintergrundfarbe bekommen.)
 */

/** Wert von `--c-ground` in app/tokens.css (theme.test.ts hält beide gleich). */
export const DEFAULT_GROUND = "#F6F5F3";

const NAME = /^--[a-z][a-z0-9-]*$/;
// Kein Ausbruch aus der Deklaration oder dem <style>-Element.
const FORBIDDEN_VALUE = /[;{}<>\@\n\r]|\/\*|\*\//;

export function themeColorOf(theme: ShopTheme): string {
  return theme.themeColor ?? theme.tokens?.["--c-ground"] ?? DEFAULT_GROUND;
}

/** Gültige Überschreibungen; ungültige Namen/Werte werden verworfen. */
export function validTokens(tokens: ShopThemeTokens | undefined): [string, string][] {
  if (!tokens) return [];
  const out: [string, string][] = [];
  for (const [name, raw] of Object.entries(tokens)) {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!NAME.test(name) || !value || FORBIDDEN_VALUE.test(value)) {
      console.error(`[theme] Token "${name}" ignoriert: ungültiger Name oder Wert.`);
      continue;
    }
    out.push([name, value]);
  }
  return out;
}

/**
 * CSS für die Überschreibungen, oder `null` wenn es keine gibt.
 * `:root:root` schlägt `:root` aus tokens.css unabhängig von der Reihenfolge
 * der Stylesheets.
 */
export function themeCss(theme: ShopTheme): string | null {
  const entries = validTokens(theme.tokens);
  if (entries.length === 0) return null;
  return `:root:root{${entries.map(([k, v]) => `${k}:${v}`).join(";")}}`;
}
