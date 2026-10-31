import { describe, expect, it } from "vitest";
import { SHOP } from "@/shop.config";
import {
  BUSINESS,
  DELIVERY,
  FEATURES,
  MIN_AGE,
  PAYMENT_METHODS,
  PICKUP,
  PRICE_CLAIM,
  RETURNS,
  SHIPPING,
  STORE,
  THEME_COLOR,
} from "@/lib/config";
import { AGE_COOKIE, CONSENT_COOKIE } from "@/lib/consent/state";
import { CONSENT_CHANGED_EVENT } from "@/lib/consent/client";
import { INTRO_SESSION_KEY } from "@/lib/intro/timings";
import { dismissKey } from "@/lib/aktionen";

/**
 * Die Shop-Konfiguration ist die Quelle aller jibbit-spezifischen Werte.
 * Diese Tests nageln fest, dass jibbit damit EXAKT das ist, was es vor der
 * Auslagerung war — vor allem die Cookie-Namen (bestehende Antworten
 * müssen gültig bleiben) und die Schalter.
 */
describe("shop.config.ts — jibbit", () => {
  it("lib/config.ts reicht die Konfiguration unverändert durch", () => {
    expect(STORE).toMatchObject({
      name: "jibbit",
      domain: "jibbit.ch",
      locale: "de-CH",
      currency: "CHF",
      titleSuffix: "Online Headshop Schweiz",
    });
    expect(BUSINESS).toBe(SHOP.business);
    expect(SHIPPING).toEqual({ rate: 4.5, postage: 9, freeThreshold: 69 });
    expect(MIN_AGE).toBe(18);
    expect(PICKUP.address).toMatchObject({
      street: BUSINESS.street,
      postalCode: BUSINESS.postalCode,
      city: BUSINESS.city,
      countryCode: BUSINESS.countryCode,
    });
    expect(PAYMENT_METHODS.map((m) => m.id)).toEqual([
      "twint",
      "card",
      "postfinance",
      "apple-pay",
      "google-pay",
    ]);
    expect(PRICE_CLAIM.short).toBe("Dauertiefpreise");
    expect(DELIVERY.handlingDaysMax).toBe(3);
    expect(RETURNS.category).toBe("MerchantReturnNotPermitted");
  });

  it("Cookie-Namen bleiben die bestehenden — sonst gelten alte Antworten nicht mehr", () => {
    expect(AGE_COOKIE).toBe("jibbit_alterscheck");
    expect(CONSENT_COOKIE).toBe("jibbit_cookie_consent");
    expect(SHOP.cookies.cart).toBe("jibbit_cart_id");
  });

  it("interne Schlüssel und Events behalten ihre bisherigen Namen", () => {
    expect(CONSENT_CHANGED_EVENT).toBe("jibbit:consent-changed");
    expect(INTRO_SESSION_KEY).toBe("jibbit-intro-seen");
    expect(dismissKey({ code: "X" })).toBe("jibbit-aktionsbanner:X");
  });

  it("alle Funktionen sind für jibbit eingeschaltet", () => {
    expect(FEATURES).toEqual({
      ageGate: true,
      intro: true,
      legacyOdooRedirects: true,
      googleReviews: true,
      merchantFeed: true,
    });
  });

  it("Browserfarbe = bisheriger Wert, ohne Token-Überschreibung", () => {
    expect(THEME_COLOR).toBe("#F6F5F3");
    expect(SHOP.theme.tokens ?? {}).toEqual({});
  });

  it("id ist ein einfaches Präfix (Events, Storage-Schlüssel)", () => {
    expect(SHOP.id).toMatch(/^[a-z][a-z0-9]*$/);
  });
});
