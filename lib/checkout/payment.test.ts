import { describe, expect, it, vi } from "vitest";
import type { HttpTypes } from "@medusajs/types";
import type Medusa from "@medusajs/js-sdk";
import {
  SYSTEM_DEFAULT_PROVIDER_ID,
  ZAHLS_PROVIDER_ID,
  PaymentSetupError,
  choosePaymentProvider,
  handoffFromSession,
  preparePayment,
  systemDefaultAllowed,
} from "./payment";

/**
 * The preference order decides who takes the customer's money. These tests pin
 * it so a change is a deliberate, visible one rather than something that
 * quietly happens.
 */
describe("choosePaymentProvider", () => {
  it("prefers the real PSP (zahls.ch plugin) over the system provider", () => {
    expect(
      choosePaymentProvider([
        { id: SYSTEM_DEFAULT_PROVIDER_ID },
        { id: ZAHLS_PROVIDER_ID },
      ]),
    ).toBe(ZAHLS_PROVIDER_ID);
  });

  it("falls back to the system provider when no PSP is offered", () => {
    expect(choosePaymentProvider([{ id: SYSTEM_DEFAULT_PROVIDER_ID }])).toBe(
      SYSTEM_DEFAULT_PROVIDER_ID,
    );
  });

  it("takes whatever the region offers when nothing is recognised", () => {
    expect(choosePaymentProvider([{ id: "pp_something_else" }])).toBe(
      "pp_something_else",
    );
  });

  it("returns undefined when the region has no payment provider at all", () => {
    expect(choosePaymentProvider([])).toBeUndefined();
  });

  it("never picks the system provider when it is not allowed (production)", () => {
    // pp_system_default authorises WITHOUT moving money — a production build
    // must refuse it even when it is the only provider on the region.
    expect(
      choosePaymentProvider([{ id: SYSTEM_DEFAULT_PROVIDER_ID }], false),
    ).toBeUndefined();
    expect(
      choosePaymentProvider(
        [{ id: SYSTEM_DEFAULT_PROVIDER_ID }, { id: ZAHLS_PROVIDER_ID }],
        false,
      ),
    ).toBe(ZAHLS_PROVIDER_ID);
  });
});

describe("systemDefaultAllowed", () => {
  it("allows the system provider outside production (dev, test, CI)", () => {
    expect(systemDefaultAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(systemDefaultAllowed({ NODE_ENV: "test" })).toBe(true);
    expect(systemDefaultAllowed({})).toBe(true);
  });

  it("blocks the system provider in production builds", () => {
    expect(systemDefaultAllowed({ NODE_ENV: "production" })).toBe(false);
  });

  it("lets the operator opt in explicitly (staging smoke test)", () => {
    expect(
      systemDefaultAllowed({
        NODE_ENV: "production",
        CHECKOUT_ALLOW_SYSTEM_PROVIDER: "true",
      }),
    ).toBe(true);
    // Anything but the exact string "true" stays blocked.
    expect(
      systemDefaultAllowed({
        NODE_ENV: "production",
        CHECKOUT_ALLOW_SYSTEM_PROVIDER: "1",
      }),
    ).toBe(false);
  });
});

describe("handoffFromSession", () => {
  it("sends the customer to the gateway link for the zahls.ch plugin", () => {
    // The plugin's `initiatePayment()` stores the gateway as
    // { id, hash, link, referenceId, status, amount, currency } — the hosted
    // payment page URL is `link` (verified in the plugin source,
    // .medusa/server/src/providers/zahls/service.js, `toSessionData`).
    expect(
      handoffFromSession(ZAHLS_PROVIDER_ID, {
        provider_id: ZAHLS_PROVIDER_ID,
        data: {
          id: "42",
          hash: "abcdef",
          link: "https://jibbit.zahls.ch/de/pay/abcdef",
          referenceId: "payses_123",
          status: "waiting",
          amount: 1875,
          currency: "CHF",
        },
      }),
    ).toEqual({
      kind: "redirect",
      providerId: ZAHLS_PROVIDER_ID,
      url: "https://jibbit.zahls.ch/de/pay/abcdef",
    });
  });

  it("refuses a PSP session without a link — inline completion would create an unpaid order", () => {
    for (const providerId of [ZAHLS_PROVIDER_ID]) {
      expect(() =>
        handoffFromSession(providerId, {
          provider_id: providerId,
          data: {},
        }),
      ).toThrow(PaymentSetupError);
      expect(() =>
        handoffFromSession(providerId, {
          provider_id: providerId,
          data: { link: "" },
        }),
      ).toThrow(PaymentSetupError);
      expect(() => handoffFromSession(providerId, undefined)).toThrow(
        PaymentSetupError,
      );
    }
  });

  it("completes inline for the system provider", () => {
    expect(
      handoffFromSession(SYSTEM_DEFAULT_PROVIDER_ID, {
        provider_id: SYSTEM_DEFAULT_PROVIDER_ID,
        data: {},
      }),
    ).toEqual({ kind: "inline", providerId: SYSTEM_DEFAULT_PROVIDER_ID });
  });
});

/**
 * `preparePayment` against a faked SDK — pins the fallback behaviour that
 * decides whether an order can be marked paid without money moving.
 */
describe("preparePayment", () => {
  const CART = { region_id: "reg_1" } as unknown as HttpTypes.StoreCart;

  function fakeSdk(opts: {
    providers: { id: string }[];
    initiate: (providerId: string) => Promise<Record<string, unknown> | undefined>;
  }): Medusa {
    return {
      store: {
        payment: {
          listPaymentProviders: async () => ({
            payment_providers: opts.providers,
          }),
          initiatePaymentSession: async (
            _cart: unknown,
            { provider_id }: { provider_id: string },
          ) => ({
            payment_collection: {
              payment_sessions: [
                {
                  provider_id,
                  data: await opts.initiate(provider_id),
                },
              ],
            },
          }),
        },
      },
    } as unknown as Medusa;
  }

  it("redirects via the zahls.ch plugin when it is the only PSP on the region", async () => {
    const sdk = fakeSdk({
      providers: [{ id: ZAHLS_PROVIDER_ID }, { id: SYSTEM_DEFAULT_PROVIDER_ID }],
      initiate: async () => ({ link: "https://jibbit.zahls.ch/de/pay/x" }),
    });
    await expect(preparePayment(sdk, CART, true)).resolves.toEqual({
      kind: "redirect",
      providerId: ZAHLS_PROVIDER_ID,
      url: "https://jibbit.zahls.ch/de/pay/x",
    });
  });

  it("falls back to the system provider when session creation fails and the fallback is allowed", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const sdk = fakeSdk({
        providers: [
          { id: ZAHLS_PROVIDER_ID },
          { id: SYSTEM_DEFAULT_PROVIDER_ID },
        ],
        initiate: async (providerId) => {
          if (providerId !== SYSTEM_DEFAULT_PROVIDER_ID) {
            throw new Error("credentials missing");
          }
          return {};
        },
      });
      await expect(preparePayment(sdk, CART, true)).resolves.toEqual({
        kind: "inline",
        providerId: SYSTEM_DEFAULT_PROVIDER_ID,
      });
      // The fallback must be loud — production logs must show it.
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("does NOT fall back when the system provider is blocked (production)", async () => {
    const sdk = fakeSdk({
      providers: [
        { id: ZAHLS_PROVIDER_ID },
        { id: SYSTEM_DEFAULT_PROVIDER_ID },
      ],
      initiate: async () => {
        throw new Error("credentials missing");
      },
    });
    await expect(preparePayment(sdk, CART, false)).rejects.toThrow(
      "credentials missing",
    );
  });

  it("does NOT fall back when the PSP session exists but has no link", async () => {
    // A session that exists but is unusable is a contract violation — faking
    // the payment inline would create an unpaid "paid" order, even in dev.
    const sdk = fakeSdk({
      providers: [
        { id: ZAHLS_PROVIDER_ID },
        { id: SYSTEM_DEFAULT_PROVIDER_ID },
      ],
      initiate: async () => ({}),
    });
    await expect(preparePayment(sdk, CART, true)).rejects.toThrow(
      PaymentSetupError,
    );
  });

  it("refuses to check out when only the blocked system provider remains", async () => {
    const sdk = fakeSdk({
      providers: [{ id: SYSTEM_DEFAULT_PROVIDER_ID }],
      initiate: async () => ({}),
    });
    await expect(preparePayment(sdk, CART, false)).rejects.toThrow(
      PaymentSetupError,
    );
  });
});
