/**
 * EINE SCHREIBWEISE JE PRODUKTADRESSE.
 *
 * Google unterscheidet Gross- und Kleinschreibung im Pfad: /products/Foo und
 * /products/foo sind zwei Adressen. Medusa-Handles sind immer klein
 * geschrieben — eine anders geschriebene Adresse (abgetippt, aus einer Mail
 * oder einem Forum) lief bisher in ein 404, obwohl das Produkt existiert.
 * Sie wird deshalb dauerhaft auf die kleine Schreibweise umgeleitet.
 *
 * Bewusst NUR für /products/: Kategorie-Handles stehen im Query-String und
 * werden exakt verglichen, und Pfade wie /media/<key> oder Tokens in
 * Konto-Links sind zu Recht schreibungsabhängig.
 *
 * Der Schrägstrich am Ende ist nicht hier geregelt: Next leitet
 * /products/foo/ von sich aus mit 308 auf /products/foo (`trailingSlash`
 * steht auf dem Standard `false`).
 *
 * Bewusst ohne Abhängigkeiten, wie lib/seo/indexing.ts: proxy.ts ruft das auf.
 */

const PRODUCT_PREFIX = "/products/";

/** Die klein geschriebene Produktadresse, oder `null`, wenn nichts zu tun ist. */
export function lowercaseProductPath(pathname: string): string | null {
  if (!pathname.startsWith(PRODUCT_PREFIX)) return null;
  const lower = pathname.toLowerCase();
  return lower === pathname ? null : lower;
}

/**
 * EIN HOST JE SHOP: `www.<domain>` -> `<domain>`.
 *
 * Die Search Console kennt 44 Adressen unter www.jibbit.ch. Die statische
 * Mandantentabelle führt `www` als Alias (lib/tenant/static-tenants.ts) — die
 * Storefront beantwortete dort bisher jede Seite mit 200, also unter zwei
 * Hosts denselben Inhalt. Das Canonical zeigte zwar auf die Hauptdomain, ein
 * 301 ist aber das stärkere Signal und erspart Google das Doppelcrawlen.
 *
 * Bewusst NUR für genau `www.` + Domain: ein Mandant, dessen Host sich sonst
 * von seiner Domain unterscheidet (Plattform-Subdomain neben eigener Domain),
 * wird hier nicht angefasst.
 */
export function isWwwAlias(host: string, domain: string): boolean {
  return host.toLowerCase() === `www.${domain.toLowerCase()}`;
}

/**
 * Der kanonische Pfad, falls die Anfrage umgeleitet werden muss — wegen des
 * Hosts, der Schreibweise oder beidem, in EINEM Sprung. Sonst `null`.
 */
export function canonicalHostRedirect(
  host: string,
  domain: string,
  pathname: string,
): string | null {
  const lowercased = lowercaseProductPath(pathname);
  if (lowercased) return lowercased;
  return isWwwAlias(host, domain) ? pathname : null;
}
