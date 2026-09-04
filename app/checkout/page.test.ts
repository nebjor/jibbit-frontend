import { afterEach, describe, expect, it, vi } from "vitest"
import type { CartState } from "@/lib/cart/types"
import { EMPTY_CART } from "@/lib/cart/types"

/**
 * Die Zugangsprüfung der Kasse — der Kern der Kontopflicht.
 *
 * Geprüft wird das echte Server Component (`app/checkout/page.tsx`) mit
 * Attrappen für Cart, Sitzung und Kundenkonto:
 *
 *   - Ohne Sitzung und mit Kontopflicht: Umleitung zur Anmeldung, und zwar
 *     mit `?next=/checkout` — der Rückweg an GENAU dieselbe Stelle.
 *   - Der Warenkorb wird auf diesem Weg NIE angefasst: die Seite liest ihn
 *     nur. Ein Kunde, der sich anmelden muss und dabei den vollen Warenkorb
 *     verliert, wäre schlimmer als gar keine Kontopflicht.
 *   - Mit Sitzung und hinterlegter Adresse: der Adressschritt kommt
 *     ausgefüllt an (Vorausfüll-Props am CheckoutFlow).
 *   - Schalter aus: alles wie früher, keine Umleitung.
 */

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

const mocks = vi.hoisted(() => ({
  readCartState: vi.fn(),
  readSessionToken: vi.fn(),
  getCurrentCustomer: vi.fn(),
  getAddresses: vi.fn(),
}))

// Nur Lesefunktionen werden hier bereitgestellt — die Seite importiert keine
// einzige Cart-Mutation. Würde sie eine aufrufen, fiele der Test hart um.
vi.mock("@/lib/cart/server", () => ({ readCartState: mocks.readCartState }))
vi.mock("@/lib/auth/session", () => ({ readSessionToken: mocks.readSessionToken }))
vi.mock("@/lib/auth/customer", () => ({
  getCurrentCustomer: mocks.getCurrentCustomer,
  getAddresses: mocks.getAddresses,
}))
vi.mock("@/components/checkout/CheckoutFlow", () => ({
  CheckoutFlow: () => null,
}))

const { default: CheckoutPage } = await import("./page")
const { CheckoutFlow } = await import("@/components/checkout/CheckoutFlow")
const { TrackCheckoutStarted } = await import(
  "@/components/analytics/TrackCheckoutStarted"
)

/**
 * Die Seite rendert seit dem PostHog-Einbau ein Fragment:
 * [TrackCheckoutStarted, CheckoutFlow]. Die Zugangs- und Vorausfüll-Tests
 * interessieren sich weiter für die Props des CheckoutFlow — dieser Helfer
 * fischt sie aus dem Fragment.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
function childProps(el: any, type: unknown) {
  const children = Array.isArray(el.props.children)
    ? el.props.children
    : [el.props.children]
  const child = children.find((c: any) => c?.type === type)
  expect(child).toBeDefined()
  return child.props
}
function flowProps(el: any) {
  return childProps(el, CheckoutFlow)
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Ein voller Warenkorb, wie ihn readCartState liefern würde. */
const VOLLER_KORB: CartState = {
  ...EMPTY_CART,
  id: "cart_1",
  count: 3,
  subtotal: 42,
  total: 42,
}

const KUNDIN = {
  id: "cus_1",
  email: "jana@example.ch",
  firstName: "Jana",
  lastName: "Muster",
  phone: "",
  companyName: "",
  importedFromOdoo: false,
}

const KONTO_ADRESSE = {
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
  isDefaultShipping: true,
  isDefaultBilling: true,
}

function setup({
  cart = VOLLER_KORB,
  session = null as string | null,
  pflicht = "true",
}: { cart?: CartState; session?: string | null; pflicht?: string } = {}) {
  vi.stubEnv("CHECKOUT_REQUIRE_ACCOUNT", pflicht)
  mocks.readCartState.mockResolvedValue(cart)
  mocks.readSessionToken.mockResolvedValue(session)
  mocks.getCurrentCustomer.mockResolvedValue(null)
  mocks.getAddresses.mockResolvedValue([])
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe("Kasse — Zugangsprüfung", () => {
  it("schickt Unangemeldete zur Anmeldung, mit Rückweg genau hierher", async () => {
    setup({ session: null })
    const err = await CheckoutPage().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RedirectSignal)
    expect((err as RedirectSignal).to).toBe("/konto/anmelden?next=%2Fcheckout")
  })

  it("fasst den Warenkorb bei der Umleitung nicht an — nur lesen", async () => {
    setup({ session: null })
    await CheckoutPage().catch(() => undefined)
    // Genau EIN lesender Zugriff; Mutationen sind gar nicht erst importierbar
    // (der Modul-Mock oben stellt nur readCartState bereit).
    expect(mocks.readCartState).toHaveBeenCalledTimes(1)
  })

  it("prüft erst den Warenkorb: leer heisst /shop, nicht Anmeldung", async () => {
    setup({ cart: EMPTY_CART, session: null })
    const err = await CheckoutPage().catch((e: unknown) => e)
    expect((err as RedirectSignal).to).toBe("/shop")
  })

  it("lässt Angemeldete durch", async () => {
    setup({ session: "token" })
    const el = await CheckoutPage()
    expect(flowProps(el).initialCart).toEqual(VOLLER_KORB)
  })

  it("lässt bei abgeschaltetem Schalter auch Gäste durch", async () => {
    setup({ session: null, pflicht: "false" })
    const el = await CheckoutPage()
    expect(flowProps(el).initialCart).toEqual(VOLLER_KORB)
    expect(flowProps(el).prefillAddress).toBeNull()
  })

  it("gibt der Analyse nur Zahlen und Handles mit — nie E-Mail oder Adresse", async () => {
    // Der Cart trägt hier E-Mail und Adresse; das Analyse-Kind darf davon
    // nichts sehen (lib/analytics/events.ts erklärt, warum).
    setup({
      session: "token",
      cart: {
        ...VOLLER_KORB,
        email: "jana@example.ch",
        hasShippingAddress: true,
        address: {
          firstName: "Jana",
          lastName: "Muster",
          address1: "Bahnhofstrasse 1",
          postalCode: "8001",
          city: "Zürich",
          countryCode: "ch",
        },
      },
    })
    const el = await CheckoutPage()
    const analytics = childProps(el, TrackCheckoutStarted)
    expect(analytics).toEqual({
      itemCount: 3,
      goodsValue: 42,
      currency: "CHF",
      products: [],
    })
    expect(JSON.stringify(analytics)).not.toContain("jana@example.ch")
    expect(JSON.stringify(analytics)).not.toContain("Bahnhofstrasse")
  })
})

describe("Kasse — Vorausfüllen aus dem Konto", () => {
  it("übergibt E-Mail und hinterlegte Adresse an den Adressschritt", async () => {
    setup({ session: "token" })
    mocks.getCurrentCustomer.mockResolvedValue(KUNDIN)
    mocks.getAddresses.mockResolvedValue([KONTO_ADRESSE])

    const el = await CheckoutPage()
    expect(flowProps(el).prefillEmail).toBe("jana@example.ch")
    expect(flowProps(el).prefillAddress).toMatchObject({
      firstName: "Jana",
      lastName: "Muster",
      address1: "Bahnhofstrasse 1",
      postalCode: "8001",
      city: "Zürich",
      countryCode: "ch",
    })
  })

  it("nach Anmeldung mit vollem Warenkorb: Korb unverändert UND Adresse ausgefüllt", async () => {
    // Der Rückweg aus der Anmeldung: gleiche Seite, jetzt mit Sitzung. Der
    // Warenkorb kommt unangetastet aus dem Cookie/Backend, die Adresse aus
    // dem Konto — genau der Zustand, für den die Kontopflicht gebaut wurde.
    setup({ session: "token" })
    mocks.getCurrentCustomer.mockResolvedValue(KUNDIN)
    mocks.getAddresses.mockResolvedValue([KONTO_ADRESSE])

    const el = await CheckoutPage()
    expect(flowProps(el).initialCart).toEqual(VOLLER_KORB)
    expect(flowProps(el).initialCart.count).toBe(3)
    expect(flowProps(el).prefillAddress?.address1).toBe("Bahnhofstrasse 1")
  })

  it("fragt das Konto nicht ab, wenn der Cart schon Adresse und E-Mail trägt", async () => {
    setup({
      session: "token",
      cart: {
        ...VOLLER_KORB,
        email: "jana@example.ch",
        hasShippingAddress: true,
        address: {
          firstName: "Jana",
          lastName: "Muster",
          address1: "Bahnhofstrasse 1",
          postalCode: "8001",
          city: "Zürich",
          countryCode: "ch",
        },
      },
    })
    const el = await CheckoutPage()
    expect(mocks.getCurrentCustomer).not.toHaveBeenCalled()
    expect(flowProps(el).prefillAddress).toBeNull()
  })

  it("kommt ohne hinterlegte Adresse mit leerem Formular klar", async () => {
    setup({ session: "token" })
    mocks.getCurrentCustomer.mockResolvedValue(KUNDIN)
    mocks.getAddresses.mockResolvedValue([])

    const el = await CheckoutPage()
    expect(flowProps(el).prefillEmail).toBe("jana@example.ch")
    expect(flowProps(el).prefillAddress).toBeNull()
  })
})
