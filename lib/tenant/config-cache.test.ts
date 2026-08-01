import { describe, expect, it, vi } from "vitest";
import { createTenantConfigCache } from "./config-cache";
import type { TenantConfig } from "./types";

function makeConfig(id: string, host: string): TenantConfig {
  return {
    id,
    host,
    backendUrl: `https://backend-${id}.internal`,
    publishableKey: `pk_${id}`,
    theme: { storeName: id, domain: host, themeColor: "#fff" },
  };
}

/** A controllable clock, so TTL behaviour doesn't depend on real wall-clock time or fake-timer/async interplay. */
function makeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("createTenantConfigCache", () => {
  it("resolves the correct tenant for a subdomain host and a custom-domain host", async () => {
    const configs: Record<string, TenantConfig> = {
      "jibbit.jibbit.app": makeConfig("jibbit", "jibbit.jibbit.app"),
      "shop.example.ch": makeConfig("acme", "shop.example.ch"),
    };
    const fetcher = vi.fn(async (host: string) => configs[host] ?? null);
    const cache = createTenantConfigCache(fetcher);

    await expect(cache.resolve("jibbit.jibbit.app")).resolves.toEqual(
      configs["jibbit.jibbit.app"],
    );
    await expect(cache.resolve("shop.example.ch")).resolves.toEqual(
      configs["shop.example.ch"],
    );
  });

  it("returns null for a host the control plane has never heard of — never a default tenant", async () => {
    const fetcher = vi.fn(async () => null);
    const cache = createTenantConfigCache(fetcher);

    await expect(cache.resolve("nobody-owns-this.example.com")).resolves.toBeNull();
  });

  it("404s (returns null) on the very first request for a host when the control plane is down, with no last-known-good to fall back to", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const cache = createTenantConfigCache(fetcher);

    await expect(cache.resolve("brand-new-tenant.jibbit.app")).resolves.toBeNull();
    // Documented tradeoff: this is the one path where a control-plane outage
    // can produce a 404. It must not be sticky — the next attempt retries.
    expect(cache._peek("brand-new-tenant.jibbit.app")).toBeUndefined();
  });

  it("keeps serving last-known-good indefinitely once the control plane goes down after a successful resolve", async () => {
    const clock = makeClock();
    const config = makeConfig("jibbit", "jibbit.jibbit.app");
    let broken = false;
    const fetcher = vi.fn(async () => {
      if (broken) throw new Error("control plane unreachable");
      return config;
    });
    const cache = createTenantConfigCache(fetcher, clock.now);

    // Warm the cache while the control plane is healthy.
    await expect(cache.resolve("jibbit.jibbit.app")).resolves.toEqual(config);

    // Control plane goes down for good.
    broken = true;

    // Simulate many requests over a long outage, well past both the fresh
    // TTL and many refresh-throttle windows.
    for (let i = 0; i < 20; i++) {
      clock.advance(120_000); // 2 minutes per "request"
      await expect(cache.resolve("jibbit.jibbit.app")).resolves.toEqual(config);
    }

    // The background refresh really was attempted (this isn't passing
    // because the cache just never tried) — it just never got to overwrite
    // the last-known-good entry.
    expect(fetcher.mock.calls.length).toBeGreaterThan(1);
  });

  it("does not fire a background refresh more than once per throttle window", async () => {
    const clock = makeClock();
    const config = makeConfig("jibbit", "jibbit.jibbit.app");
    const fetcher = vi.fn(async () => config);
    const cache = createTenantConfigCache(fetcher, clock.now);

    await cache.resolve("jibbit.jibbit.app");
    expect(fetcher).toHaveBeenCalledTimes(1);

    clock.advance(70_000); // past the fresh TTL, into stale-while-revalidate territory
    // Many requests land back-to-back before the throttle window elapses.
    await Promise.all([
      cache.resolve("jibbit.jibbit.app"),
      cache.resolve("jibbit.jibbit.app"),
      cache.resolve("jibbit.jibbit.app"),
    ]);
    // One background refresh triggered, not three.
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("de-dupes concurrent cold-start lookups for the same never-seen host into a single control-plane call", async () => {
    const config = makeConfig("jibbit", "jibbit.jibbit.app");
    let calls = 0;
    const fetcher = vi.fn(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 5));
      return config;
    });
    const cache = createTenantConfigCache(fetcher);

    const [a, b, c] = await Promise.all([
      cache.resolve("jibbit.jibbit.app"),
      cache.resolve("jibbit.jibbit.app"),
      cache.resolve("jibbit.jibbit.app"),
    ]);

    expect(calls).toBe(1);
    expect(a).toEqual(config);
    expect(b).toEqual(config);
    expect(c).toEqual(config);
  });
});
