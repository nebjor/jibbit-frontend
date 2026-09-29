/**
 * Antworten auf die URLs des alten Odoo-Shops auf jibbit.ch. Odoo akzeptiert
 * unter /shop/<slug>-<id> jeden Slug, deshalb zählt nur die ID am Ende.
 *
 * DIE ZUORDNUNG SELBST steht in legacy-redirects.data.json — als Daten, damit
 * tools/smoke.mjs dieselbe Liste gegen eine laufende Umgebung prüfen kann
 * (`npm run smoke -- --base-url=…`), ohne TypeScript zu lesen. Gespiegelt in
 * medusa-ecom data/odoo-redirects.json.
 *
 * Stand der Prüfung: 2026-09-29. Handles von test.jibbit.ch abgelesen, alte
 * Adressen aus dem Export der Search Console (544 Adressen, 37 Produkt-IDs;
 * als Pfadliste in legacy-paths.fixture.json, über die der Test läuft).
 * Begründungen und Quellen: docs/seo/url-structure.md.
 *
 * DREI ANTWORTEN
 *   301  wo es eine passende neue Seite gibt — in EINEM Sprung.
 *   410  wo es keine gibt (Warenkorb, Preislisten-Umschalter, Übersetzungs-
 *        endpunkt, alte Bildadressen, Blog). Nicht auf die Startseite: viele
 *        alte Adressen auf die Startseite zu leiten wertet Google als
 *        Soft 404, und 410 nimmt sie schneller aus dem Index als 404.
 *   200  für /terms — die Adresse bleibt, siehe `KEPT_PATHS`.
 *
 * JEDES ZIEL MUSS EINE SEITE SEIN, DIE ES GIBT. Ein 301 auf ein 404 ist
 * schlechter als eines auf die Kategorie. Wer im Admin einen Handle ändert,
 * zieht ihn in der Datendatei im selben Zug nach.
 *
 * AUSNAHME AUF ZEIT: die Handles unter `unveroeffentlicht` sind im Admin
 * angelegt, aber noch Entwurf (IDs 23, 40, 47). Bis sie veröffentlicht sind,
 * antworten ihre Seiten mit 404 — das MUSS vor dem Go-live erledigt sein.
 * Der Smoke-Test nennt sie als eigene Warnung.
 *
 * Zu ID 60: das Ziel `purize-aktivkohlefilter-6mm` trägt auf Staging den
 * Titel «PURIZE Aktivkohlefilter 9 mm». Titel und Handle widersprechen sich;
 * welches von beiden stimmt, weiss nur der Betreiber. Die Weiterleitung
 * folgt dem Titel (Odoo 60 = «ø 9mm»).
 */

import data from "./legacy-redirects.data.json";

/** Odoo-ID -> Handle, oder (mit führendem Schrägstrich) ein Pfad. */
export const ODOO_PRODUCTS: Readonly<Record<string, string>> = data.produkte;

/** Ziele, die es im Admin gibt, die aber noch nicht veröffentlicht sind. */
export const UNPUBLISHED_TARGETS: readonly string[] = data.unveroeffentlicht;

/**
 * Seiten mit Entsprechung. `/about-us` hat keine eigene Nachfolgeseite; wer
 * hinter dem Shop steht, sagt im neuen Shop das Impressum.
 */
const PAGES: Record<string, string> = {
  "/shop": "/",
  "/contactus": "/service/kontakt",
  "/terms": "/agb",
  "/about-us": "/impressum",
  "/web/login": "/konto/anmelden",
  "/website/info": "/impressum",
};

/**
 * /terms OHNE Sprachpfad wird nicht umgeleitet: die Adresse
 * https://jibbit.ch/terms ist im Merchant Center als URL der
 * Rückgaberichtlinie hinterlegt und muss genau dort weiter eine Seite
 * liefern. Das tut app/terms/page.tsx — dieselbe Seite wie /agb, deren
 * `rel=canonical` /agb nennt; für die Suche gibt es also weiterhin nur eine
 * Adresse. MIT Sprachpfad (/fr_CH/terms) bleibt es bei einem 301 auf /agb.
 */
export const KEPT_PATHS: ReadonlySet<string> = new Set(["/terms"]);

/**
 * Odoo-Adressen ohne Entsprechung. `/web/` und `/website/` gehören Odoo
 * ganz — die Storefront hat unter beiden keine Route; die zwei Ausnahmen
 * (/web/login, /website/info) stehen in PAGES und greifen vorher.
 */
const GONE = [
  /^\/shop\/cart(?:\/|$)/,
  /^\/shop\/change_pricelist(?:\/|$)/,
  /^\/shop\/(?:checkout|payment|confirmation|address|wishlist)(?:\/|$)/,
  /^\/web(?:\/|$)/,
  /^\/website(?:\/|$)/,
  /^\/blog(?:\/|$)/,
];

/**
 * Odoos Sprachpfade: `/en`, `/it`, `/fr_CH`, `/de_CH`, `/fr_BE` … — zwei
 * Kleinbuchstaben, wahlweise mit Region. Als Muster statt als Liste, weil
 * Odoo jede installierte Sprache so ausliefert und die Search Console
 * laufend weitere kennt.
 *
 * Trifft keine eigene Route: die Storefront hat keinen Pfad, dessen erstes
 * Segment aus genau zwei Buchstaben besteht (geprüft in
 * legacy-redirects.test.ts gegen das app-Verzeichnis).
 */
export const LANGUAGE_PREFIX = /^\/[a-z]{2}(?:_[A-Z]{2})?(?=\/|$)/;

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

export type LegacyAnswer =
  /** 301 auf `location` (Pfad samt bereinigtem Query). */
  | { kind: "redirect"; location: string }
  /** 410 — die Adresse gibt es nicht mehr und bekommt keinen Nachfolger. */
  | { kind: "gone" };

const GONE_MARK = Symbol("gone");

/** Ziel, `GONE_MARK` oder `null` für einen Pfad OHNE Sprachpfad. */
function resolve(pathname: string): string | typeof GONE_MARK | null {
  const product = PRODUCT_PATH.exec(pathname);
  if (product) {
    const target = ODOO_PRODUCTS[product[1]];
    if (!target) return "/";
    return target.startsWith("/") ? target : `/products/${target}`;
  }
  const page = PAGES[pathname];
  if (page) return page;
  if (GONE.some((pattern) => pattern.test(pathname))) return GONE_MARK;
  // Katalogseiten (/shop/page/2) und alles Übrige unter /shop/: der Katalog
  // ist die Startseite.
  return pathname.startsWith("/shop/") ? "/" : null;
}

function resolveWithLanguage(pathname: string): string | typeof GONE_MARK | null {
  if (!LANGUAGE_PREFIX.test(pathname)) {
    return KEPT_PATHS.has(pathname) ? null : resolve(pathname);
  }
  const german = pathname.replace(LANGUAGE_PREFIX, "") || "/";
  return resolve(german) ?? german;
}

/** Das Ziel für einen alten Odoo-Pfad dieser Domain, oder `null`. */
export function legacyRedirect(domain: string, pathname: string): string | null {
  if (!LEGACY_DOMAIN.test(domain)) return null;
  const target = resolveWithLanguage(pathname);
  return typeof target === "string" ? target : null;
}

/** Gibt es diese alte Adresse ersatzlos nicht mehr (410)? */
export function legacyGone(domain: string, pathname: string): boolean {
  return LEGACY_DOMAIN.test(domain) && resolveWithLanguage(pathname) === GONE_MARK;
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

/** Die eine Antwort auf eine alte Adresse — oder `null`: kein Altpfad. */
export function legacyAnswer(
  domain: string,
  pathname: string,
  search: string,
): LegacyAnswer | null {
  const location = legacyRedirectLocation(domain, pathname, search);
  if (location) return { kind: "redirect", location };
  return legacyGone(domain, pathname) ? { kind: "gone" } : null;
}
