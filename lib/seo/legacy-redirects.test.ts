import { describe, expect, it } from "vitest";
import { legacyRedirect } from "./legacy-redirects";

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
  "/shop/ocb-bio-slim-organic-hemp-rolls-40": "/products/ocb-bio-slim-organic-hemp-rolls",
  "/shop/3-ocb-premium-kss-papers-mit-filter-7": "/products/ocb-premium-kss-papers-mit-filter",
  "/shop/7-ocb-premium-rolls-slim-3": "/products/ocb-premium-rolls-slim",
  "/shop/5-ocb-premium-kurz-9": "/products/ocb-premium-kurz",
  "/shop/ocb-slim-filter-bio-120-tips-41": "/products/ocb-slim-filter-bio-120-tips",
  "/shop/purize-aktivkohlefilter-9mm-60": "/?kategorie=filter",
  "/shop/purize-xtra-slim-xmas-6mm-54": "/?kategorie=filter",
  "/shop/purize-super-slim-white-5mm-48": "/products/purize-super-slim-white-o5mm",
  "/shop/6-purize-xtra-slim-white-50er-pack-5-9mm-10": "/products/purize-xtra-slim-white-50er-pack-5-9mm",
  "/shop/raw-black-kss-papers-2": "/?kategorie=papers",
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
