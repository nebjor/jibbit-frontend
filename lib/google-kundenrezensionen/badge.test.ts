import { describe, expect, it } from "vitest";
import { STORE } from "@/lib/config";
import {
  badgeAllowed,
  badgeConfigured,
  MERCHANT_WIDGET_OPTIONS,
  MERCHANT_WIDGET_SRC,
  parseBadgeSwitch,
} from "./badge";

const ok = {
  enabled: true,
  merchantId: 5618479597,
  domain: STORE.domain,
  consent: true,
};

describe("parseBadgeSwitch — GOOGLE_KUNDENREZENSIONEN_BADGE", () => {
  it("nur «1» oder «true» schalten ein", () => {
    expect(parseBadgeSwitch("1")).toBe(true);
    expect(parseBadgeSwitch("true")).toBe(true);
    expect(parseBadgeSwitch(" TRUE ")).toBe(true);
  });

  it("alles andere bleibt AUS — auch Tippfehler und «ja»", () => {
    for (const v of [undefined, null, "", " ", "0", "false", "ja", "yes", "on", "2"]) {
      expect(parseBadgeSwitch(v), String(v)).toBe(false);
    }
  });
});

describe("badgeAllowed — vier Wächter", () => {
  it("lädt, wenn alle vier erfüllt sind", () => {
    expect(badgeConfigured(ok)).toBe(true);
    expect(badgeAllowed(ok)).toBe(true);
  });

  it("ohne Schalter: nichts (Standard AUS)", () => {
    expect(badgeAllowed({ ...ok, enabled: false })).toBe(false);
    expect(badgeConfigured({ ...ok, enabled: false })).toBe(false);
  });

  it("ohne Merchant-ID: nichts", () => {
    expect(badgeAllowed({ ...ok, merchantId: null })).toBe(false);
  });

  it("auf fremder Domain (Staging, anderer Mandant): nichts", () => {
    expect(badgeAllowed({ ...ok, domain: "test.jibbit.ch" })).toBe(false);
    expect(badgeAllowed({ ...ok, domain: "anderer-shop.ch" })).toBe(false);
    expect(badgeAllowed({ ...ok, domain: "www.jibbit.ch" })).toBe(false);
  });

  it("ohne Einwilligung: nichts — auch wenn alles andere stimmt", () => {
    expect(badgeConfigured(ok)).toBe(true);
    expect(badgeAllowed({ ...ok, consent: false })).toBe(false);
  });
});

describe("Googles Snippet (answer/7105655, 2026-10-05)", () => {
  it("lädt das aktuelle Store Widget, nicht das abgelöste platform.js-Badge", () => {
    expect(MERCHANT_WIDGET_SRC).toBe(
      "https://www.gstatic.com/shopping/merchant/merchantwidget.js",
    );
    expect(MERCHANT_WIDGET_SRC).not.toMatch(/platform\.js|renderBadge/);
  });

  it("steht unten LINKS — rechts liegen Warenkorb und Kaufleiste", () => {
    expect(MERCHANT_WIDGET_OPTIONS.position).toBe("LEFT_BOTTOM");
    // Mobil über der fixen Kaufleiste der Produktseite.
    expect(MERCHANT_WIDGET_OPTIONS.mobileBottomMargin).toBeGreaterThanOrEqual(80);
  });
});
