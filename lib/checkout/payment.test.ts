import { describe, expect, it } from "vitest";
import { choosePaymentProvider } from "./payment";

/**
 * The payment strand replaces the preference order in `payment.ts`. These tests
 * pin the CURRENT behaviour so that change is a deliberate, visible one rather
 * than something that quietly happens.
 */
describe("choosePaymentProvider", () => {
  it("prefers the system provider while Payrexx is not wired up", () => {
    expect(
      choosePaymentProvider([
        { id: "pp_payrexx_payrexx" },
        { id: "pp_system_default" },
      ]),
    ).toBe("pp_system_default");
  });

  it("falls back to Payrexx when the system provider is not offered", () => {
    expect(choosePaymentProvider([{ id: "pp_payrexx_payrexx" }])).toBe(
      "pp_payrexx_payrexx",
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
