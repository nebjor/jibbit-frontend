/**
 * 301-Ziele für die URLs des alten Odoo-Shops auf jibbit.ch. Quelle:
 * medusa-ecom data/odoo-redirects.json, Ziele gegen die Produkt-Handles auf
 * test.jibbit.ch geprüft. Odoo akzeptiert unter /shop/<slug>-<id> jeden Slug,
 * deshalb zählt nur die ID am Ende.
 */

const PAPERS = "/?kategorie=papers";
const FILTER = "/?kategorie=filter";

const ODOO_PRODUCTS: Record<string, string> = {
  2: PAPERS,
  3: "ocb-premium-rolls-slim",
  7: "ocb-premium-kss-papers-mit-filter",
  8: "raw-classic-rolls-slim",
  9: "ocb-premium-kurz",
  10: "purize-xtra-slim-white-50er-pack-5-9mm",
  11: "kailar-filter-5-9mm-65stk-weiss",
  13: "angel-slim-filters-6mm-120stk",
  24: "greengo-unbleached-slim-rolls",
  26: "kailar-filter-5-9mm-65stk-schwarz",
  27: "kailar-filter-5-9mm-65stk-pink",
  28: "smoking-brown-kurz-double-window",
  29: "kailar-filter-9mm-big-100-stk-schwarz",
  31: "greengo-unbleached-slim-rolls",
  32: "zig-zag-slim-filter-6mm-120stk",
  33: "zig-zag-slim-filter-6mm-120stk",
  34: "smoking-brown-kurz-double-window",
  40: "ocb-bio-slim-organic-hemp-rolls",
  41: "ocb-slim-filter-bio-120-tips",
  47: PAPERS,
  48: "purize-super-slim-white-o5mm",
  49: "dubi-aktivkohlefilter-o7mm",
  50: "raw-kristallglas-aschenbecher-rainbow",
  51: "raw-kristallglas-aschenbecher-ruby",
  52: "raw-kristallglas-aschenbecher-darkside",
  54: FILTER,
  55: "silikon-dose-22-mm",
  56: "elements-ultra-thin-king-size-slim-kss",
  57: "elements-ultra-thin-king-size-slim-kss",
  58: "elements-blue-rolls-sw",
  59: "elements-blue-rolls-sw",
  60: FILTER,
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
