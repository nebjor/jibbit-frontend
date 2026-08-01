import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";
import type { TenantConfig } from "./lib/tenant/types";
import { decodeTenantHeader } from "./lib/tenant/header-codec";
import { TENANT_CONFIG_HEADER } from "./lib/tenant/constants";

vi.mock("./lib/tenant/local-fallback", () => ({
  resolveLocalFallbackTenant: vi.fn(() => null),
}));
vi.mock("./lib/tenant/config-cache", () => ({
  resolveTenantConfig: vi.fn(),
}));

// Imported after the mocks so proxy.ts picks up the mocked modules.
const { resolveTenantConfig } = await import("./lib/tenant/config-cache");
const { proxy } = await import("./proxy");

function makeConfig(id: string, host: string): TenantConfig {
  return {
    id,
    host,
    backendUrl: `https://backend-${id}.internal`,
    publishableKey: `pk_${id}`,
    theme: { storeName: id, domain: host, themeColor: "#fff" },
  };
}

function makeRequest(host: string, extraHeaders: Record<string, string> = {}) {
  return new NextRequest(`https://${host}/shop`, {
    headers: new Headers({ host, ...extraHeaders }),
  });
}

function makeEvent(): NextFetchEvent {
  return { waitUntil: vi.fn() } as unknown as NextFetchEvent;
}

describe("proxy (tenant resolution)", () => {
  beforeEach(() => {
    vi.mocked(resolveTenantConfig).mockReset();
  });

  it("404s an unresolvable host instead of falling back to any tenant", async () => {
    vi.mocked(resolveTenantConfig).mockResolvedValue(null);

    const res = await proxy(makeRequest("nobody-owns-this.example.com"), makeEvent());

    expect(res.status).toBe(404);
  });

  it("attaches the resolved tenant's config to the outgoing request for a known host", async () => {
    const tenantA = makeConfig("tenant-a", "a.jibbit.app");
    vi.mocked(resolveTenantConfig).mockImplementation(async (host: string) =>
      host === "a.jibbit.app" ? tenantA : null,
    );

    const res = await proxy(makeRequest("a.jibbit.app"), makeEvent());

    expect(res.status).not.toBe(404);
    const forwarded = res.headers.get(`x-middleware-request-${TENANT_CONFIG_HEADER}`);
    expect(forwarded).not.toBeNull();
    expect(decodeTenantHeader(forwarded as string)).toEqual(tenantA);
  });

  it("strips a client-supplied x-tenant-config header rather than trusting it", async () => {
    const tenantA = makeConfig("tenant-a", "a.jibbit.app");
    vi.mocked(resolveTenantConfig).mockImplementation(async (host: string) =>
      host === "a.jibbit.app" ? tenantA : null,
    );

    const spoofed = "not-a-real-tenant-config";
    const res = await proxy(
      makeRequest("a.jibbit.app", { [TENANT_CONFIG_HEADER]: spoofed }),
      makeEvent(),
    );

    const forwarded = res.headers.get(`x-middleware-request-${TENANT_CONFIG_HEADER}`);
    expect(forwarded).not.toBe(spoofed);
    expect(decodeTenantHeader(forwarded as string)).toEqual(tenantA);
  });
});
