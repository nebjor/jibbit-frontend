import { describe, expect, it } from "vitest";
import {
  NOINDEX_DIRECTIVE,
  X_ROBOTS_TAG,
  applyIndexingHeader,
  indexingStartupMessage,
  isSiteIndexable,
  isTenantlessAssetPath,
  robotsMetadata,
} from "./indexing";

/**
 * Der Schalter ist absichtlich einseitig: NUR ein ausdrückliches «ein» macht
 * ein Deployment indexierbar. Jeder Test hier, der «alles andere => noindex»
 * prüft, schützt davor, dass Staging still im Google-Index landet.
 */

describe("isSiteIndexable", () => {
  it("ist nur bei ausdrücklichem Ein-Wert wahr", () => {
    for (const value of ["true", "TRUE", " true ", "1", "on", "ja", "yes"]) {
      expect(isSiteIndexable({ SITE_INDEXABLE: value }), value).toBe(true);
    }
  });

  it("fällt bei fehlender, leerer oder vertippter Variable auf NOINDEX", () => {
    expect(isSiteIndexable({})).toBe(false);
    for (const value of ["", " ", "false", "0", "off", "treu", "ture", "production"]) {
      expect(isSiteIndexable({ SITE_INDEXABLE: value }), value).toBe(false);
    }
  });

  it("lässt sich NICHT über eine NEXT_PUBLIC_-Variante einschalten", () => {
    // Die würde der Build einfrieren — sie darf gar keine Wirkung haben.
    expect(isSiteIndexable({ NEXT_PUBLIC_SITE_INDEXABLE: "true" })).toBe(false);
  });
});

describe("robotsMetadata", () => {
  it("gesperrt: noindex, nofollow — egal was die Seite sich wünscht", () => {
    expect(robotsMetadata(undefined, {})).toEqual({ index: false, follow: false });
    expect(robotsMetadata({ index: true, follow: false }, {})).toEqual({
      index: false,
      follow: false,
    });
  });

  it("indexierbar: unverändert index, follow bzw. der Wunsch der Seite", () => {
    const env = { SITE_INDEXABLE: "true" };
    expect(robotsMetadata(undefined, env)).toEqual({ index: true, follow: true });
    expect(robotsMetadata({ index: true, follow: false }, env)).toEqual({
      index: true,
      follow: false,
    });
  });
});

describe("applyIndexingHeader", () => {
  it("gesperrt: setzt X-Robots-Tag und lässt andere Header stehen", () => {
    const headers = applyIndexingHeader(
      new Headers({ "content-type": "text/plain" }),
      {},
    );
    expect(headers.get(X_ROBOTS_TAG)).toBe(NOINDEX_DIRECTIVE);
    expect(NOINDEX_DIRECTIVE).toBe("noindex, nofollow");
    expect(headers.get("content-type")).toBe("text/plain");
  });

  it("indexierbar: der Header existiert gar nicht — Verhalten wie bisher", () => {
    const headers = applyIndexingHeader(new Headers(), { SITE_INDEXABLE: "true" });
    expect(headers.has(X_ROBOTS_TAG)).toBe(false);
  });
});

describe("isTenantlessAssetPath", () => {
  it("trifft genau Bildoptimizer, Bildproxy und Loader-Assets", () => {
    for (const path of [
      "/_next/image",
      "/media/test.jibbit.ch/1755-foo.webp",
      "/loader/joint.png",
    ]) {
      expect(isTenantlessAssetPath(path), path).toBe(true);
    }
  });

  it("lässt KEINE Seite an der Tenant-Auflösung vorbei", () => {
    for (const path of [
      "/",
      "/mediathek",
      "/media",
      "/loader",
      "/products/media/foo",
      "/robots.txt",
      "/sitemap.xml",
      "/_next/imagefoo",
    ]) {
      expect(isTenantlessAssetPath(path), path).toBe(false);
    }
  });
});

describe("indexingStartupMessage", () => {
  it("warnt laut, wenn die Variable fehlt — und nennt den Go-live-Schritt", () => {
    const { level, text } = indexingStartupMessage({});
    expect(level).toBe("warn");
    expect(text).toContain("NOINDEX AKTIV");
    expect(text).toContain("nicht gesetzt");
    expect(text).toContain("SITE_INDEXABLE=true");
  });

  it("zeigt einen vertippten Wert im Klartext", () => {
    const { level, text } = indexingStartupMessage({ SITE_INDEXABLE: "ture" });
    expect(level).toBe("warn");
    expect(text).toContain('SITE_INDEXABLE="ture"');
  });

  it("meldet den indexierbaren Zustand als Info, nicht als Warnung", () => {
    const { level, text } = indexingStartupMessage({ SITE_INDEXABLE: "true" });
    expect(level).toBe("info");
    expect(text).toContain("INDEXIERBAR");
  });
});
