import { describe, expect, it } from "vitest";
import { legacyRedirect, legacyRedirectLocation } from "./legacy-redirects";

const redirect = (path: string) => legacyRedirect("jibbit.ch", path);

// https://jibbit.ch/sitemap.xml (Odoo), Stand vor dem Umzug
const SITEMAP: Record<string, string | null> = {
  "/contactus": "/service/kontakt",
  "/impressum": null,
  "/terms": "/agb",
  "/shop/angel-slim-filters-6mm-120stk-13": "/products/angel-slim-filters-6mm-120stk",
  "/shop/black-leaf-el-humeros-konische-hulsen-ks-100x-47": "/?kategorie=papers",
  "/shop/box-24x-elements-blue-rolls-sw-59": "/products/elements-blue-rolls-sw",
  "/shop/box-50x-elements-king-slim-size-ultra-thin-57": "/products/elements-ultra-thin-king-size-slim-kss",
  "/shop/display-24x-greengo-unbleached-slim-rolls-31": "/products/greengo-unbleached-slim-rolls",
  "/shop/display-25x-smoking-brown-kurz-double-window-34": "/products/smoking-brown-kurz-double-window",
  "/shop/display-34x-zig-zag-slim-filter-6mm-120stk-33": "/products/zig-zag-slim-filter-6mm-120stk",
  "/shop/elements-blue-rolls-sw-58": "/products/elements-blue-rolls-sw",
  "/shop/elements-king-slim-size-ultra-thin-56": "/products/elements-ultra-thin-king-size-slim-kss",
  "/shop/gizeh-dw-extra-fine-61": "/products/gizeh-dw-extra-fine",
  "/shop/greengo-unbleached-slim-rolls-24": "/products/greengo-unbleached-slim-rolls",
  "/shop/kailar-filter-5-9mm-65stk-pink-27": "/products/kailar-filter-5-9mm-65stk-pink",
  "/shop/kailar-filter-5-9mm-65stk-schwarz-26": "/products/kailar-filter-5-9mm-65stk-schwarz",
  "/shop/kailar-filter-5-9mm-65stk-weiss-11": "/products/kailar-filter-5-9mm-65stk-weiss",
  "/shop/kailar-filter-9mm-big-100-stk-schwarz-29": "/products/kailar-filter-9mm-big-100-stk-schwarz",
  "/shop/ocb-bio-slim-organic-hemp-rolls-40": "/?kategorie=papers",
  "/shop/3-ocb-premium-kss-papers-mit-filter-7": "/?kategorie=papers",
  "/shop/7-ocb-premium-rolls-slim-3": "/products/ocb-black-premium-rolls-slim",
  "/shop/5-ocb-premium-kurz-9": "/products/ocb-premium-kurz",
  "/shop/ocb-slim-filter-bio-120-tips-41": "/products/ocb-slim-filter-bio-120-tips",
  "/shop/purize-aktivkohlefilter-9mm-60": "/products/purize-aktivkohlefilter-6mm",
  "/shop/purize-xtra-slim-xmas-6mm-54": "/products/purize-xtra-slim-6mm",
  "/shop/purize-super-slim-white-5mm-48": "/products/purize-super-slim-white-o5mm",
  "/shop/6-purize-xtra-slim-white-50er-pack-5-9mm-10": "/products/purize-xtra-slim-white-50er-pack-5-9mm",
  "/shop/raw-black-kss-papers-2": "/products/raw-classic-king-size-slim",
  "/shop/4-raw-classic-rolls-slim-8": "/products/raw-classic-rolls-slim",
  "/shop/raw-kristallglas-aschenbecher-darkside-52": "/products/raw-kristallglas-aschenbecher-darkside",
  "/shop/raw-kristallglas-aschenbecher-rainbow-50": "/products/raw-kristallglas-aschenbecher-rainbow",
  "/shop/raw-kristallglas-aschenbecher-ruby-51": "/products/raw-kristallglas-aschenbecher-ruby",
  "/shop/silikon-dose-22mm-55": "/products/silikon-dose-22-mm",
  "/shop/smoking-brown-kurz-double-window-28": "/products/smoking-brown-kurz-double-window",
  "/shop/zig-zag-slim-filter-6mm-120stk-32": "/products/zig-zag-slim-filter-6mm-120stk",
  "/shop/dubi-aktivkohlefilter-7mm-49": "/products/dubi-aktivkohlefilter-o7mm",
  "/shop": "/",
  "/": null,
  "/website/info": "/impressum",
};

describe("legacyRedirect", () => {
  it.each(Object.entries(SITEMAP))("%s -> %s", (path, target) => {
    expect(redirect(path)).toBe(target);
  });

  it("matcht Produkte über die ID, nicht den Slug", () => {
    expect(redirect("/shop/coming-soon-11")).toBe("/products/kailar-filter-5-9mm-65stk-weiss");
    expect(redirect("/shop/irgendwas-24")).toBe("/products/greengo-unbleached-slim-rolls");
  });

  // Im Live-Shop erreichbar, aber nicht in dessen Sitemap (Stand 2026-09-29).
  it.each([
    ["/shop/purize-super-slim-white-50er-pack-5mm-36", "/products/purize-super-slim-white-o5mm"],
    ["/shop/purize-xtra-slim-white-50er-pack-5mm-36", "/products/purize-super-slim-white-o5mm"],
    ["/shop/gizeh-dw-extra-fine-37", "/products/gizeh-dw-extra-fine"],
    ["/shop/1-black-leaf-el-humeros-konische-hulsen-ks-100x-23", "/?kategorie=papers"],
  ])("ausserhalb der Sitemap: %s -> %s", (path, target) => {
    expect(redirect(path)).toBe(target);
  });

  it("schickt unbekannte Odoo-Shop-Pfade auf die Startseite", () => {
    expect(redirect("/shop/unbekannt-999")).toBe("/");
    expect(redirect("/shop/category/papers-3")).toBe("/");
    expect(redirect("/shop/cart")).toBe("/");
  });

  it("leitet Konto-Pfade um", () => {
    expect(redirect("/web/login")).toBe("/konto/anmelden");
  });

  it.each([
    ["/en", "/"],
    ["/fr_CH", "/"],
    ["/it/", "/"],
    ["/en/shop", "/"],
    ["/fr_CH/contactus", "/service/kontakt"],
    ["/it/shop/gizeh-dw-extra-fine-61", "/products/gizeh-dw-extra-fine"],
    ["/en/impressum", "/impressum"],
  ])("Sprachpfad %s -> %s", (path, target) => {
    expect(redirect(path)).toBe(target);
  });

  it("lässt eigene Pfade in Ruhe", () => {
    for (const path of ["/products/gizeh-dw-extra-fine", "/agb", "/english", "/items"]) {
      expect(redirect(path)).toBeNull();
    }
  });

  it("gilt nur für jibbit", () => {
    expect(legacyRedirect("test.jibbit.ch", "/terms")).toBe("/agb");
    expect(legacyRedirect("anderer-shop.ch", "/terms")).toBeNull();
    expect(legacyRedirect("notjibbit.ch", "/terms")).toBeNull();
  });
});

describe("legacyRedirectLocation", () => {
  const location = (path: string, search: string) =>
    legacyRedirectLocation("jibbit.ch", path, search);

  // Wörtlich die Adressen, die die Search Console für den Odoo-Shop führt.
  it.each([
    ["/fr_CH/shop/purize-super-slim-white-50er-pack-5mm-36", "?search=filter", "/products/purize-super-slim-white-o5mm"],
    ["/fr_CH/shop/purize-super-slim-white-50er-pack-5mm-36", "?order=list_price+asc", "/products/purize-super-slim-white-o5mm"],
    ["/fr_CH/shop/kailar-filter-5-9mm-65stk-schwarz-26", "?search=filter", "/products/kailar-filter-5-9mm-65stk-schwarz"],
    ["/shop/purize-xtra-slim-white-50er-pack-5mm-36", "?order=list_price+asc", "/products/purize-super-slim-white-o5mm"],
    ["/it/shop/purize-super-slim-white-50er-pack-5mm-36", "?order=list_price+asc", "/products/purize-super-slim-white-o5mm"],
    ["/it/shop/ocb-slim-filter-bio-120-tips-41", "?search=filter", "/products/ocb-slim-filter-bio-120-tips"],
    ["/shop/ocb-slim-filter-bio-10x120-tips-41", "?search=filter", "/products/ocb-slim-filter-bio-120-tips"],
    ["/shop/kailar-filer-5-9mm-65stk-schwarz-26", "?search=filter", "/products/kailar-filter-5-9mm-65stk-schwarz"],
    ["/it/shop/kailar-filter-5-9mm-65stk-schwarz-26", "?search=filter", "/products/kailar-filter-5-9mm-65stk-schwarz"],
    ["/fr_CH/shop/ocb-slim-filter-bio-120-tips-41", "?search=filter", "/products/ocb-slim-filter-bio-120-tips"],
    ["/en/shop/ocb-slim-filter-bio-120-tips-41", "?search=filter", "/products/ocb-slim-filter-bio-120-tips"],
    ["/shop/ocb-slim-filter-bio-10x120-tips-41", "", "/products/ocb-slim-filter-bio-120-tips"],
  ])("Search Console: %s%s -> %s", (path, search, target) => {
    expect(location(path, search)).toBe(target);
  });

  it("wirft Odoo-Parameter weg, behält Kampagnenparameter", () => {
    expect(
      location("/shop/x-41", "?search=filter&utm_source=newsletter&order=name+asc&gclid=abc"),
    ).toBe("/products/ocb-slim-filter-bio-120-tips?utm_source=newsletter&gclid=abc");
  });

  it("hängt Kampagnenparameter an ein Kategorieziel an", () => {
    expect(location("/shop/x-47", "?utm_campaign=herbst&search=x")).toBe(
      "/?kategorie=papers&utm_campaign=herbst",
    );
  });

  it("lässt das Kategorieziel nicht von aussen überschreiben", () => {
    expect(location("/shop/x-47", "?kategorie=filter")).toBe("/?kategorie=papers");
  });

  it("behält `kategorie` nur auf der früheren Katalogadresse /shop", () => {
    expect(location("/shop", "?kategorie=filter")).toBe("/?kategorie=filter");
    expect(location("/shop", "?search=filter&order=list_price+asc")).toBe("/");
    expect(location("/shop/x-41", "?kategorie=filter")).toBe(
      "/products/ocb-slim-filter-bio-120-tips",
    );
  });

  it("gibt für eigene Pfade und fremde Mandanten nichts zurück", () => {
    expect(location("/products/gizeh-dw-extra-fine", "?search=x")).toBeNull();
    expect(legacyRedirectLocation("anderer-shop.ch", "/shop/x-41", "")).toBeNull();
  });
});
