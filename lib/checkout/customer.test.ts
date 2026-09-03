import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type Medusa from "@medusajs/js-sdk"
import { attachCartToCustomer, saveAddressToAccount } from "./customer"

/**
 * Die Verbindung Kasse ↔ Konto ist Komfort, nicht Voraussetzung. Der Kern
 * dieser Tests ist deshalb doppelt: dass die richtigen Backend-Aufrufe mit dem
 * richtigen Token passieren — und dass KEIN Fehler daraus je die Kasse anhält
 * oder Personendaten ins Log schreibt.
 */

function token(actorId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ actor_id: actorId, actor_type: "customer", exp: 9999999999 }),
  ).toString("base64url")
  return `h.${payload}.s`
}

interface FakeSdk {
  store: {
    cart: { transferCart: ReturnType<typeof vi.fn> }
    customer: {
      listAddress: ReturnType<typeof vi.fn>
      createAddress: ReturnType<typeof vi.fn>
    }
  }
}

function fakeSdk(addresses: unknown[] = []): FakeSdk {
  return {
    store: {
      cart: { transferCart: vi.fn(async () => ({ cart: {} })) },
      customer: {
        listAddress: vi.fn(async () => ({ addresses })),
        createAddress: vi.fn(async () => ({ customer: {} })),
      },
    },
  }
}

const asMedusa = (sdk: FakeSdk) => sdk as unknown as Medusa

let warned: string[]

beforeEach(() => {
  warned = []
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    warned.push(args.map(String).join(" "))
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("attachCartToCustomer", () => {
  it("überträgt einen Gast-Warenkorb an das angemeldete Konto", async () => {
    const sdk = fakeSdk()
    await attachCartToCustomer(
      asMedusa(sdk),
      { id: "cart_1", customer_id: null },
      token("cus_1"),
    )
    expect(sdk.store.cart.transferCart).toHaveBeenCalledWith(
      "cart_1",
      {},
      { Authorization: `Bearer ${token("cus_1")}` },
    )
  })

  it("tut nichts, wenn der Warenkorb schon diesem Konto gehört", async () => {
    const sdk = fakeSdk()
    await attachCartToCustomer(
      asMedusa(sdk),
      { id: "cart_1", customer_id: "cus_1" },
      token("cus_1"),
    )
    expect(sdk.store.cart.transferCart).not.toHaveBeenCalled()
  })

  it("versucht die Übertragung, wenn der Warenkorb einem ANDEREN Konto gehört", async () => {
    // Geteilter Browser: A meldet sich ab, B an — das Cart-Cookie überlebt.
    // Ob die Übertragung zulässig ist, entscheidet Medusa, nicht wir.
    const sdk = fakeSdk()
    await attachCartToCustomer(
      asMedusa(sdk),
      { id: "cart_1", customer_id: "cus_ANDERE" },
      token("cus_1"),
    )
    expect(sdk.store.cart.transferCart).toHaveBeenCalled()
  })

  it("hält die Kasse bei einem Fehler NIE an — und loggt das Token nicht", async () => {
    const sdk = fakeSdk()
    sdk.store.cart.transferCart.mockRejectedValue(new Error("boom"))
    await expect(
      attachCartToCustomer(
        asMedusa(sdk),
        { id: "cart_1", customer_id: null },
        token("cus_1"),
      ),
    ).resolves.toBeUndefined()
    expect(warned.join("\n")).toContain("cart.transfer")
    expect(warned.join("\n")).not.toContain(token("cus_1"))
  })
})

describe("saveAddressToAccount", () => {
  const ADRESSE = {
    firstName: "Jana",
    lastName: "Muster",
    address1: "Bahnhofstrasse 1",
    postalCode: "8001",
    city: "Zürich",
    countryCode: "ch",
  }

  it("legt die erste Adresse als Standard-Lieferadresse an", async () => {
    const sdk = fakeSdk([])
    await saveAddressToAccount(asMedusa(sdk), token("cus_1"), ADRESSE)
    expect(sdk.store.customer.createAddress).toHaveBeenCalledTimes(1)
    const [body, , headers] = sdk.store.customer.createAddress.mock.calls[0]
    expect(body).toMatchObject({
      first_name: "Jana",
      last_name: "Muster",
      address_1: "Bahnhofstrasse 1",
      postal_code: "8001",
      city: "Zürich",
      country_code: "ch",
      is_default_shipping: true,
      is_default_billing: true,
    })
    expect(headers).toEqual({ Authorization: `Bearer ${token("cus_1")}` })
  })

  it("legt KEIN Duplikat an, wenn dieselbe Adresse schon im Konto steht", async () => {
    const sdk = fakeSdk([
      {
        id: "addr_1",
        first_name: "Jana",
        last_name: "Muster",
        address_1: "Bahnhofstrasse 1",
        postal_code: "8001",
        city: "Zürich",
        country_code: "ch",
      },
    ])
    await saveAddressToAccount(asMedusa(sdk), token("cus_1"), ADRESSE)
    expect(sdk.store.customer.createAddress).not.toHaveBeenCalled()
  })

  it("macht eine ZWEITE Adresse nicht zur neuen Standardadresse", async () => {
    const sdk = fakeSdk([
      {
        id: "addr_1",
        first_name: "Jana",
        last_name: "Muster",
        address_1: "Alte Gasse 9",
        postal_code: "8400",
        city: "Winterthur",
        country_code: "ch",
        is_default_shipping: true,
      },
    ])
    await saveAddressToAccount(asMedusa(sdk), token("cus_1"), ADRESSE)
    const [body] = sdk.store.customer.createAddress.mock.calls[0]
    expect(body).toMatchObject({ is_default_shipping: false, is_default_billing: false })
  })

  it("hält die Kasse bei einem Fehler NIE an — und loggt keine Adresse", async () => {
    const sdk = fakeSdk()
    sdk.store.customer.listAddress.mockRejectedValue(new Error("kaputt"))
    await expect(
      saveAddressToAccount(asMedusa(sdk), token("cus_1"), ADRESSE),
    ).resolves.toBeUndefined()
    const log = warned.join("\n")
    expect(log).toContain("adresse.sichern")
    expect(log).not.toContain("Bahnhofstrasse")
    expect(log).not.toContain("Jana")
  })
})
