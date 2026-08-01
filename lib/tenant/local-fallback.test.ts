import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveLocalFallbackTenant } from "./local-fallback";

// `vi.stubEnv` (rather than assigning `process.env.NODE_ENV` directly) both
// sidesteps `NODE_ENV` being typed read-only in recent @types/node and
// guarantees `vi.unstubAllEnvs()` restores everything after each test.
describe("resolveLocalFallbackTenant", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off by default", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOCAL_TENANT_ENABLED", "");
    expect(resolveLocalFallbackTenant()).toBeNull();
  });

  it("returns a tenant built from env vars when explicitly enabled outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOCAL_TENANT_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_MEDUSA_BACKEND_URL", "http://localhost:9000");
    vi.stubEnv("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY", "pk_local_test");

    const tenant = resolveLocalFallbackTenant();

    expect(tenant).not.toBeNull();
    expect(tenant?.backendUrl).toBe("http://localhost:9000");
    expect(tenant?.publishableKey).toBe("pk_local_test");
  });

  it("requirement 6: is hard-disabled in production even if the flag is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_TENANT_ENABLED", "true");

    expect(resolveLocalFallbackTenant()).toBeNull();
  });
});
