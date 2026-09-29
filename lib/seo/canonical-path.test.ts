import { describe, expect, it } from "vitest";
import { lowercaseProductPath } from "./canonical-path";

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
