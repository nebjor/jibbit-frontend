import { afterEach, describe, expect, it, vi } from "vitest";
import { generateMetadata } from "./page";

/**
 * Das Impressum setzt ein eigenes `robots` — und ein `robots` auf
 * Seitenebene ERSETZT das des Layouts. Ein festes `index: true` hätte die
 * Noindex-Sperre eines Staging-Deployments hier wieder aufgehoben.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Impressum-Metadaten", () => {
  it("indexierbar: index, nofollow — wie bisher", () => {
    vi.stubEnv("SITE_INDEXABLE", "true");
    expect(generateMetadata().robots).toEqual({ index: true, follow: false });
  });

  it("gesperrt: die Seite hebt die Sperre nicht auf", () => {
    vi.stubEnv("SITE_INDEXABLE", undefined);
    expect(generateMetadata().robots).toEqual({ index: false, follow: false });
  });
});
