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
