import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TenantConfig } from "@/lib/tenant/types"

/**
 * Der Test, der diesem Zweig seinen Zweck gibt.
 *
 * Medusa selbst verrät nichts: `/auth/customer/emailpass` antwortet bei
 * unbekannter Adresse und bei falschem Passwort wortgleich mit 401,
 * `/auth/.../reset-password` immer mit 201. Kaputt machen kann man das erst in
 * der Storefront — mit einem `catch`, das den Fehlerfall anders beantwortet als
 * den Erfolgsfall. Dann sagt die Seite zwar nirgends "dieses Konto gibt es",
 * aber wer beide Antworten vergleicht, weiss es trotzdem.
 *
 * Deshalb wird hier nicht geprüft, ob eine einzelne Antwort "richtig" ist,
 * sondern ob mehrere Zweige DIESELBE Antwort geben:
 *
 *   Konto vorhanden · Konto unbekannt · Backend 500 · Netzwerk tot
 *
 * Geprüft wird die echte Action durch den echten SDK-Client hindurch; nur
 * `fetch`, die Cookies und die Mandantenauflösung sind Attrappen.
 */

const FAKE_TENANT: TenantConfig = {
  id: "test-tenant",
  host: "test.jibbit.ch",
  backendUrl: "https://backend.test",
  publishableKey: "pk_test",
  theme: { storeName: "jibbit", domain: "test.jibbit.ch", themeColor: "#fff" },
}

const cookieJar = new Map<string, string>()

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name)
      return value === undefined ? undefined : { name, value }
    },
    set: (name: string, value: string) => {
      cookieJar.set(name, value)
    },
    delete: (name: string) => {
      cookieJar.delete(name)
    },
  }),
}))

/** `redirect` wirft im Original — hier eine erkennbare Ausnahme statt dessen. */
class RedirectSignal extends Error {
  constructor(public readonly to: string) {
    super(`redirect:${to}`)
  }
}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectSignal(to)
  },
}))

vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

vi.mock("@/lib/tenant/context", () => ({
  getTenantContext: async () => FAKE_TENANT,
}))

const { anmelden, passwortNeuSetzen, passwortResetAnfordern, registrieren } =
  await import("./actions")
const { ANMELDUNG_FEHLGESCHLAGEN, PASSWORT_RESET_ANGEFORDERT, RESET_LINK_ABGELAUFEN } =
  await import("./messages")

function form(entries: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

/** Antwort im Format, das der SDK-Client erwartet (er wirft ab Status 300). */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

const IDLE = { ok: null } as const

let consoleSpies: ReturnType<typeof vi.spyOn>[] = []
let logged: string[] = []

beforeEach(() => {
  cookieJar.clear()
  logged = []
  // Nichts aus diesen Abläufen darf im Log landen — weder Adresse noch Token.
  consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(" "))
    }),
  )
})

afterEach(() => {
  consoleSpies.forEach((spy) => spy.mockRestore())
  vi.unstubAllGlobals()
})

// ───────────────────────────────────────────────────────────────────────────

describe("passwortResetAnfordern verrät nicht, ob es das Konto gibt", () => {
  const cases: Array<{ name: string; fetch: () => Promise<Response> }> = [
    {
      // Medusa antwortet 201 mit leerem Body, unabhängig davon, ob es die
      // Identität gibt (throwOnError: false im Route-Handler).
      name: "Konto vorhanden",
      fetch: async () => new Response("Created", { status: 201 }),
    },
    {
      name: "Konto unbekannt",
      fetch: async () => new Response("Created", { status: 201 }),
    },
    {
      name: "Backend antwortet 500",
      fetch: async () => json({ message: "boom" }, 500),
    },
    {
      name: "Backend antwortet 401",
      fetch: async () => json({ message: "nope" }, 401),
    },
    {
      name: "Netzwerk tot",
      fetch: async () => {
        throw new TypeError("fetch failed")
      },
    },
  ]

  const results: Array<{ name: string; state: unknown }> = []

  for (const testCase of cases) {
    it(`antwortet gleich: ${testCase.name}`, async () => {
      vi.stubGlobal("fetch", vi.fn(testCase.fetch))
      const state = await passwortResetAnfordern(IDLE, form({ email: "a@b.ch" }))
      expect(state).toEqual({ ok: true, message: PASSWORT_RESET_ANGEFORDERT })
      results.push({ name: testCase.name, state })
    })
  }

  it("liefert über alle Zweige exakt dasselbe Ergebnis", () => {
    expect(results).toHaveLength(cases.length)
    const first = JSON.stringify(results[0].state)
    for (const r of results) {
      expect(JSON.stringify(r.state)).toBe(first)
    }
  })

  it("beanstandet eine syntaktisch kaputte Adresse — das sagt über kein Konto etwas aus", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 201 })))
    const state = await passwortResetAnfordern(IDLE, form({ email: "kein-at-zeichen" }))
    expect(state.ok).toBe(false)
    expect(state.fieldErrors?.email).toBeTruthy()
  })

  it("schreibt weder Adresse noch Fehlertext ins Log", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED für kunde@example.ch")
      }),
    )
    await passwortResetAnfordern(IDLE, form({ email: "kunde@example.ch" }))
    expect(logged.join("\n")).not.toContain("kunde@example.ch")
    expect(logged.join("\n")).not.toContain("ECONNREFUSED")
  })

  it("fragt das Backend genau einmal und nur an der Reset-Route", async () => {
    const spy = vi.fn(async () => new Response("Created", { status: 201 }))
    vi.stubGlobal("fetch", spy)
    await passwortResetAnfordern(IDLE, form({ email: "a@b.ch" }))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(String((spy.mock.calls[0] as unknown[])[0])).toContain(
      "/auth/customer/emailpass/reset-password",
    )
  })
})

describe("anmelden", () => {
  it("beantwortet unbekannte Adresse und falsches Passwort gleich", async () => {
    // Medusas emailpass-Provider gibt in beiden Fällen wortgleich
    // "Invalid email or password" mit Status 401 zurück.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ message: "Invalid email or password" }, 401)),
    )

    const unbekannt = await anmelden(
      IDLE,
      form({ email: "gibtsnicht@example.ch", password: "geheim123" }),
    )
    const falsch = await anmelden(
      IDLE,
      form({ email: "kunde@example.ch", password: "falsch123" }),
    )

    expect(unbekannt).toEqual({ ok: false, message: ANMELDUNG_FEHLGESCHLAGEN })
    expect(falsch).toEqual(unbekannt)
  })

  it("nennt den alten Shop in der Meldung, die alle bekommen", async () => {
    // Bekämen den Hinweis nur importierte Konten, wäre die Meldung selbst die
    // Auskunft "diese Adresse stammt aus Odoo".
    expect(ANMELDUNG_FEHLGESCHLAGEN).toContain("früheren Shop")
  })

  it("setzt bei Erfolg ein Sitzungscookie und leitet weiter", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const payload = Buffer.from(
      JSON.stringify({ actor_id: "cus_1", actor_type: "customer", exp }),
    ).toString("base64url")
    const token = `h.${payload}.s`

    vi.stubGlobal("fetch", vi.fn(async () => json({ token })))

    await expect(
      anmelden(IDLE, form({ email: "kunde@example.ch", password: "geheim123" })),
    ).rejects.toThrow(RedirectSignal)
    expect(cookieJar.get("jb_session")).toBe(token)
  })

  it("nimmt aus dem Formular nur relative Weiterleitungsziele an", async () => {
    // Ein `next` aus dem Formular ist Benutzereingabe. Ohne Prüfung liesse
    // sich damit ein Phishing-Ziel hinter einem Link auf der echten
    // Shop-Domain verstecken.
    const exp = Math.floor(Date.now() / 1000) + 3600
    const payload = Buffer.from(
      JSON.stringify({ actor_id: "cus_1", actor_type: "customer", exp }),
    ).toString("base64url")
    vi.stubGlobal("fetch", vi.fn(async () => json({ token: `h.${payload}.s` })))

    for (const evil of [
      "https://boese.example",
      "//boese.example",
      // Browser normalisieren den Rückschrägstrich zu `//` und landen auf
      // einem fremden Host — obwohl der Pfad mit einem einzelnen `/` beginnt.
      "/\\boese.example",
      "javascript:x",
    ]) {
      const err = await anmelden(
        IDLE,
        form({ email: "a@b.ch", password: "geheim123", next: evil }),
      ).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(RedirectSignal)
      expect((err as RedirectSignal).to).toBe("/konto")
    }

    const ok = await anmelden(
      IDLE,
      form({ email: "a@b.ch", password: "geheim123", next: "/konto/bestellungen" }),
    ).catch((e: unknown) => e)
    expect((ok as RedirectSignal).to).toBe("/konto/bestellungen")
  })

  it("schreibt kein Passwort und kein Token ins Log", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("boom")
      }),
    )
    await anmelden(IDLE, form({ email: "kunde@example.ch", password: "supergeheim" }))
    const all = logged.join("\n")
    expect(all).not.toContain("supergeheim")
    expect(all).not.toContain("kunde@example.ch")
  })
})

describe("passwortNeuSetzen", () => {
  it("meldet einen abgelaufenen Link, wenn das Backend 401 gibt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ message: "Invalid token" }, 401)))
    const state = await passwortNeuSetzen(
      IDLE,
      form({ token: "abgelaufen", password: "neuesPasswort1", password_repeat: "neuesPasswort1" }),
    )
    expect(state).toEqual({ ok: false, message: RESET_LINK_ABGELAUFEN })
  })

  it("verlangt ein Token, bevor es das Backend überhaupt fragt", async () => {
    const spy = vi.fn(async () => json({}))
    vi.stubGlobal("fetch", spy)
    const state = await passwortNeuSetzen(
      IDLE,
      form({ password: "neuesPasswort1", password_repeat: "neuesPasswort1" }),
    )
    expect(state.ok).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })

  it("prüft Länge und Wiederholung, bevor es das Backend fragt", async () => {
    const spy = vi.fn(async () => json({}))
    vi.stubGlobal("fetch", spy)

    const zuKurz = await passwortNeuSetzen(
      IDLE,
      form({ token: "t", password: "kurz", password_repeat: "kurz" }),
    )
    expect(zuKurz.fieldErrors?.password).toBeTruthy()

    const ungleich = await passwortNeuSetzen(
      IDLE,
      form({ token: "t", password: "langgenug1", password_repeat: "andersgenug1" }),
    )
    expect(ungleich.fieldErrors?.password_repeat).toBeTruthy()

    expect(spy).not.toHaveBeenCalled()
  })

  it("meldet den Erfolg nicht als Sitzung, sondern schickt zur Anmeldung", async () => {
    // Ein Link aus einem E-Mail-Postfach soll nicht unmittelbar eine
    // angemeldete Sitzung erzeugen.
    vi.stubGlobal("fetch", vi.fn(async () => json({ success: true })))
    const err = await passwortNeuSetzen(
      IDLE,
      form({ token: "gut", password: "neuesPasswort1", password_repeat: "neuesPasswort1" }),
    ).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(RedirectSignal)
    expect((err as RedirectSignal).to).toContain("/konto/anmelden")
    expect(cookieJar.has("jb_session")).toBe(false)
  })

  it("schickt das Token als Bearer-Header, nicht im Body", async () => {
    const spy = vi.fn(async () => json({ success: true }))
    vi.stubGlobal("fetch", spy)
    await passwortNeuSetzen(
      IDLE,
      form({ token: "reset-token", password: "neuesPasswort1", password_repeat: "neuesPasswort1" }),
    ).catch(() => {})

    const [, init] = spy.mock.calls[0] as unknown as [unknown, RequestInit]
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer reset-token")
    expect(String(init.body)).not.toContain("reset-token")
  })
})

describe("registrieren", () => {
  it("führt zur Anmeldung, wenn die Adresse schon vergeben ist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ message: "Identity with email already exists" }, 401)),
    )
    const state = await registrieren(
      IDLE,
      form({
        email: "kunde@example.ch",
        password: "geheim123",
        password_repeat: "geheim123",
      }),
    )
    expect(state.ok).toBe(false)
    expect(state.message).toContain("Melde dich an")
  })

  it("holt nach dem Anlegen ein Token mit actor_id — sonst wäre die Sitzung wertlos", async () => {
    // Das Registrierungs-Token kennt die Kunden-ID noch nicht. Ohne den
    // refresh-Schritt liefe jeder Aufruf von /store/customers/me auf 401.
    const exp = Math.floor(Date.now() / 1000) + 3600
    const withActor = `h.${Buffer.from(
      JSON.stringify({ actor_id: "cus_neu", actor_type: "customer", exp }),
    ).toString("base64url")}.s`

    const calls: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(input)
        calls.push(url)
        if (url.includes("/register")) return json({ token: "registrierungs-token" })
        if (url.includes("/store/customers")) return json({ customer: { id: "cus_neu" } })
        if (url.includes("/auth/token/refresh")) return json({ token: withActor })
        return json({}, 404)
      }),
    )

    await expect(
      registrieren(
        IDLE,
        form({
          email: "neu@example.ch",
          password: "geheim123",
          password_repeat: "geheim123",
          first_name: "Anna",
        }),
      ),
    ).rejects.toThrow(RedirectSignal)

    expect(calls.some((c) => c.includes("/auth/customer/emailpass/register"))).toBe(true)
    expect(calls.some((c) => c.includes("/store/customers"))).toBe(true)
    expect(calls.some((c) => c.includes("/auth/token/refresh"))).toBe(true)
    expect(cookieJar.get("jb_session")).toBe(withActor)
  })

  it("prüft Passwortlänge und Wiederholung, bevor es das Backend fragt", async () => {
    const spy = vi.fn(async () => json({}))
    vi.stubGlobal("fetch", spy)

    const state = await registrieren(
      IDLE,
      form({ email: "a@b.ch", password: "kurz", password_repeat: "anders" }),
    )
    expect(state.fieldErrors?.password).toBeTruthy()
    expect(state.fieldErrors?.password_repeat).toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
  })
})
