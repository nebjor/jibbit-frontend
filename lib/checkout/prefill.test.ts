import { describe, expect, it } from "vitest"
import type { AddressView, CustomerView } from "@/lib/auth/types"
import { findMatchingAddress, pickPrefillAddress, toCheckoutAddress } from "./prefill"

/**
 * Das Vorausfüllen ist der Zweck der ganzen Kontopflicht: wer angemeldet ist
 * und eine Adresse hinterlegt hat, muss den Adressschritt ausgefüllt
 * vorfinden. Diese Tests prüfen die Auswahl-Logik — welche Adresse, welche
 * Lücken aus dem Profil, und wann eine Adresse als "schon vorhanden" gilt.
 */

function adresse(overrides: Partial<AddressView> = {}): AddressView {
  return {
    id: "addr_1",
    label: "",
    firstName: "Jana",
    lastName: "Muster",
    company: "",
    address1: "Bahnhofstrasse 1",
    address2: "",
    postalCode: "8001",
    city: "Zürich",
    countryCode: "ch",
    phone: "",
    isDefaultShipping: false,
    isDefaultBilling: false,
    ...overrides,
  }
}

const KUNDIN: CustomerView = {
  id: "cus_1",
  email: "jana@example.ch",
  firstName: "Jana",
  lastName: "Muster",
  phone: "+41791234567",
  companyName: "",
  importedFromOdoo: false,
}

describe("pickPrefillAddress", () => {
  it("nimmt die Standard-Lieferadresse, wenn es eine gibt", () => {
    const picked = pickPrefillAddress(
      [
        adresse({ id: "a", address1: "Alte Gasse 9" }),
        adresse({ id: "b", address1: "Neue Strasse 2", isDefaultShipping: true }),
      ],
      KUNDIN,
    )
    expect(picked?.address1).toBe("Neue Strasse 2")
  })

  it("fällt ohne Standard auf die erste lieferbare Adresse zurück", () => {
    const picked = pickPrefillAddress([adresse({ address1: "Erste 1" })], KUNDIN)
    expect(picked?.address1).toBe("Erste 1")
  })

  it("überspringt Adressen ausserhalb des Liefergebiets", () => {
    // z.B. eine "de"-Adresse aus dem Odoo-Import: sie vorzuschlagen hiesse,
    // ein Formular vorzufüllen, das sich so nicht abschicken lässt.
    const picked = pickPrefillAddress(
      [
        adresse({ countryCode: "de", isDefaultShipping: true, address1: "Weit weg 1" }),
        adresse({ countryCode: "li", address1: "Städtle 5" }),
      ],
      KUNDIN,
    )
    expect(picked?.address1).toBe("Städtle 5")
    expect(picked?.countryCode).toBe("li")
  })

  it("gibt null zurück, wenn nichts Brauchbares da ist — Formular bleibt leer", () => {
    expect(pickPrefillAddress([], KUNDIN)).toBeNull()
    expect(pickPrefillAddress([adresse({ countryCode: "de" })], KUNDIN)).toBeNull()
  })

  it("füllt fehlenden Namen und Telefon aus dem Profil auf", () => {
    const picked = pickPrefillAddress(
      [adresse({ firstName: "", lastName: "", phone: "" })],
      KUNDIN,
    )
    expect(picked?.firstName).toBe("Jana")
    expect(picked?.lastName).toBe("Muster")
    expect(picked?.phone).toBe("+41791234567")
  })
})

describe("toCheckoutAddress", () => {
  it("lässt Adressfelder vor Profilfeldern gewinnen", () => {
    const view = adresse({ firstName: "Empfänger", phone: "+41440000000" })
    const converted = toCheckoutAddress(view, {
      firstName: "Jana",
      phone: "+41791234567",
    })
    expect(converted.firstName).toBe("Empfänger")
    expect(converted.phone).toBe("+41440000000")
  })

  it("lässt leere optionale Felder weg statt leere Strings zu liefern", () => {
    const converted = toCheckoutAddress(adresse({ company: "", address2: "" }))
    expect(converted.company).toBeUndefined()
    expect(converted.address2).toBeUndefined()
  })
})

describe("findMatchingAddress", () => {
  const bestand = [adresse({ id: "a" })]

  it("erkennt dieselbe Adresse trotz Gross-/Kleinschreibung und Leerraum", () => {
    const match = findMatchingAddress(bestand, {
      firstName: " jana ",
      lastName: "MUSTER",
      address1: "bahnhofstrasse 1",
      postalCode: "8001",
      city: "zürich",
      countryCode: "CH",
    })
    expect(match?.id).toBe("a")
  })

  it("unterscheidet nicht nach Telefon oder Firma", () => {
    // Wer nur die Telefonnummer ändert, soll kein Duplikat im Adressbuch
    // erzeugen — verglichen wird, was einen Umschlag adressiert.
    const match = findMatchingAddress(bestand, {
      firstName: "Jana",
      lastName: "Muster",
      company: "Neue Firma GmbH",
      address1: "Bahnhofstrasse 1",
      postalCode: "8001",
      city: "Zürich",
      countryCode: "ch",
      phone: "+41000000000",
    })
    expect(match?.id).toBe("a")
  })

  it("meldet eine andere Lieferanschrift als neu", () => {
    for (const anders of [
      { address1: "Bahnhofstrasse 2" },
      { postalCode: "8002" },
      { city: "Winterthur" },
      { lastName: "Anders" },
    ]) {
      const match = findMatchingAddress(bestand, {
        firstName: "Jana",
        lastName: "Muster",
        address1: "Bahnhofstrasse 1",
        postalCode: "8001",
        city: "Zürich",
        countryCode: "ch",
        ...anders,
      })
      expect(match).toBeUndefined()
    }
  })
})
