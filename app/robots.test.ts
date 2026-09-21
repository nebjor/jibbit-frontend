import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * robots.txt in beiden Zuständen des Schalters SITE_INDEXABLE
 * (lib/seo/indexing.ts). Der gesperrte Zustand ist der heikle: er darf das
 * Crawlen NICHT verbieten — sonst sieht Google das Noindex nie.
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

  it("gesperrt: KEIN Disallow — der Crawler muss das Noindex lesen dürfen", async () => {
    vi.stubEnv("SITE_INDEXABLE", "false");
    const result = await robots();
    expect(result.rules).toEqual({ userAgent: "*", allow: "/" });
    expect(JSON.stringify(result)).not.toContain("disallow");
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
