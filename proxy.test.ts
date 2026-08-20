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
const { proxy, config } = await import("./proxy");

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

/**
 * Der Matcher ist die eigentliche Sicherheitsgrenze — die Tests oben rufen
 * `proxy()` direkt auf und sagen deshalb NICHTS darüber aus, welche Pfade dort
 * überhaupt ankommen. Ein zu weit gefasster Ausschluss würde ganze Seiten an
 * der Tenant-Auflösung vorbeischleusen, ohne dass ein Test rot wird.
 */
describe("proxy (matcher)", () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it("lässt Seiten, sitemap und robots durch die Auflösung laufen", () => {
    for (const path of [
      "/",
      "/shop",
      "/products/raw-classic-rolls-slim",
      "/sitemap.xml",
      "/robots.txt",
      "/mediathek", // NICHT vom media/-Ausschluss erfasst
    ]) {
      expect(matcher.test(path), path).toBe(true);
    }
  });

  it("nimmt genau die Pfade aus, die keinen Tenant-Header vertragen", () => {
    for (const path of [
      "/_next/static/chunks/main.js",
      "/_next/image",
      "/favicon.ico",
      "/healthz",
      // Der Bildoptimizer ruft diesen Pfad ohne jeden Header auf und würde
      // hier sonst 404 kassieren — siehe app/media/[...path]/route.ts.
      "/media/test.jibbit.ch/1755-foo.webp",
    ]) {
      expect(matcher.test(path), path).toBe(false);
    }
  });
});
