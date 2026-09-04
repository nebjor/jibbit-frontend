import { describe, expect, it, vi } from "vitest";
import { createAnalyticsGate, type AnalyticsClientLike } from "./gate";

/**
 * Die vier Zusagen des PostHog-Einbaus, als Tests:
 *
 *  1. Ohne Einwilligung wird NICHTS geladen (nicht mal der Chunk geholt).
 *  2. Ein Widerruf beendet die Erfassung sofort — auch mitten im Laden.
 *  3. Ohne Schlüssel passiert schlicht nichts, und nichts stürzt ab.
 *  4. (Die Personendaten-Zusage testet lib/analytics/events.test.ts.)
 */

function fakeClient() {
  let optedOut = false;
  return {
    capture: vi.fn(),
    opt_in_capturing: vi.fn(() => {
      optedOut = false;
    }),
    opt_out_capturing: vi.fn(() => {
      optedOut = true;
    }),
    has_opted_out_capturing: () => optedOut,
    startSessionRecording: vi.fn(),
    stopSessionRecording: vi.fn(),
  } satisfies AnalyticsClientLike;
}

describe("createAnalyticsGate — ohne Einwilligung wird nichts geladen", () => {
  it("ruft load() nie, solange keine Einwilligung erteilt wurde", async () => {
    const load = vi.fn(async () => fakeClient());
    const gate = createAnalyticsGate({ key: "phc_test", load });

    gate.capture("product_viewed", { product_handle: "papers-x" });
    await gate.setConsent(false);
    gate.capture("product_viewed", { product_handle: "papers-x" });

    expect(load).not.toHaveBeenCalled();
    expect(gate.isActive()).toBe(false);
  });
});

describe("createAnalyticsGate — ohne Schlüssel passiert nichts", () => {
  it("lädt auch mit Einwilligung nichts und wirft nicht", async () => {
    const load = vi.fn(async () => fakeClient());
    const gate = createAnalyticsGate({ key: null, load });

    await expect(gate.setConsent(true)).resolves.toBeUndefined();
    expect(() => gate.capture("order_completed", { value: 42 })).not.toThrow();

    expect(load).not.toHaveBeenCalled();
    expect(gate.isActive()).toBe(false);
  });
});

describe("createAnalyticsGate — Einwilligung erteilt", () => {
  it("lädt genau einmal und sendet danach Ereignisse", async () => {
    const client = fakeClient();
    const load = vi.fn(async () => client);
    const gate = createAnalyticsGate({ key: "phc_test", load });

    await gate.setConsent(true);
    await gate.setConsent(true);

    expect(load).toHaveBeenCalledTimes(1);
    expect(gate.isActive()).toBe(true);

    gate.capture("checkout_started", { item_count: 2 });
    expect(client.capture).toHaveBeenCalledWith("checkout_started", {
      item_count: 2,
    });
  });

  it("stellt Ereignisse an, die während des Ladens feuern, und sendet sie danach", async () => {
    const client = fakeClient();
    let resolveLoad: (c: AnalyticsClientLike) => void = () => {};
    const load = vi.fn(
      () =>
        new Promise<AnalyticsClientLike>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const gate = createAnalyticsGate({ key: "phc_test", load });

    const pending = gate.setConsent(true);
    // Chunk lädt noch — das erste product_viewed darf nicht verloren gehen.
    gate.capture("product_viewed", { product_handle: "papers-x" });

    resolveLoad(client);
    await pending;

    expect(client.capture).toHaveBeenCalledWith("product_viewed", {
      product_handle: "papers-x",
    });
  });

  it("bleibt still, wenn das Laden fehlschlägt (Adblocker, offline)", async () => {
    const load = vi.fn(async () => {
      throw new Error("blocked");
    });
    const gate = createAnalyticsGate({ key: "phc_test", load });

    await expect(gate.setConsent(true)).resolves.toBeUndefined();
    expect(() => gate.capture("product_viewed", {})).not.toThrow();
    expect(gate.isActive()).toBe(false);
  });
});

describe("createAnalyticsGate — Widerruf beendet die Erfassung", () => {
  it("stoppt sofort: opt-out, Aufzeichnung aus, keine Ereignisse mehr", async () => {
    const client = fakeClient();
    const gate = createAnalyticsGate({ key: "phc_test", load: async () => client });

    await gate.setConsent(true);
    gate.capture("product_viewed", { product_handle: "papers-x" });
    expect(client.capture).toHaveBeenCalledTimes(1);

    await gate.setConsent(false);

    expect(client.opt_out_capturing).toHaveBeenCalled();
    expect(client.stopSessionRecording).toHaveBeenCalled();
    expect(gate.isActive()).toBe(false);

    gate.capture("product_viewed", { product_handle: "papers-x" });
    expect(client.capture).toHaveBeenCalledTimes(1); // nichts Neues
  });

  it("greift auch, wenn der Widerruf mitten im Laden kommt", async () => {
    const client = fakeClient();
    let resolveLoad: (c: AnalyticsClientLike) => void = () => {};
    const load = vi.fn(
      () =>
        new Promise<AnalyticsClientLike>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const gate = createAnalyticsGate({ key: "phc_test", load });

    const pending = gate.setConsent(true);
    gate.capture("product_viewed", { product_handle: "papers-x" });
    await gate.setConsent(false); // Widerruf, bevor der Chunk da ist

    resolveLoad(client);
    await pending;

    // Nichts nachgesendet, sofort opt-out.
    expect(client.capture).not.toHaveBeenCalled();
    expect(client.opt_out_capturing).toHaveBeenCalled();
  });

  it("erneutes Erteilen nach Widerruf: kein zweites Laden, sondern Opt-in", async () => {
    const client = fakeClient();
    const load = vi.fn(async () => client);
    const gate = createAnalyticsGate({ key: "phc_test", load });

    await gate.setConsent(true);
    await gate.setConsent(false);
    await gate.setConsent(true);

    expect(load).toHaveBeenCalledTimes(1);
    expect(client.opt_in_capturing).toHaveBeenCalled();
    expect(client.startSessionRecording).toHaveBeenCalled();
    expect(gate.isActive()).toBe(true);

    gate.capture("product_viewed", { product_handle: "papers-x" });
    expect(client.capture).toHaveBeenCalled();
  });
});
