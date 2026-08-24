import { describe, expect, it } from "vitest";
import {
  PAYREXX_PROVIDER_ID,
  PaymentSetupError,
  choosePaymentProvider,
  handoffFromSession,
} from "./payment";

/**
 * The preference order decides who takes the customer's money. These tests pin
 * it so a change is a deliberate, visible one rather than something that
 * quietly happens.
 */
describe("choosePaymentProvider", () => {
  it("prefers the real PSP (zahls.ch via the Payrexx module) over the system provider", () => {
    expect(
      choosePaymentProvider([
        { id: "pp_system_default" },
        { id: PAYREXX_PROVIDER_ID },
      ]),
    ).toBe(PAYREXX_PROVIDER_ID);
  });

  it("falls back to the system provider when the PSP is not offered", () => {
    expect(choosePaymentProvider([{ id: "pp_system_default" }])).toBe(
      "pp_system_default",
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
});

describe("handoffFromSession", () => {
  it("sends the customer to the gateway link for the PSP provider", () => {
    expect(
      handoffFromSession(PAYREXX_PROVIDER_ID, {
        provider_id: PAYREXX_PROVIDER_ID,
        data: { link: "https://jibbit.zahls.ch/?payment=abc" },
      }),
    ).toEqual({
      kind: "redirect",
      providerId: PAYREXX_PROVIDER_ID,
      url: "https://jibbit.zahls.ch/?payment=abc",
    });
  });

  it("refuses a PSP session without a link — inline completion would create an unpaid order", () => {
    expect(() =>
      handoffFromSession(PAYREXX_PROVIDER_ID, {
        provider_id: PAYREXX_PROVIDER_ID,
        data: {},
      }),
    ).toThrow(PaymentSetupError);
    expect(() => handoffFromSession(PAYREXX_PROVIDER_ID, undefined)).toThrow(
      PaymentSetupError,
    );
  });

  it("completes inline for the system provider", () => {
    expect(
      handoffFromSession("pp_system_default", {
        provider_id: "pp_system_default",
        data: {},
      }),
    ).toEqual({ kind: "inline", providerId: "pp_system_default" });
  });
});
