/**
 * Bild-URLs vom Backend -> Pfade, die diese Storefront selbst ausliefern kann.
 *
 * WARUM ÜBERHAUPT UMSCHREIBEN
 * Die Backend-Adresse eines Tenants ist eine LAUFZEIT-Angabe aus der
 * TenantConfig, und sie ist im Regelfall gar nicht öffentlich erreichbar: im
 * Compose steht dort `http://medusa:9000` — ein Docker-Servicename, den kein
 * Browser auflösen kann. Eine Bild-URL, die auf diesen Host zeigt, ist im
 * <img> tot.
 *
 * Deshalb liefert die Storefront Produktbilder unter ihrer EIGENEN Herkunft
 * aus (`/media/<host>/<key>`, siehe app/media/[...path]/route.ts) und holt sie
 * serverseitig vom Backend des jeweiligen Tenants. Das löst denselben Zug
 * gleich zweimal:
 *
 *   1. Der Browser braucht keine Route ins Docker-Netz.
 *   2. `next/image` optimiert nur Bilder, deren Herkunft in
 *      `images.remotePatterns` steht — eine Build-Zeit-Angabe. In einer
 *      mehrmandantenfähigen Storefront ist die Menge der Backend-Hosts zur
 *      Build-Zeit unbekannt und wächst mit jedem neuen Tenant. Ein
 *      gleich-herkünftiger Pfad umgeht die Frage vollständig, statt sie mit
 *      einer Wildcard zu übertünchen (`hostname: "**"` wäre ein offener
 *      Bildproxy für das halbe Internet).
 *
 * DIE ERKENNUNGSREGEL
 * Erkannt wird am Pfadsegment `/static/`, NICHT am Vergleich mit
 * `tenant.backendUrl`. Das ist Absicht: Medusa schreibt beim Upload eine
 * ABSOLUTE URL in die Datenbank, gebildet aus `MEDUSA_BACKEND_URL` — auf der
 * VPS also `https://api-test.jibbit.ch/static/…`. Die TenantConfig desselben
 * Shops nennt als Backend aber `http://medusa:9000`. Ein Herkunftsvergleich
 * würde also ausgerechnet im Produktivfall NICHT greifen.
 */

/** Öffentlicher Präfix der Proxy-Route. Muss zu app/media/[...path] passen. */
export const MEDIA_PREFIX = "/media";

/** Pfadsegment, unter dem Medusa hochgeladene Dateien ausliefert. */
const STATIC_SEGMENT = "/static/";

/**
 * Ein Schlüssel darf nur harmlose Zeichen enthalten. Alles andere — `..`,
 * Backslashes, Prozentkodierung, Steuerzeichen — wird abgelehnt, statt es zu
 * bereinigen: Bereinigen ist die Klasse von Code, die man falsch bekommt.
 */
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

/**
 * Der local-Provider legt private Dateien im SELBEN Verzeichnis ab und
 * kennzeichnet sie nur am Präfix `private-` des Dateinamens
 * (@medusajs/file-local). Ein ungefilterter Proxy würde sie mit ausliefern.
 */
const PRIVATE_PREFIX = "private-";

/**
 * Der Dateischlüssel hinter `/static/`, oder `null`, wenn die URL kein
 * Medusa-Upload ist (etwa eine spätere S3-/CDN-Adresse) oder unsicher aussieht.
 */
export function toMediaKey(url: string): string | null {
  if (!url) return null;

  // Nur den Pfadteil betrachten. Query und Fragment gehören nicht zum
  // Schlüssel und dürfen auch nicht in die Weiterleitung wandern.
  const path = url.split(/[?#]/, 1)[0];
  const at = path.indexOf(STATIC_SEGMENT);
  if (at === -1) return null;

  const key = path.slice(at + STATIC_SEGMENT.length);
  if (!key || !SAFE_KEY.test(key)) return null;
  if (key.split("/").some((seg) => seg.startsWith(PRIVATE_PREFIX))) return null;

  return key;
}

/**
 * Ein Hostname, wie ihn `normalizeHost` liefert: klein geschrieben, ohne Port.
 * Er steht IM PFAD und wird deshalb genauso streng geprüft wie der Schlüssel.
 */
const SAFE_HOST = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

export interface MediaSrc {
  /** Was in `<Image src>` gehört. */
  src: string;
  /**
   * true, wenn die URL nicht über den eigenen Proxy läuft und deshalb an
   * `next/image` vorbei ausgeliefert werden muss — sonst lehnt der Optimizer
   * sie mangels `remotePatterns`-Eintrag ab. Betrifft heute niemanden; wird
   * relevant, sobald ein Objektspeicher dazukommt.
   */
  unoptimized: boolean;
}

/**
 * Bild-URL aus dem Backend -> Quelle für `next/image`.
 *
 * `host` ist der Host des Tenants, für den gerade gerendert wird
 * (`TenantConfig.host`, bereits normalisiert). Er wandert IN DEN PFAD, weil
 * der Bildproxy ihn nicht aus dem Request-Header lesen kann — die Begründung
 * steht in app/media/[...path]/route.ts.
 */
export function toMediaSrc(url: string, host: string): MediaSrc {
  const key = toMediaKey(url);
  return key && SAFE_HOST.test(host)
    ? { src: `${MEDIA_PREFIX}/${host}/${key}`, unoptimized: false }
    : { src: url, unoptimized: true };
}

/** Was der Bildproxy aus `/media/<host>/<key>` herausliest. */
export interface MediaPath {
  host: string;
  key: string;
}

/**
 * Gegenstück zu `toMediaSrc` — dieselben Regeln, damit Ausgabe- und
 * Eingabeseite nicht auseinanderdriften.
 */
export function parseMediaPath(segments: string[]): MediaPath | null {
  const [host, ...rest] = segments;
  if (!host || !SAFE_HOST.test(host) || !rest.length) return null;

  const key = toMediaKey(`/static/${rest.join("/")}`);
  return key ? { host, key } : null;
}
