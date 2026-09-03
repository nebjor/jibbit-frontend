import { describe, expect, it } from "vitest"
import { REQUIRE_ACCOUNT_DEFAULT, requiresAccount } from "./account-requirement"

/**
 * Der Schalter ist die einzige Stelle, an der die Kontopflicht entschieden
 * wird — und der Betreiber wird ihn wirklich umlegen. Beide Richtungen und
 * die Schreibweisen-Toleranz sind deshalb Prüfgegenstand, nicht Beiwerk.
 */
describe("requiresAccount", () => {
  it("gilt per Voreinstellung — Konstante und Verhalten stimmen überein", () => {
    expect(requiresAccount({})).toBe(REQUIRE_ACCOUNT_DEFAULT)
    expect(requiresAccount({ CHECKOUT_REQUIRE_ACCOUNT: undefined })).toBe(
      REQUIRE_ACCOUNT_DEFAULT,
    )
  })

  it("lässt sich per Umgebungsvariable abschalten", () => {
    for (const off of ["false", "FALSE", " false ", "0", "off", "nein", "no"]) {
      expect(requiresAccount({ CHECKOUT_REQUIRE_ACCOUNT: off })).toBe(false)
    }
  })

  it("lässt sich per Umgebungsvariable erzwingen", () => {
    for (const on of ["true", "TRUE", "1", "on", "ja", "yes"]) {
      expect(requiresAccount({ CHECKOUT_REQUIRE_ACCOUNT: on })).toBe(true)
    }
  })

  it("fällt bei unverständlichen Werten auf die Voreinstellung zurück", () => {
    for (const junk of ["", "  ", "vielleicht", "2"]) {
      expect(requiresAccount({ CHECKOUT_REQUIRE_ACCOUNT: junk })).toBe(
        REQUIRE_ACCOUNT_DEFAULT,
      )
    }
  })
})
