import { describe, expect, it } from "vitest"
import {
  MELDUNG_EMAIL_UNGUELTIG,
  MELDUNG_FEHLER,
  MELDUNG_WUNSCH_FEHLT,
  MELDUNG_ZU_VIELE,
  SENDE_ABSTAND_MS,
  WUNSCH_MAX,
  besucherAdresse,
  darfSenden,
  meldungFuerStatus,
  pruefeProduktwunsch,
} from "./validate"

describe("pruefeProduktwunsch", () => {
  it("nimmt einen Wunsch mit Kontext an", () => {
    const r = pruefeProduktwunsch({
      wunsch: "  Blättchen aus Hanf ",
      email: " kunde@example.ch ",
      kategorie: "Papers",
      suche: "",
      url: "https://jibbit.ch/?kategorie=papers",
    })
    expect(r).toEqual({
      art: "ok",
      payload: {
        wunsch: "Blättchen aus Hanf",
        email: "kunde@example.ch",
        kontext: { kategorie: "Papers", url: "https://jibbit.ch/?kategorie=papers" },
      },
    })
  })

  it("lässt die E-Mail weg, wenn sie leer ist", () => {
    const r = pruefeProduktwunsch({ wunsch: "Etwas", email: "  " })
    expect(r).toEqual({ art: "ok", payload: { wunsch: "Etwas", kontext: {} } })
  })

  it("weist einen leeren Wunsch ab", () => {
    for (const wunsch of ["", "   \n ", undefined, 42]) {
      expect(pruefeProduktwunsch({ wunsch })).toEqual({
        art: "ungueltig",
        fieldErrors: { wunsch: MELDUNG_WUNSCH_FEHLT },
      })
    }
  })

  it("weist zu lange Wünsche ab, nimmt genau die Obergrenze an", () => {
    expect(pruefeProduktwunsch({ wunsch: "x".repeat(WUNSCH_MAX) }).art).toBe("ok")
    const r = pruefeProduktwunsch({ wunsch: "x".repeat(WUNSCH_MAX + 1) })
    expect(r.art).toBe("ungueltig")
  })

  it("weist ungültige E-Mail-Adressen ab", () => {
    for (const email of ["kein-at", "a@b", "a b@c.ch"]) {
      expect(pruefeProduktwunsch({ wunsch: "x", email })).toEqual({
        art: "ungueltig",
        fieldErrors: { email: MELDUNG_EMAIL_UNGUELTIG },
      })
    }
  })

  it("meldet beide Fehler gleichzeitig", () => {
    const r = pruefeProduktwunsch({ wunsch: "", email: "x" })
    expect(r.art === "ungueltig" && Object.keys(r.fieldErrors).sort()).toEqual(["email", "wunsch"])
  })

  it("erkennt Spam am gefüllten Honeypot", () => {
    expect(pruefeProduktwunsch({ wunsch: "ok", website: "http://spam" })).toEqual({ art: "spam" })
    expect(pruefeProduktwunsch({ wunsch: "ok", website: "  " }).art).toBe("ok")
  })

  it("kürzt den Kontext und verwirft Nicht-http-Adressen", () => {
    const r = pruefeProduktwunsch({
      wunsch: "x",
      suche: "s".repeat(500),
      url: "javascript:alert(1)",
    })
    expect(r.art).toBe("ok")
    if (r.art === "ok") {
      expect(r.payload.kontext.suche).toHaveLength(200)
      expect(r.payload.kontext.url).toBeUndefined()
    }
  })

  it("entfernt Steuerzeichen", () => {
    const r = pruefeProduktwunsch({ wunsch: "a\u0000b", email: "" })
    expect(r.art === "ok" && r.payload.wunsch).toBe("a b")
  })
})

describe("darfSenden", () => {
  it("erlaubt den ersten Versand und nach einer Minute", () => {
    expect(darfSenden(null, 1000)).toBe(true)
    expect(darfSenden(1000, 1000 + SENDE_ABSTAND_MS)).toBe(true)
  })
  it("sperrt innerhalb einer Minute", () => {
    expect(darfSenden(1000, 1000 + SENDE_ABSTAND_MS - 1)).toBe(false)
  })
  it("sperrt nicht bei rückwärts springender Uhr oder Unsinn", () => {
    expect(darfSenden(5000, 1000)).toBe(true)
    expect(darfSenden(Number.NaN, 1000)).toBe(true)
  })
})

describe("meldungFuerStatus", () => {
  it("übersetzt 429 und alles andere freundlich", () => {
    expect(meldungFuerStatus(429)).toBe(MELDUNG_ZU_VIELE)
    expect(meldungFuerStatus(502)).toBe(MELDUNG_FEHLER)
    expect(meldungFuerStatus(undefined)).toBe(MELDUNG_FEHLER)
  })
})

describe("besucherAdresse", () => {
  it("bevorzugt x-real-ip, sonst letzter x-forwarded-for-Eintrag", () => {
    expect(besucherAdresse("203.0.113.9", "1.1.1.1")).toBe("203.0.113.9")
    expect(besucherAdresse(null, "9.9.9.9, 10.0.0.2")).toBe("10.0.0.2")
    expect(besucherAdresse(null, null)).toBeUndefined()
    expect(besucherAdresse("<x>", null)).toBeUndefined()
  })
})
