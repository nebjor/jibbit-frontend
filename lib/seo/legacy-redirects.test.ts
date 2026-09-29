import { describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import {
  KEPT_PATHS,
  LANGUAGE_PREFIX,
  ODOO_PRODUCTS,
  UNPUBLISHED_TARGETS,
  legacyAnswer,
  legacyGone,
  legacyRedirect,
  legacyRedirectLocation,
} from "./legacy-redirects";
import { SITEMAP_STATIC_PATHS } from "./sitemap";
import legacyPaths from "./legacy-paths.fixture.json";
import staging from "./staging-handles.fixture.json";

const redirect = (path: string) => legacyRedirect("jibbit.ch", path);

const HUMEROS = "/products/black-leaf-el-humeros-konische-huelsen-ks-100x";
const PAPERS = "/?kategorie=papers";

// https://jibbit.ch/sitemap.xml (Odoo), Stand vor dem Umzug
const SITEMAP: Record<string, string | null> = {
  "/contactus": "/service/kontakt",
  "/impressum": null,
  // Kein 301: /terms ist eine eigene Seite mit dem Inhalt von /agb.
  "/terms": null,
  "/shop/angel-slim-filters-6mm-120stk-13": "/products/angel-slim-filters-6mm-120stk",
  "/shop/black-leaf-el-humeros-konische-hulsen-ks-100x-47": HUMEROS,
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
  // Im neuen Shop nicht geführt: die Kategorie, nicht die Startseite.
  "/shop/3-ocb-premium-kss-papers-mit-filter-7": PAPERS,
  "/shop/7-ocb-premium-rolls-slim-3": "/products/ocb-black-premium-rolls-slim",
  "/shop/5-ocb-premium-kurz-9": "/products/ocb-premium-kurz",
  "/shop/ocb-slim-filter-bio-120-tips-41": "/products/ocb-slim-filter-bio-120-tips",
  "/shop/purize-aktivkohlefilter-9mm-60": "/products/purize-aktivkohlefilter-9mm",
  "/shop/purize-xtra-slim-xmas-6mm-54": "/products/purize-xtra-slim-6mm",
  "/shop/purize-super-slim-white-5mm-48": "/products/purize-super-slim-white-5mm",
  "/shop/6-purize-xtra-slim-white-50er-pack-5-9mm-10": "/products/purize-xtra-slim-white-50er-pack-5-9mm",
  "/shop/raw-black-kss-papers-2": "/products/raw-black-classic-king-size-slim",
  "/shop/4-raw-classic-rolls-slim-8": "/products/raw-classic-rolls-slim",
  "/shop/raw-kristallglas-aschenbecher-darkside-52": "/products/raw-kristallglas-aschenbecher-darkside",
  "/shop/raw-kristallglas-aschenbecher-rainbow-50": "/products/raw-kristallglas-aschenbecher-rainbow",
  "/shop/raw-kristallglas-aschenbecher-ruby-51": "/products/raw-kristallglas-aschenbecher-ruby",
  "/shop/silikon-dose-22mm-55": "/products/silikon-dose-22-mm",
  "/shop/smoking-brown-kurz-double-window-28": "/products/smoking-brown-kurz-double-window",
  "/shop/zig-zag-slim-filter-6mm-120stk-32": "/products/zig-zag-slim-filter-6mm-120stk",
  "/shop/dubi-aktivkohlefilter-7mm-49": "/products/dubi-aktivkohlefilter-7mm",
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
    ["/shop/purize-super-slim-white-50er-pack-5mm-36", "/products/purize-super-slim-white-5mm"],
    ["/shop/purize-xtra-slim-white-50er-pack-5mm-36", "/products/purize-super-slim-white-5mm"],
    ["/shop/gizeh-dw-extra-fine-37", "/products/gizeh-dw-extra-fine"],
    ["/shop/1-black-leaf-el-humeros-konische-hulsen-ks-100x-23", HUMEROS],
    // Nur der Search Console bekannt; Vorgänger von ID 7.
    ["/shop/ocb-premium-kss-papers-filter-5", PAPERS],
  ])("ausserhalb der Sitemap: %s -> %s", (path, target) => {
    expect(redirect(path)).toBe(target);
  });

  // Die vier Produktseiten, die laut Search Console Klicks bekommen haben.
  it.each([
    ["/shop/dubi-aktivkohlefilter-7mm-49", "/products/dubi-aktivkohlefilter-7mm"],
    ["/en/shop/kailar-filter-5-9mm-65stk-pink-27", "/products/kailar-filter-5-9mm-65stk-pink"],
    ["/shop/greengo-unbleached-slim-rolls-24", "/products/greengo-unbleached-slim-rolls"],
    ["/shop/2-angel-slim-filters-13", "/products/angel-slim-filters-6mm-120stk"],
  ])("Seite mit Klicks: %s -> %s", (path, target) => {
    expect(redirect(path)).toBe(target);
    expect(staging.produkte).toContain(target.replace("/products/", ""));
  });

  it("schickt unbekannte Odoo-Shop-Pfade auf die Startseite", () => {
    expect(redirect("/shop/unbekannt-999")).toBe("/");
    expect(redirect("/shop/category/papers-3")).toBe("/");
    expect(redirect("/shop/page/2")).toBe("/");
  });

  it("leitet Seiten mit Entsprechung um", () => {
    expect(redirect("/web/login")).toBe("/konto/anmelden");
    expect(redirect("/about-us")).toBe("/impressum");
  });

  it.each([
    ["/en", "/"],
    ["/fr_CH", "/"],
    ["/it/", "/"],
    ["/en/shop", "/"],
    ["/fr_CH/contactus", "/service/kontakt"],
    ["/it/shop/gizeh-dw-extra-fine-61", "/products/gizeh-dw-extra-fine"],
    ["/en/impressum", "/impressum"],
    // Mit Sprachpfad ist /terms eine gewöhnliche Weiterleitung.
    ["/fr_CH/terms", "/agb"],
    ["/de_CH/terms", "/agb"],
    // Sprachpfade, die keine feste Liste kannte.
    ["/fr_BE/shop/raw-black-papers-king-size-slim-3", "/products/ocb-black-premium-rolls-slim"],
    ["/de_CH/shop/x-41", "/products/ocb-slim-filter-bio-120-tips"],
    ["/nl_BE/contactus", "/service/kontakt"],
  ])("Sprachpfad %s -> %s", (path, target) => {
    expect(redirect(path)).toBe(target);
  });

  it("lässt eigene Pfade in Ruhe", () => {
    for (const path of ["/products/gizeh-dw-extra-fine", "/agb", "/english", "/items"]) {
      expect(redirect(path)).toBeNull();
      expect(legacyAnswer("jibbit.ch", path, "")).toBeNull();
    }
  });

  it("gilt nur für jibbit", () => {
    expect(legacyRedirect("test.jibbit.ch", "/contactus")).toBe("/service/kontakt");
    expect(legacyRedirect("anderer-shop.ch", "/contactus")).toBeNull();
    expect(legacyRedirect("notjibbit.ch", "/contactus")).toBeNull();
    expect(legacyGone("anderer-shop.ch", "/shop/cart")).toBe(false);
  });
});

/**
 * Der Sprachpfad ist ein Muster, keine Liste. Es darf keine Route der
 * Storefront treffen — sonst leitete der Proxy eine eigene Seite weg.
 */
describe("Sprachpfad-Muster", () => {
  it.each(["/en", "/it", "/fr_CH", "/de_CH", "/fr_BE", "/en/shop", "/it/"])(
    "erkennt %s",
    (path) => {
      expect(LANGUAGE_PREFIX.test(path)).toBe(true);
    },
  );

  it.each(["/agb", "/english", "/EN", "/fr_ch", "/fr-CH", "/e", "/", "/shop/en", "/fr_CHF"])(
    "erkennt %s nicht",
    (path) => {
      expect(LANGUAGE_PREFIX.test(path)).toBe(false);
    },
  );

  it("trifft keine Route der Storefront", () => {
    const routes = readdirSync(new URL("../../app", import.meta.url), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `/${entry.name}`);
    expect(routes.length).toBeGreaterThan(5);
    expect(routes.filter((route) => LANGUAGE_PREFIX.test(route))).toEqual([]);
  });
});

describe("legacyGone", () => {
  it.each([
    "/shop/cart",
    "/de_CH/shop/cart",
    "/fr_CH/shop/change_pricelist/1",
    "/fr_CH/shop/change_pricelist/default-chf-pricelist-chf-1",
    "/website/translations",
    "/web/image/product.template/10/image_1920",
    "/en/blog",
    "/blog/unser-blog-1/post-3",
  ])("%s gibt es nicht mehr", (path) => {
    expect(legacyGone("jibbit.ch", path)).toBe(true);
    expect(redirect(path)).toBeNull();
    expect(legacyAnswer("jibbit.ch", path, "?unique=8d486df")).toEqual({ kind: "gone" });
  });

  it.each(["/web/login", "/website/info", "/shop", "/shop/x-41", "/agb", "/", "/webshop"])(
    "%s ist nicht «gone»",
    (path) => {
      expect(legacyGone("jibbit.ch", path)).toBe(false);
    },
  );
});

/**
 * https://jibbit.ch/terms ist im Merchant Center als URL der
 * Rückgaberichtlinie hinterlegt und muss genau dort weiter antworten.
 */
describe("/terms bleibt", () => {
  it("wird weder umgeleitet noch entfernt", () => {
    expect(redirect("/terms")).toBeNull();
    expect(legacyGone("jibbit.ch", "/terms")).toBe(false);
    expect(legacyAnswer("jibbit.ch", "/terms", "?utm_source=merchant")).toBeNull();
  });

  it("jede Adresse, die bleibt, hat eine Seite in der Storefront", () => {
    expect([...KEPT_PATHS]).toEqual(["/terms"]);
    for (const path of KEPT_PATHS) {
      expect(
        existsSync(new URL(`../../app${path}/page.tsx`, import.meta.url)),
        path,
      ).toBe(true);
    }
  });

  it("mit Sprachpfad ist es eine gewöhnliche Weiterleitung", () => {
    expect(redirect("/fr_CH/terms")).toBe("/agb");
  });
});

describe("legacyRedirectLocation", () => {
  const location = (path: string, search: string) =>
    legacyRedirectLocation("jibbit.ch", path, search);

  // Wörtlich die Adressen, die die Search Console für den Odoo-Shop führt.
  it.each([
    ["/fr_CH/shop/purize-super-slim-white-50er-pack-5mm-36", "?search=filter", "/products/purize-super-slim-white-5mm"],
    ["/fr_CH/shop/purize-super-slim-white-50er-pack-5mm-36", "?order=list_price+asc", "/products/purize-super-slim-white-5mm"],
    ["/fr_CH/shop/kailar-filter-5-9mm-65stk-schwarz-26", "?search=filter", "/products/kailar-filter-5-9mm-65stk-schwarz"],
    ["/shop/purize-xtra-slim-white-50er-pack-5mm-36", "?order=list_price+asc", "/products/purize-super-slim-white-5mm"],
    ["/it/shop/purize-super-slim-white-50er-pack-5mm-36", "?order=list_price+asc", "/products/purize-super-slim-white-5mm"],
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
    expect(location("/shop/x-7", "?utm_campaign=herbst&search=x")).toBe(
      "/?kategorie=papers&utm_campaign=herbst",
    );
  });

  it("lässt das Kategorieziel nicht von aussen überschreiben", () => {
    expect(location("/shop/x-7", "?kategorie=filter")).toBe(PAPERS);
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

/**
 * JEDES ZIEL MUSS ES GEBEN. Geprüft gegen den Stand von test.jibbit.ch in
 * staging-handles.fixture.json — ein Abbild, keine Live-Abfrage; gegen eine
 * laufende Umgebung prüft `npm run smoke -- --base-url=…` dieselbe Liste.
 */
describe("Ziele der Odoo-Weiterleitungen", () => {
  const published = new Set(staging.produkte);
  const categories = new Set(staging.kategorien);
  const targets = [...new Set(Object.values(ODOO_PRODUCTS))];

  it("kennt alle 37 Produkt-IDs aus der Search Console", () => {
    expect(Object.keys(ODOO_PRODUCTS).map(Number)).toEqual([
      2, 3, 5, 7, 8, 9, 10, 11, 13, 23, 24, 26, 27, 28, 29, 31, 32, 33, 34, 36,
      37, 40, 41, 47, 48, 49, 50, 51, 52, 54, 55, 56, 57, 58, 59, 60, 61,
    ]);
  });

  it.each(targets.filter((t) => !t.startsWith("/")))(
    "%s ist veröffentlicht oder als unveröffentlicht vermerkt",
    (handle) => {
      expect(published.has(handle) || UNPUBLISHED_TARGETS.includes(handle)).toBe(true);
    },
  );

  it("Kategorieziele zeigen auf eine Kategorie, die es gibt", () => {
    const paths = targets.filter((t) => t.startsWith("/"));
    expect(paths).toEqual([PAPERS]);
    for (const target of paths) {
      const handle = new URL(target, "https://x.invalid").searchParams.get("kategorie");
      expect(handle && categories.has(handle)).toBe(true);
    }
  });

  it("Handles sind klein geschrieben und ohne Sonderzeichen", () => {
    for (const handle of targets.filter((t) => !t.startsWith("/"))) {
      expect(handle).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("vermerkt als unveröffentlicht nur Ziele, die auch verwendet werden", () => {
    for (const handle of UNPUBLISHED_TARGETS) {
      expect(targets).toContain(handle);
    }
  });

  // Sobald ein Handle veröffentlicht ist und ins Abbild kommt, gehört er aus
  // der Liste gestrichen — sonst verschweigt die Warnung irgendwann ein 404.
  it("führt kein Ziel gleichzeitig als veröffentlicht und unveröffentlicht", () => {
    expect(UNPUBLISHED_TARGETS.filter((h) => published.has(h))).toEqual([]);
  });

  it("kennt die drei IDs, deren Produkte noch Entwurf sind", () => {
    expect([...UNPUBLISHED_TARGETS].sort()).toEqual([
      "black-leaf-el-humeros-konische-huelsen-ks-100x",
      "ocb-bio-slim-organic-hemp-rolls",
    ]);
    expect(
      Object.entries(ODOO_PRODUCTS)
        .filter(([, handle]) => UNPUBLISHED_TARGETS.includes(handle))
        .map(([id]) => id),
    ).toEqual(["23", "40", "47"]);
  });
});

/**
 * DIE GANZE LISTE. Jede Adresse, die die Search Console für jibbit.ch kennt
 * (legacy-paths.fixture.json, 485 Pfade), läuft durch dieselbe Funktion wie
 * im Proxy. Geprüft wird, was beim Umzug teuer ist:
 *
 *   - keine Produktadresse landet auf der Startseite (Soft 404),
 *   - kein Ziel wird selbst wieder umgeleitet (Kette),
 *   - jedes Ziel ist eine Seite, die es gibt.
 */
describe("alle Adressen aus der Search Console", () => {
  const split = (entry: string) => {
    const at = entry.indexOf("?");
    return at === -1
      ? { pathname: entry, search: "" }
      : { pathname: entry.slice(0, at), search: entry.slice(at) };
  };
  const all = legacyPaths.pfade.map((entry) => ({
    entry,
    ...split(entry),
    answer: legacyAnswer("jibbit.ch", split(entry).pathname, split(entry).search),
  }));
  const withoutLanguage = (pathname: string) =>
    pathname.replace(LANGUAGE_PREFIX, "") || "/";

  /** Adressen, für die die Startseite die RICHTIGE Antwort ist. */
  const HOME_IS_RIGHT = /^\/(?:shop(?:\/page\/\d+)?)?$/;

  const knownTargets = new Set<string>([
    ...SITEMAP_STATIC_PATHS.map((p) => p || "/"),
    "/konto/anmelden",
    ...staging.kategorien.map((h) => `/?kategorie=${h}`),
    ...[...staging.produkte, ...UNPUBLISHED_TARGETS].map((h) => `/products/${h}`),
  ]);

  it("ist die Liste aus dem Export — 485 Pfade", () => {
    expect(all).toHaveLength(485);
  });

  it("beantwortet jede Adresse: Weiterleitung, 410 oder eigene Seite", () => {
    const unanswered = all
      .filter(({ answer }) => answer === null)
      .map(({ pathname }) => pathname);
    // Ohne Antwort bleiben nur Adressen, die im neuen Shop dieselben sind.
    expect([...new Set(unanswered)].sort()).toEqual(["/", "/impressum", "/terms"]);
  });

  it("schickt keine Produktadresse auf die Startseite", () => {
    const products = all.filter(({ pathname }) =>
      /^\/shop\/[^/]+-\d+$/.test(withoutLanguage(pathname)),
    );
    expect(products.length).toBeGreaterThan(400);
    for (const { entry, answer } of products) {
      expect(answer?.kind, entry).toBe("redirect");
      if (answer?.kind !== "redirect") continue;
      expect(answer.location, entry).not.toBe("/");
      expect(answer.location, entry).toMatch(/^\/(products\/|\?kategorie=)/);
    }
  });

  it("landet nur dort auf der Startseite, wo sie die Antwort ist", () => {
    const home = all.filter(
      ({ answer }) => answer?.kind === "redirect" && answer.location === "/",
    );
    for (const { entry, pathname } of home) {
      expect(withoutLanguage(pathname), entry).toMatch(HOME_IS_RIGHT);
    }
  });

  it("leitet nur auf Seiten, die es gibt", () => {
    for (const { entry, answer } of all) {
      if (answer?.kind !== "redirect") continue;
      expect(knownTargets.has(answer.location), `${entry} -> ${answer.location}`).toBe(true);
    }
  });

  it("baut keine Ketten: kein Ziel wird selbst wieder umgeleitet", () => {
    for (const { entry, answer } of all) {
      if (answer?.kind !== "redirect") continue;
      const next = split(answer.location);
      expect(
        legacyAnswer("jibbit.ch", next.pathname, next.search),
        `${entry} -> ${answer.location}`,
      ).toBeNull();
    }
  });

  it("trägt keinen Odoo-Parameter ins Ziel", () => {
    for (const { answer } of all) {
      if (answer?.kind !== "redirect") continue;
      const params = [...new URL(answer.location, "https://x.invalid").searchParams.keys()];
      expect(params.filter((key) => key !== "kategorie")).toEqual([]);
    }
  });

  it("antwortet mit 410 nur auf Adressen ohne Entsprechung", () => {
    const gone = [
      ...new Set(
        all
          .filter(({ answer }) => answer?.kind === "gone")
          .map(({ pathname }) =>
            withoutLanguage(pathname).replace(/\d+/g, "<n>").replace(/-chf.*$/, "-…"),
          ),
      ),
    ].sort();
    expect(gone).toEqual([
      "/blog",
      "/shop/cart",
      "/shop/change_pricelist/<n>",
      "/shop/change_pricelist/default-…",
      "/web/image/product.template/<n>/image_<n>",
      "/website/translations",
    ]);
  });

});
