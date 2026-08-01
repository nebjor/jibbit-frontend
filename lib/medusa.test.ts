import { afterEach, describe, expect, it, vi } from "vitest";
import { getSdkForTenant, isBackendConfigured } from "./medusa";
import type { TenantConfig } from "./tenant/types";

function makeConfig(id: string): TenantConfig {
  return {
    id,
    host: `${id}.jibbit.app`,
    backendUrl: `https://backend-${id}.internal`,
    publishableKey: `pk_${id}`,
    theme: { storeName: id, domain: `${id}.jibbit.app`, themeColor: "#fff" },
  };
}

describe("getSdkForTenant", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("memoizes one client per tenant id and never returns the same client for two different tenants", () => {
    const a = makeConfig("mem-tenant-a");
    const b = makeConfig("mem-tenant-b");

    const sdkA1 = getSdkForTenant(a);
    const sdkA2 = getSdkForTenant(a);
    const sdkB = getSdkForTenant(b);

    expect(sdkA1).toBe(sdkA2);
    expect(sdkA1).not.toBe(sdkB);
  });

  it("tenant A's hostname cannot obtain tenant B's publishable key, even under interleaved concurrent requests", async () => {
    // This is the test that would have failed against the old code: the
    // previous lib/medusa.ts exported one `sdk` singleton built once from
    // process.env at module load, so there was no way for two tenants to
    // even be represented simultaneously — every request got whichever
    // backend/key happened to be baked in at boot. getSdkForTenant fixes
    // that with a Map keyed by tenant id; this test drives the fix
    // end-to-end through the real SDK's HTTP layer, not just the cache.
    const a = makeConfig("leak-tenant-a");
    const b = makeConfig("leak-tenant-b");

    const calls: Array<{ url: string; publishableKey: string | null }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | string, init?: RequestInit) => {
        const url = input.toString();
        const headers = new Headers(init?.headers);
        // Tenant B's request is deliberately slower, so if any shared
        // mutable "current tenant" slot existed, tenant A's fetch call
        // (fired first, resolving later in real time here) would risk
        // reading back tenant B's key once B's call ran.
        await new Promise((r) => setTimeout(r, url.includes(b.id) ? 20 : 0));
        calls.push({ url, publishableKey: headers.get("x-publishable-api-key") });
        return new Response(JSON.stringify({ regions: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    const sdkA = getSdkForTenant(a);
    const sdkB = getSdkForTenant(b);

    await Promise.all([
      sdkB.client.fetch("/store/regions"),
      sdkA.client.fetch("/store/regions"),
    ]);

    const forTenantA = calls.find((c) => c.url.startsWith(a.backendUrl));
    const forTenantB = calls.find((c) => c.url.startsWith(b.backendUrl));

    expect(forTenantA?.publishableKey).toBe(a.publishableKey);
    expect(forTenantB?.publishableKey).toBe(b.publishableKey);
    expect(forTenantA?.publishableKey).not.toBe(b.publishableKey);
    expect(forTenantB?.publishableKey).not.toBe(a.publishableKey);
  });
});

describe("isBackendConfigured", () => {
  it("is false when a tenant has no publishable key", () => {
    expect(isBackendConfigured({ ...makeConfig("cfg-x"), publishableKey: "" })).toBe(false);
  });

  it("is true once a tenant has a publishable key", () => {
    expect(isBackendConfigured(makeConfig("cfg-y"))).toBe(true);
  });
});
