import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Root-Metadaten: das `robots`-Meta-Tag folgt dem Schalter SITE_INDEXABLE
 * (lib/seo/indexing.ts), und die kanonische Basis ist in BEIDEN Zuständen
 * die Domain des aufgelösten Mandanten — relative Canonicals der Seiten
 * (app/products/[handle]/page.tsx) zeigen auf Staging also nie auf die
 * Produktion.
 */

vi.mock("@/lib/tenant/context", () => ({
  getTenantContext: vi.fn().mockResolvedValue({
    id: "jibbit",
    host: "test.jibbit.ch",
    theme: { domain: "test.jibbit.ch", storeName: "jibbit", themeColor: "#fff" },
  }),
}));

const { generateMetadata } = await import("./layout");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Root-Metadaten", () => {
  it("indexierbar: index, follow — wie bisher", async () => {
    vi.stubEnv("SITE_INDEXABLE", "true");
    expect((await generateMetadata()).robots).toEqual({ index: true, follow: true });
  });

  it("gesperrt: noindex, nofollow", async () => {
    vi.stubEnv("SITE_INDEXABLE", "false");
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: false });
  });

  it("ohne gesetzte Variable: noindex, nofollow (sichere Voreinstellung)", async () => {
    vi.stubEnv("SITE_INDEXABLE", undefined);
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: false });
  });

  it("kanonische Basis ist die Mandantendomain — in beiden Zuständen", async () => {
    for (const value of ["true", "false"]) {
      vi.stubEnv("SITE_INDEXABLE", value);
      const { metadataBase } = await generateMetadata();
      expect(String(metadataBase), value).toBe("https://test.jibbit.ch/");
    }
  });
});
