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
 * WELCHE DATEINAMEN DURCHGEHEN
 *
 * Früher galt hier eine enge Positivliste (`[A-Za-z0-9._-]`), die auch jede
 * Prozentkodierung ablehnte. Das war Absicht — Schutz vor Pfadwechseln —, aber
 * zu eng: Medusa übernimmt den Dateinamen des Uploads, und im Admin werden
 * Dateien wie `[6] PURIZE White, 50er Pack.avif` oder `… (Kopie).avif`
 * hochgeladen. Solche Bilder fielen auf die Backend-Adresse zurück, liefen am
 * Bildproxy vorbei und schrieben `api-test.jibbit.ch` fest in Seiten, Sitemap,
 * JSON-LD und Merchant-Feed.
 *
 * Jetzt gilt: JEDES SEGMENT WIRD GENAU EINMAL DEKODIERT, DANN GEPRÜFT, und
 * beim Ausgeben GENAU EINMAL KODIERT. Geprüft wird also immer der Klartext,
 * der am Ende beim Backend ankommt — nie eine kodierte Form, hinter der sich
 * etwas verstecken könnte. Bereinigt wird weiterhin nichts: was nicht passt,
 * wird abgelehnt.
 *
 * Ein dekodiertes Segment
 *   - beginnt mit einem Buchstaben oder einer Ziffer (damit sind `.`, `..`
 *     und versteckte Dateien wie `.env` ausgeschlossen),
 *   - enthält weder `/` noch `\` (ein kodierter Schrägstrich `%2F` wäre nach
 *     dem Dekodieren ein Pfadwechsel durch die Hintertür),
 *   - enthält keine Steuer-, Format- oder Zeilentrennzeichen (Nullbyte,
 *     Zeilenumbruch, Bidi-Umschalter, einzelne Surrogate),
 *   - enthält nach dem Dekodieren KEINE weitere Prozentfolge `%XX` — das ist
 *     die Absage an doppelte Kodierung (`%252e%252e`, `%252F`). Ein Dateiname,
 *     der wörtlich `%2F` enthält, bleibt damit draussen; das ist der Preis.
 */
const SEGMENT_START = /^[\p{L}\p{N}]/u;
const FORBIDDEN_IN_SEGMENT = /[/\\\p{C}\p{Zl}\p{Zp}]/u;
const PERCENT_SEQUENCE = /%[0-9A-Fa-f]{2}/;

/** Übliche Grenze für einen Dateinamen; hält auch die URL in Schranken. */
const MAX_SEGMENT_LENGTH = 255;
const MAX_KEY_LENGTH = 1024;

/**
 * Der local-Provider legt private Dateien im SELBEN Verzeichnis ab und
 * kennzeichnet sie nur am Präfix `private-` des Dateinamens
 * (@medusajs/file-local). Ein ungefilterter Proxy würde sie mit ausliefern.
 */
const PRIVATE_PREFIX = "private-";

/** Ein Pfadsegment IM KLARTEXT prüfen. Hier wird nichts dekodiert. */
function checkSegment(plain: string): string | null {
  if (!plain || plain.length > MAX_SEGMENT_LENGTH) return null;
  if (!SEGMENT_START.test(plain)) return null;
  if (FORBIDDEN_IN_SEGMENT.test(plain)) return null;
  if (PERCENT_SEQUENCE.test(plain)) return null;
  if (plain.startsWith(PRIVATE_PREFIX)) return null;

  return plain;
}

/**
 * Ein Pfadsegment AUS EINER URL — prozentkodiert oder roh — einmal dekodieren
 * und prüfen.
 *
 * ROH ODER KODIERT: Medusa speichert die URL kodiert (`RAW%20BLACK.jpg`,
 * eckige und runde Klammern aber unkodiert); aus anderer Quelle kann sie roh
 * kommen. Beides muss dasselbe ergeben. Lässt sich ein Segment nicht
 * dekodieren (`100% Hanf.webp` — das `%` ist hier ein Zeichen, keine
 * Kodierung), gilt es als roh.
 */
function decodeSegment(segment: string): string | null {
  if (!segment.includes("%")) return checkSegment(segment);

  try {
    return checkSegment(decodeURIComponent(segment));
  } catch {
    return checkSegment(segment);
  }
}

/**
 * Segmente -> Schlüssel im Klartext. SEGMENTWEISE, nie über einen
 * zusammengefügten Pfad: enthält ein Segment nach dem Dekodieren einen
 * Schrägstrich (aus `%2F`), würde ihn das Zusammenfügen zu einem echten
 * Pfadtrenner machen. So sieht die Prüfung ihn noch und lehnt ab.
 */
function toKey(
  segments: string[],
  read: (segment: string) => string | null,
): string | null {
  const plain: string[] = [];
  for (const segment of segments) {
    const checked = read(segment);
    if (checked === null) return null;
    plain.push(checked);
  }

  const key = plain.join("/");
  return key && key.length <= MAX_KEY_LENGTH ? key : null;
}

/**
 * `encodeURIComponent` lässt `!'()*` stehen. In einem Pfad wäre das erlaubt,
 * aber die Adresse landet auch in XML (Sitemap), TSV (Feed), JSON-LD und
 * `srcset` — dort ist eine Adresse ohne Klammern und Hochkommas die, über die
 * niemand stolpert.
 */
function encodeSegment(plain: string): string {
  return encodeURIComponent(plain).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Schlüssel (Klartext) -> Pfadstück für eine URL. Die EINZIGE Stelle, an der
 * kodiert wird — für den öffentlichen Pfad (`toMediaSrc`) wie für die Anfrage
 * ans Backend (app/media/[...path]/route.ts).
 */
export function encodeMediaKey(key: string): string {
  return key.split("/").map(encodeSegment).join("/");
}

/**
 * Der Dateischlüssel hinter `/static/` ALS KLARTEXT (dekodiert), oder `null`,
 * wenn die URL kein Medusa-Upload ist (etwa eine spätere S3-/CDN-Adresse) oder
 * unsicher aussieht.
 */
export function toMediaKey(url: string): string | null {
  if (!url) return null;

  // Nur den Pfadteil betrachten. Query und Fragment gehören nicht zum
  // Schlüssel und dürfen auch nicht in die Weiterleitung wandern.
  const path = url.split(/[?#]/, 1)[0];
  // Gesucht wird im ROHEN Pfad: ein kodiertes `%2Fstatic%2F` ist kein
  // Pfadsegment und wird deshalb auch nicht als eines erkannt.
  const at = path.indexOf(STATIC_SEGMENT);
  if (at === -1) return null;

  return toKey(path.slice(at + STATIC_SEGMENT.length).split("/"), decodeSegment);
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
    ? {
        src: `${MEDIA_PREFIX}/${host}/${encodeMediaKey(key)}`,
        unoptimized: false,
      }
    : { src: url, unoptimized: true };
}

/** Was der Bildproxy aus `/media/<host>/<key>` herausliest. */
export interface MediaPath {
  host: string;
  /** Klartext. Für eine URL durch `encodeMediaKey` schicken. */
  key: string;
}

/**
 * Gegenstück zu `toMediaSrc` — dieselben Regeln, damit Ausgabe- und
 * Eingabeseite nicht auseinanderdriften.
 *
 * DIE SEGMENTE SIND KLARTEXT. Next dekodiert die Parameter einer
 * Catch-all-Route selbst, genau einmal (gemessen mit 16.2.12, direkt wie über
 * den Bildoptimizer: `/media/h/a%2Eb` kommt als `a.b` an). Hier wird deshalb
 * NICHT noch einmal dekodiert — sonst würde aus einer doppelt kodierten
 * Adresse (`%252E`) stillschweigend ein gültiger Name. Bleibt nach Next noch
 * eine Prozentfolge übrig, war die Adresse doppelt kodiert: abgelehnt.
 *
 * Reichte eine spätere Next-Version die Parameter kodiert herein, fielen
 * Bilder mit Sonderzeichen aus — laut, nicht still: e2e/media.spec.ts holt
 * genau solche Bilder ab.
 */
export function parseMediaPath(segments: string[]): MediaPath | null {
  const [host, ...rest] = segments;
  if (!host || !SAFE_HOST.test(host) || !rest.length) return null;

  const key = toKey(rest, checkSegment);
  return key ? { host, key } : null;
}

/** Was ein Produktbild sein darf. Alles andere reicht der Bildproxy nicht durch. */
export const ALLOWED_IMAGE_TYPES = [
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/avif",
  "image/gif",
] as const;

/**
 * Dateiendung -> Bildtyp, NUR für den Fall unten. SVG fehlt mit Absicht: es
 * kann Skripte enthalten, und ein Produktbild ist nie ein SVG.
 */
const TYPE_BY_EXTENSION: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  avif: "image/avif",
  gif: "image/gif",
};

/** Was ein Server sagt, wenn er die Dateiendung nicht kennt. */
const UNKNOWN_TYPES = ["", "application/octet-stream"];

/**
 * Der Content-Type, mit dem der Bildproxy eine Backend-Antwort ausliefert —
 * oder `null`, wenn sie kein Produktbild ist.
 *
 * WARUM DIE ANGABE DES BACKENDS NICHT REICHT
 * Medusa liefert `/static` über `express.static` aus, und dessen
 * Typtabelle (`send` 0.19 -> `mime` 1.6.0, Stand 2017) KENNT `.avif`
 * NICHT. Eine einwandfreie AVIF-Datei kommt deshalb als
 * `application/octet-stream` an. Der Proxy verglich früher nur diese Angabe
 * mit der Liste oben, antwortete mit 404, der Bildoptimizer machte daraus ein
 * 400 („The requested resource isn't a valid image") — und JEDES im Admin
 * hochgeladene AVIF erschien im Shop als „Bild liess sich nicht laden",
 * während JPEG, PNG und WebP daneben funktionierten.
 *
 * Deshalb: sagt das Backend „weiss ich nicht" (octet-stream oder gar nichts),
 * entscheidet die Dateiendung des Schlüssels. Nennt es dagegen einen
 * KONKRETEN anderen Typ (text/html, image/svg+xml, …), bleibt es bei der
 * Ablehnung — die Endung darf eine ausdrückliche Angabe nicht überstimmen.
 *
 * Dass die Endung lügen könnte, ist unkritisch: die Antwort trägt
 * `X-Content-Type-Options: nosniff`, ein falsch benanntes Etwas wird im
 * Browser also schlicht nicht dekodiert, und `next/image` prüft ohnehin
 * selbst die ersten Bytes, bevor es etwas umrechnet.
 */
export function resolveImageContentType(
  upstreamType: string | null | undefined,
  key: string,
): string | null {
  const declared = (upstreamType ?? "").split(";")[0].trim().toLowerCase();

  if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(declared)) {
    return declared;
  }
  if (!UNKNOWN_TYPES.includes(declared)) return null;

  const dot = key.lastIndexOf(".");
  if (dot === -1) return null;
  return TYPE_BY_EXTENSION[key.slice(dot + 1).toLowerCase()] ?? null;
}
