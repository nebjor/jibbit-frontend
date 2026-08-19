import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Die Cookie-Attribute sind hier der eigentliche Prüfgegenstand.
 *
 * Sie sind unsichtbar: ein Cookie ohne `httpOnly` funktioniert genauso gut,
 * ein Cookie mit `domain=.jibbit.app` auch — bis jemand per XSS das Token
 * ausliest oder ein Mandant die Sitzungen eines anderen mitgeschickt bekommt.
 * Kein Klicktest der Welt findet das; ein Test über die gesetzten Optionen
 * schon.
 */

interface SetCall {
  name: string
  value: string
  options: Record<string, unknown>
}

const setCalls: SetCall[] = []
const jar = new Map<string, string>()

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.get(name)
      return value === undefined ? undefined : { name, value }
    },
    set: (name: string, value: string, options: Record<string, unknown>) => {
      setCalls.push({ name, value, options })
      jar.set(name, value)
    },
    delete: (name: string) => {
      jar.delete(name)
    },
  }),
}))

const { SESSION_COOKIE, bearer, clearSession, readSessionToken, writeSessionToken } =
  await import("./session")

const NOW = Date.UTC(2026, 7, 20, 12, 0, 0)

function makeToken(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url")
  return `${header}.${payload}.sig`
}

function sessionToken(secondsFromNow = 3600): string {
  return makeToken({
    actor_id: "cus_01",
    actor_type: "customer",
    exp: Math.floor(NOW / 1000) + secondsFromNow,
  })
}

beforeEach(() => {
  setCalls.length = 0
  jar.clear()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("writeSessionToken", () => {
  it("setzt httpOnly, sameSite=lax und path=/", async () => {
    await writeSessionToken(sessionToken())
    const call = setCalls.at(-1)!
    expect(call.name).toBe(SESSION_COOKIE)
    expect(call.options.httpOnly).toBe(true)
    expect(call.options.sameSite).toBe("lax")
    expect(call.options.path).toBe("/")
  })

  it("setzt KEIN domain-Attribut", async () => {
    // Mit `domain=.jibbit.app` bekäme jeder Mandant die Sitzungscookies aller
    // anderen mitgeschickt. Host-only ist die Trennung, auf der die ganze
    // Mandantenfähigkeit aufsetzt (siehe lib/medusa.ts, proxy.ts).
    await writeSessionToken(sessionToken())
    expect(setCalls.at(-1)!.options).not.toHaveProperty("domain")
  })

  it("bindet die Cookie-Lebensdauer an das Token, nicht an eine eigene Zahl", async () => {
    await writeSessionToken(sessionToken(900))
    expect(setCalls.at(-1)!.options.maxAge).toBe(900)
  })

  it("lässt maxAge weg, wenn das Token kein exp hat", async () => {
    // Dann ist es ein Sitzungscookie und verschwindet mit dem Browser —
    // besser als eine erfundene Laufzeit.
    await writeSessionToken(makeToken({ actor_id: "cus_01" }))
    expect(setCalls.at(-1)!.options).not.toHaveProperty("maxAge")
  })
})

describe("readSessionToken", () => {
  it("gibt das Token einer gültigen Sitzung zurück", async () => {
    const token = sessionToken()
    await writeSessionToken(token)
    await expect(readSessionToken()).resolves.toBe(token)
  })

  it("behandelt ein abgelaufenes Token wie gar keines", async () => {
    jar.set(SESSION_COOKIE, sessionToken(-10))
    await expect(readSessionToken()).resolves.toBeNull()
  })

  it("behandelt ein Token ohne actor_id wie gar keines", async () => {
    jar.set(SESSION_COOKIE, makeToken({ exp: Math.floor(NOW / 1000) + 3600 }))
    await expect(readSessionToken()).resolves.toBeNull()
  })

  it("behandelt ein manipuliertes Cookie wie gar keines", async () => {
    jar.set(SESSION_COOKIE, "irgendwas")
    await expect(readSessionToken()).resolves.toBeNull()
  })

  it("gibt null, wenn kein Cookie da ist", async () => {
    await expect(readSessionToken()).resolves.toBeNull()
  })
})

describe("clearSession", () => {
  it("überschreibt das Cookie mit maxAge 0 und denselben Attributen", async () => {
    await writeSessionToken(sessionToken())
    await clearSession()

    const call = setCalls.at(-1)!
    expect(call.name).toBe(SESSION_COOKIE)
    expect(call.value).toBe("")
    expect(call.options.maxAge).toBe(0)
    expect(call.options.path).toBe("/")
    expect(call.options.httpOnly).toBe(true)
    expect(call.options).not.toHaveProperty("domain")
  })

  it("lässt readSessionToken danach null liefern", async () => {
    await writeSessionToken(sessionToken())
    await clearSession()
    await expect(readSessionToken()).resolves.toBeNull()
  })
})

describe("bearer", () => {
  it("baut den Authorization-Header", () => {
    expect(bearer("abc")).toEqual({ Authorization: "Bearer abc" })
  })
})
