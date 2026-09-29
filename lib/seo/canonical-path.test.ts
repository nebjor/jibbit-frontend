import { describe, expect, it } from "vitest";
import {
  canonicalHostRedirect,
  isWwwAlias,
  lowercaseProductPath,
} from "./canonical-path";

describe("lowercaseProductPath", () => {
  it("schreibt Produktadressen klein", () => {
    expect(lowercaseProductPath("/products/OCB-Slim-Filter-Bio-120-Tips")).toBe(
      "/products/ocb-slim-filter-bio-120-tips",
    );
  });

  it("lässt bereits kleine Adressen in Ruhe — keine Umleitung auf sich selbst", () => {
    expect(lowercaseProductPath("/products/ocb-slim-filter-bio-120-tips")).toBeNull();
  });

  it("fasst nichts ausserhalb von /products/ an", () => {
    for (const path of [
      "/",
      "/Impressum",
      "/media/test.jibbit.ch/1755-Foo.webp",
      "/konto/passwort-neu",
      "/productsX/Foo",
    ]) {
      expect(lowercaseProductPath(path), path).toBeNull();
    }
  });
});

describe("canonicalHostRedirect", () => {
  it("www. -> Hauptdomain, der Pfad bleibt", () => {
    expect(canonicalHostRedirect("www.jibbit.ch", "jibbit.ch", "/agb")).toBe("/agb");
    expect(isWwwAlias("WWW.jibbit.ch", "jibbit.ch")).toBe(true);
  });

  it("verbindet Host und Schreibweise zu einem Sprung", () => {
    expect(
      canonicalHostRedirect("www.jibbit.ch", "jibbit.ch", "/products/OCB-Premium-Kurz"),
    ).toBe("/products/ocb-premium-kurz");
  });

  it("tut nichts, wenn Host und Schreibweise stimmen", () => {
    expect(canonicalHostRedirect("jibbit.ch", "jibbit.ch", "/agb")).toBeNull();
    expect(canonicalHostRedirect("test.jibbit.ch", "test.jibbit.ch", "/")).toBeNull();
  });

  it("fasst andere Abweichungen zwischen Host und Domain nicht an", () => {
    expect(canonicalHostRedirect("shop.jibbit.app", "meinshop.ch", "/agb")).toBeNull();
    expect(isWwwAlias("www2.jibbit.ch", "jibbit.ch")).toBe(false);
  });
});
