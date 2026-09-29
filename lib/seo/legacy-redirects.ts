/**
 * 301-Ziele für die URLs des alten Odoo-Shops auf jibbit.ch. Quelle:
 * medusa-ecom data/odoo-redirects.json, Ziele gegen die Produkt-Handles auf
 * test.jibbit.ch geprüft. Odoo akzeptiert unter /shop/<slug>-<id> jeden Slug,
 * deshalb zählt nur die ID am Ende.
 *
 * Stand der Prüfung: 2026-09-29. Die IDs sind die, die der Live-Shop unter
 * /shop/x-<id> mit 200 beantwortet (1–75 durchprobiert), nicht nur die aus
 * seiner Sitemap — 23, 36 und 37 stehen dort nicht, sind aber erreichbar und
 * bei Google bekannt. Begründungen und Quellen: docs/seo/url-structure.md.
 *
 * JEDES ZIEL MUSS EINE SEITE SEIN, DIE ES GIBT. Ein 301 auf ein 404 ist
 * schlechter als eines auf die Kategorie. Wer im Admin einen Handle ändert,
 * zieht ihn hier im selben Zug nach.
 */

const PAPERS = "/?kategorie=papers";

const ODOO_PRODUCTS: Record<string, string> = {
  2: "raw-classic-king-size-slim",
  3: "ocb-black-premium-rolls-slim",
  // 7, 23, 40, 47: im neuen Shop (noch) nicht geführt — die Kategorie ist das
  // nächstliegende Ziel, nicht die Startseite.
  7: PAPERS,
  8: "raw-classic-rolls-slim",
  9: "ocb-premium-kurz",
  10: "purize-xtra-slim-white-50er-pack-5-9mm",
  11: "kailar-filter-5-9mm-65stk-weiss",
  13: "angel-slim-filters-6mm-120stk",
  23: PAPERS,
  24: "greengo-unbleached-slim-rolls",
  26: "kailar-filter-5-9mm-65stk-schwarz",
  27: "kailar-filter-5-9mm-65stk-pink",
  28: "smoking-brown-kurz-double-window",
  29: "kailar-filter-9mm-big-100-stk-schwarz",
  31: "greengo-unbleached-slim-rolls",
  32: "zig-zag-slim-filter-6mm-120stk",
  33: "zig-zag-slim-filter-6mm-120stk",
  34: "smoking-brown-kurz-double-window",
  // 36 ist das Original, 48 dessen Kopie («…-kopie-48») — dasselbe Produkt.
  36: "purize-super-slim-white-o5mm",
  // 37 und 61 heissen beide «Gizeh DW Extra Fine».
  37: "gizeh-dw-extra-fine",
  40: PAPERS,
  41: "ocb-slim-filter-bio-120-tips",
  47: PAPERS,
  48: "purize-super-slim-white-o5mm",
  49: "dubi-aktivkohlefilter-o7mm",
  50: "raw-kristallglas-aschenbecher-rainbow",
  51: "raw-kristallglas-aschenbecher-ruby",
  52: "raw-kristallglas-aschenbecher-darkside",
  // Die XMAS-Ausgabe gibt es nicht mehr, den Filter darin schon.
  54: "purize-xtra-slim-6mm",
  55: "silikon-dose-22-mm",
  56: "elements-ultra-thin-king-size-slim-kss",
  57: "elements-ultra-thin-king-size-slim-kss",
  58: "elements-blue-rolls-sw",
  59: "elements-blue-rolls-sw",
  // Der Handle sagt 6mm, das Produkt ist der 9-mm-Filter (Titel im Admin).
  60: "purize-aktivkohlefilter-6mm",
  61: "gizeh-dw-extra-fine",
};

const PAGES: Record<string, string> = {
  "/shop": "/",
  "/contactus": "/service/kontakt",
  "/terms": "/agb",
  "/web/login": "/konto/anmelden",
  "/website/info": "/impressum",
};

const LANGUAGE_PREFIX = /^\/(?:en|fr_CH|it)(?=\/|$)/;
const PRODUCT_PATH = /^\/shop\/[^/]+-(\d+)$/;
const LEGACY_DOMAIN = /(?:^|\.)jibbit\.ch$/;

/**
 * Parameter, die eine Weiterleitung überleben. Alles andere fällt weg —
 * allen voran Odoos `?search=`, `?order=`, `?category=`, `?attrib=`: sie
 * haben aus jeder Produktseite beliebig viele crawlbare Dubletten gemacht
 * und bedeuten im neuen Shop nichts. Eine Erlaubnisliste statt einer
 * Verbotsliste, weil Odoos Parameter niemand vollständig aufzählen kann.
 *
 * Kampagnenparameter bleiben, damit ein alter Newsletter-Link in der
 * Auswertung weiterhin seiner Kampagne zugeordnet wird. Für Suchmaschinen
 * sind sie unschädlich: die kanonische Adresse der Zielseite trägt sie nicht.
 */
const KEPT_PARAMS = /^(?:utm_[a-z_]+|gclid|gbraid|wbraid|fbclid|msclkid)$/;

function resolve(pathname: string): string | null {
  const product = PRODUCT_PATH.exec(pathname);
  if (product) {
    const target = ODOO_PRODUCTS[product[1]];
    if (!target) return "/";
    return target.startsWith("/") ? target : `/products/${target}`;
  }
  return PAGES[pathname] ?? (pathname.startsWith("/shop/") ? "/" : null);
}

/** Das Ziel für einen alten Odoo-Pfad dieser Domain, oder `null`. */
export function legacyRedirect(domain: string, pathname: string): string | null {
  if (!LEGACY_DOMAIN.test(domain)) return null;
  if (!LANGUAGE_PREFIX.test(pathname)) return resolve(pathname);
  const german = pathname.replace(LANGUAGE_PREFIX, "") || "/";
  return resolve(german) ?? german;
}

/**
 * Wie `legacyRedirect`, aber mit dem Query-String der alten Adresse: das
 * fertige Ziel (Pfad samt Query) in EINEM Sprung, oder `null`.
 *
 * `kategorie` bleibt nur auf /shop erhalten — das war die eigene frühere
 * Katalogadresse der Storefront (/shop?kategorie=x, siehe app/shop/page.tsx),
 * kein Odoo-Parameter.
 */
export function legacyRedirectLocation(
  domain: string,
  pathname: string,
  search: string,
): string | null {
  const target = legacyRedirect(domain, pathname);
  if (!target) return null;

  const url = new URL(target, "https://x.invalid");
  const old = new URLSearchParams(search);
  const ownCatalogue = pathname === "/shop" && target === "/";
  for (const [key, value] of old) {
    if (url.searchParams.has(key)) continue;
    if (KEPT_PARAMS.test(key) || (ownCatalogue && key === "kategorie")) {
      url.searchParams.append(key, value);
    }
  }
  return url.pathname + url.search;
}
