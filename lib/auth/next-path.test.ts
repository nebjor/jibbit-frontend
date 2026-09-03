import { describe, expect, it } from "vitest"
import { isSafeNextPath, safeNextPath } from "./next-path"

/**
 * `next` ist Benutzereingabe. Diese Tests sind das Gegenstück zu denen in
 * `actions.test.ts` — dort durch die echte Action hindurch, hier die reine
 * Funktion mit allen Rändern, inklusive des Rückschrägstrich-Falls, den eine
 * Prüfung nur auf `//` übersieht.
 */
describe("safeNextPath", () => {
  it("nimmt relative Pfade an", () => {
    expect(safeNextPath("/checkout", "/konto")).toBe("/checkout")
    expect(safeNextPath("/konto/bestellungen", "/konto")).toBe("/konto/bestellungen")
    expect(safeNextPath("/", "/konto")).toBe("/")
  })

  it("lehnt alles ab, was auf einem fremden Host landen kann", () => {
    for (const evil of [
      "https://boese.example",
      "http://boese.example/checkout",
      "//boese.example",
      // Browser normalisieren `/\` zu `//` — fremder Host trotz führendem `/`.
      "/\\boese.example",
      "javascript:alert(1)",
      "checkout", // relativ ohne führenden Slash: Ziel hinge von der Seite ab
      "",
    ]) {
      expect(safeNextPath(evil, "/konto")).toBe("/konto")
      expect(isSafeNextPath(evil)).toBe(false)
    }
  })

  it("behandelt fehlende Werte wie unsichere", () => {
    expect(safeNextPath(undefined, "/konto")).toBe("/konto")
    expect(safeNextPath(null, "/konto")).toBe("/konto")
    expect(isSafeNextPath(undefined)).toBe(false)
  })
})
