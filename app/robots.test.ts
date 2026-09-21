import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * robots.txt in beiden Zuständen des Schalters SITE_INDEXABLE
 * (lib/seo/indexing.ts).
 */

vi.mock("@/lib/tenant/context", () => ({
  getTenantContext: vi
    .fn()
    .mockResolvedValue({ theme: { domain: "test.jibbit.ch" } }),
}));

const { default: robots } = await import("./robots");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("robots.txt", () => {
  it("indexierbar: Allow / und die Sitemap des Mandanten — wie bisher", async () => {
    vi.stubEnv("SITE_INDEXABLE", "true");
    expect(await robots()).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://test.jibbit.ch/sitemap.xml",
    });
  });

  it("gesperrt: Disallow /", async () => {
    vi.stubEnv("SITE_INDEXABLE", "false");
    expect((await robots()).rules).toEqual({ userAgent: "*", disallow: "/" });
  });

  it("gesperrt: führt keine Sitemap auf", async () => {
    vi.stubEnv("SITE_INDEXABLE", "false");
    expect((await robots()).sitemap).toBeUndefined();
  });

  it("ohne gesetzte Variable gilt der gesperrte Zustand", async () => {
    vi.stubEnv("SITE_INDEXABLE", undefined);
    expect((await robots()).sitemap).toBeUndefined();
  });
});
