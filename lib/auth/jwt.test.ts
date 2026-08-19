import { describe, expect, it } from "vitest"
import {
  decodeJwtClaims,
  getTokenExpiryMs,
  isUsableSessionToken,
  secondsUntilExpiry,
  type MedusaAuthClaims,
} from "./jwt"

/**
 * Die Token-Logik ist der Teil des Kontobereichs, der still versagt.
 *
 * Ein Cookie, das länger lebt als sein Token, sieht auf jeder Seite nach
 * "angemeldet" aus und bricht erst beim ersten Backend-Aufruf zusammen. Ein
 * Token ohne `actor_id` lässt eine Anmeldung gelingen, die auf kein
 * Kundenkonto zeigt — genau der Zustand, den ein Odoo-Import ohne die
 * Verknüpfung `app_metadata.customer_id` erzeugt. Beides passiert ohne
 * Fehlermeldung, weshalb es hier geprüft wird.
 */

/** Baut ein JWT-förmiges Token. Die Signatur ist Attrappe — sie wird hier nie geprüft. */
function makeToken(claims: MedusaAuthClaims | unknown, signature = "sig"): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  )
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url")
  return `${header}.${payload}.${signature}`
}

const NOW = Date.UTC(2026, 7, 20, 12, 0, 0)
const inSeconds = (s: number) => Math.floor(NOW / 1000) + s

function validToken(overrides: Partial<MedusaAuthClaims> = {}) {
  return makeToken({
    actor_id: "cus_01",
    actor_type: "customer",
    auth_identity_id: "authid_01",
    exp: inSeconds(3600),
    ...overrides,
  })
}

describe("decodeJwtClaims", () => {
  it("liest die Nutzlast eines echten Medusa-Tokens", () => {
    const claims = decodeJwtClaims(validToken())
    expect(claims?.actor_id).toBe("cus_01")
    expect(claims?.actor_type).toBe("customer")
  })

  it("gibt null statt zu werfen, wenn das Cookie Unsinn enthält", () => {
    // Ein kaputtes Cookie muss "nicht angemeldet" bedeuten, nicht 500.
    expect(decodeJwtClaims(undefined)).toBeNull()
    expect(decodeJwtClaims(null)).toBeNull()
    expect(decodeJwtClaims("")).toBeNull()
    expect(decodeJwtClaims("nur-ein-string")).toBeNull()
    expect(decodeJwtClaims("a.b")).toBeNull()
    expect(decodeJwtClaims("a.b.c.d")).toBeNull()
    expect(decodeJwtClaims("a.!!!nicht-base64!!!.c")).toBeNull()
  })

  it("gibt null, wenn die Nutzlast kein Objekt ist", () => {
    expect(decodeJwtClaims(makeToken("nur ein string"))).toBeNull()
    expect(decodeJwtClaims(makeToken([1, 2, 3]))).toBeNull()
    expect(decodeJwtClaims(makeToken(null))).toBeNull()
  })
})

describe("secondsUntilExpiry", () => {
  it("rechnet die Restlaufzeit in ganzen Sekunden", () => {
    expect(secondsUntilExpiry(validToken({ exp: inSeconds(3600) }), NOW)).toBe(3600)
    expect(secondsUntilExpiry(validToken({ exp: inSeconds(1) }), NOW)).toBe(1)
  })

  it("wird nie negativ — ein negatives maxAge hiesse für den Browser 'Sitzungscookie'", () => {
    // Genau der Fall, der ein abgelaufenes Token in ein Cookie verwandeln
    // würde, das den Browserlauf überlebt.
    expect(secondsUntilExpiry(validToken({ exp: inSeconds(-9999) }), NOW)).toBe(0)
  })

  it("gibt null ohne verwertbares exp", () => {
    expect(secondsUntilExpiry(makeToken({ actor_id: "cus_01" }), NOW)).toBeNull()
    expect(secondsUntilExpiry(makeToken({ exp: "morgen" }), NOW)).toBeNull()
    expect(secondsUntilExpiry(makeToken({ exp: 0 }), NOW)).toBeNull()
    expect(secondsUntilExpiry(makeToken({ exp: -1 }), NOW)).toBeNull()
    expect(secondsUntilExpiry("kaputt", NOW)).toBeNull()
  })
})

describe("getTokenExpiryMs", () => {
  it("liefert Millisekunden, nicht Sekunden", () => {
    const exp = inSeconds(60)
    expect(getTokenExpiryMs(validToken({ exp }))).toBe(exp * 1000)
  })
})

describe("isUsableSessionToken", () => {
  it("akzeptiert ein frisches Kundentoken", () => {
    expect(isUsableSessionToken(validToken(), NOW)).toBe(true)
  })

  it("lehnt ein abgelaufenes Token ab", () => {
    expect(isUsableSessionToken(validToken({ exp: inSeconds(-1) }), NOW)).toBe(false)
  })

  it("lehnt ein Token ab, das genau jetzt abläuft", () => {
    expect(isUsableSessionToken(validToken({ exp: Math.floor(NOW / 1000) }), NOW)).toBe(
      false,
    )
  })

  it("lehnt ein Token ohne exp ab — Medusa erzeugt so eines nie", () => {
    // `generateJwtToken` wirft, wenn kein expiresIn gesetzt ist. Ein Token
    // ohne exp kann also nicht aus diesem Backend stammen.
    expect(isUsableSessionToken(makeToken({ actor_id: "cus_01" }), NOW)).toBe(false)
  })

  it("lehnt ein Token ohne actor_id ab", () => {
    // Das ist der Odoo-Import-Fall: Identität vorhanden, Kundenkonto nicht
    // verknüpft. Die Anmeldung gelingt, /store/customers/me antwortet mit 401.
    // Als Sitzung darf so ein Token nicht durchgehen.
    expect(isUsableSessionToken(makeToken({ exp: inSeconds(3600) }), NOW)).toBe(false)
    expect(
      isUsableSessionToken(makeToken({ exp: inSeconds(3600), actor_id: "" }), NOW),
    ).toBe(false)
  })

  it("lehnt jeden Unsinn ab", () => {
    expect(isUsableSessionToken(undefined, NOW)).toBe(false)
    expect(isUsableSessionToken("", NOW)).toBe(false)
    expect(isUsableSessionToken("a.b.c", NOW)).toBe(false)
  })
})
