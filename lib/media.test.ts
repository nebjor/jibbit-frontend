import { describe, expect, it } from "vitest";
import {
  encodeMediaKey,
  parseMediaPath,
  resolveImageContentType,
  toMediaKey,
  toMediaSrc,
} from "./media";

/**
 * DATEINAMEN AUS DEM ADMIN, wie sie am 29.09.2026 auf test.jibbit.ch standen —
 * in genau der Form, in der Medusa sie speichert (Leerzeichen kodiert,
 * Klammern und Komma nicht). Bis dahin lehnte der Proxy sie ab, und die
 * Bilder wurden mit `https://api-test.jibbit.ch/static/…` ausgegeben.
 *
 * Links die gespeicherte URL, in der Mitte der Schlüssel im Klartext, rechts
 * das, was in den Pfad der Storefront gehört.
 */
const AUS_DEM_ADMIN: Array<[stored: string, key: string, encoded: string]> = [
  [
    "1788953074723-RAW%20BLACK%20SLIM_01.jpg",
    "1788953074723-RAW BLACK SLIM_01.jpg",
    "1788953074723-RAW%20BLACK%20SLIM_01.jpg",
  ],
  [
    "1789906754409-Display_%2025x%20Smoking%20Brown%20kurz%20(double%20window).avif",
    "1789906754409-Display_ 25x Smoking Brown kurz (double window).avif",
    "1789906754409-Display_%2025x%20Smoking%20Brown%20kurz%20%28double%20window%29.avif",
  ],
  [
    "1789907393708-[6]%20PURIZE%20White,%2050er%20Pack.avif",
    "1789907393708-[6] PURIZE White, 50er Pack.avif",
    "1789907393708-%5B6%5D%20PURIZE%20White%2C%2050er%20Pack.avif",
  ],
  // Falsch dekodierter Umlaut («hellgrÃ¼n»): so heisst die Datei auf der
  // Platte wirklich, also muss genau das wieder herauskommen.
  [
    "1788862813721-silikondose-hellgr%C3%83%C2%BCn.jpg",
    "1788862813721-silikondose-hellgrÃ¼n.jpg",
    "1788862813721-silikondose-hellgr%C3%83%C2%BCn.jpg",
  ],
  [
    "1755-Bl%C3%A4ttchen%20gr%C3%BCn%20%26%20wei%C3%9F.webp",
    "1755-Blättchen grün & weiß.webp",
    "1755-Bl%C3%A4ttchen%20gr%C3%BCn%20%26%20wei%C3%9F.webp",
  ],
  ["1755-Name%20(1).webp", "1755-Name (1).webp", "1755-Name%20%281%29.webp"],
  ["1755-a+b=c;d@e.png", "1755-a+b=c;d@e.png", "1755-a%2Bb%3Dc%3Bd%40e.png"],
  ["1755-Frage%3F%20Raute%23.png", "1755-Frage? Raute#.png", "1755-Frage%3F%20Raute%23.png"],
  ["1755-100%25%20Hanf.webp", "1755-100% Hanf.webp", "1755-100%25%20Hanf.webp"],
];

describe("Dateinamen mit Leerzeichen, Klammern und Umlauten", () => {
  it.each(AUS_DEM_ADMIN)("%s", (stored, key, encoded) => {
    const url = `https://api-test.jibbit.ch/static/${stored}`;

    expect(toMediaKey(url)).toBe(key);
    expect(encodeMediaKey(key)).toBe(encoded);
    expect(toMediaSrc(url, "test.jibbit.ch")).toEqual({
      src: `/media/test.jibbit.ch/${encoded}`,
      unoptimized: false,
    });
  });

  /** Roh (wie im Dateisystem) und kodiert (wie in der Datenbank): ein Ergebnis. */
  it.each(AUS_DEM_ADMIN)("roh wie kodiert: %s", (stored, key, encoded) => {
    // `?` und `#` trennen in einer rohen URL Query und Fragment ab — ein roher
    // Name mit diesen Zeichen ist keine URL mehr und hier nicht gemeint.
    if (/[?#]/.test(key)) return;

    expect(toMediaSrc(`http://medusa:9000/static/${key}`, "test.jibbit.ch").src).toBe(
      `/media/test.jibbit.ch/${encoded}`,
    );
  });

  /**
   * GENAU EINMAL: was herauskommt, ist ein Fixpunkt. Läuft eine bereits
   * umgeschriebene Adresse noch einmal durch dieselbe Kette, ändert sich
   * nichts mehr — kein `%2520`.
   */
  it.each(AUS_DEM_ADMIN)("kodiert nicht doppelt: %s", (_stored, key, encoded) => {
    expect(toMediaKey(`/static/${encoded}`)).toBe(key);
    expect(encodeMediaKey(toMediaKey(`/static/${encoded}`)!)).toBe(encoded);
    expect(encoded).not.toMatch(/%25[0-9A-Fa-f]{2}/);
  });

  /**
   * Hin und zurück über die Route. Next dekodiert die Parameter selbst, genau
   * einmal — `parseMediaPath` bekommt also den Klartext und dekodiert NICHT
   * noch einmal.
   */
  it.each(AUS_DEM_ADMIN)("parseMediaPath liest zurück: %s", (_stored, key, encoded) => {
    const fromNext = decodeURIComponent(encoded);
    expect(fromNext).toBe(key);
    expect(parseMediaPath(["test.jibbit.ch", fromNext])).toEqual({
      host: "test.jibbit.ch",
      key,
    });
  });

  /**
   * Steht nach dem Dekodieren durch Next noch eine Prozentfolge da, war die
   * Adresse doppelt kodiert (`/media/h/Name%2520…`). Das ergibt keinen
   * zweiten Weg zum selben Bild, sondern nichts.
   */
  it("parseMediaPath dekodiert kein zweites Mal", () => {
    expect(parseMediaPath(["test.jibbit.ch", "1755-Name%20(1).webp"])).toBeNull();
    expect(parseMediaPath(["test.jibbit.ch", "1755-Name%2Ewebp"])).toBeNull();
    expect(parseMediaPath(["test.jibbit.ch", "1755-Name (1).webp"])).not.toBeNull();
  });

  it("behält Unterordner mit Sonderzeichen", () => {
    expect(toMediaSrc("https://x/static/2026%20neu/Name%20(1).webp", "test.jibbit.ch").src).toBe(
      "/media/test.jibbit.ch/2026%20neu/Name%20%281%29.webp",
    );
  });

  it("gibt für solche Dateien die Backend-Adresse nicht mehr aus", () => {
    for (const [stored] of AUS_DEM_ADMIN) {
      const { src } = toMediaSrc(
        `https://api-test.jibbit.ch/static/${stored}`,
        "test.jibbit.ch",
      );
      expect(src).not.toContain("api-test");
      expect(src.startsWith("/media/test.jibbit.ch/")).toBe(true);
    }
  });
});

/**
 * DIE ANGRIFFE. Jede Zeile einmal als gespeicherte URL (Ausgabeseite) und
 * einmal als Routenparameter (Eingabeseite, kodiert wie dekodiert) — die
 * Eingabeseite ist die, die ein Fremder frei wählen kann.
 */
const ANGRIFFE: Array<[name: string, segments: string[]]> = [
  ["Pfadwechsel ..", ["..", "medusa-config.js"]],
  ["Pfadwechsel mitten im Pfad", ["a", "..", "..", "etc", "passwd"]],
  ["einzelner Punkt", [".", "foo.webp"]],
  ["kodierte Punkte %2e%2e", ["%2e%2e", "medusa-config.js"]],
  ["kodierte Punkte %2E%2E", ["%2E%2E", "medusa-config.js"]],
  ["halb kodierte Punkte .%2e", [".%2e", "medusa-config.js"]],
  ["doppelt kodierte Punkte %252e%252e", ["%252e%252e", "medusa-config.js"]],
  ["kodierter Schrägstrich %2f", ["..%2fmedusa-config.js"]],
  ["kodierter Schrägstrich %2F im Namen", ["1755-a%2F..%2F..%2Fsecret.png"]],
  ["doppelt kodierter Schrägstrich %252f", ["1755-a%252f..%252fsecret.png"]],
  ["dreifach kodiert %25252f", ["1755-a%25252fb.png"]],
  ["Backslash", ["1755-a\\..\\secret.png"]],
  ["Backslash am Anfang", ["..\\secret.png"]],
  ["kodierter Backslash %5c", ["1755-a%5c..%5csecret.png"]],
  ["doppelt kodierter Backslash %255c", ["1755-a%255cb.png"]],
  ["Nullbyte", ["1755-foo.png\u0000.csv"]],
  ["kodiertes Nullbyte %00", ["1755-foo.png%00.csv"]],
  ["doppelt kodiertes Nullbyte %2500", ["1755-foo.png%2500.csv"]],
  ["Zeilenumbruch %0d%0a", ["1755-foo%0d%0aX-Injected:1.png"]],
  ["Tabulator", ["1755-foo\tbar.png"]],
  ["Bidi-Umschalter U+202E", ["1755-foo‮gnp.exe"]],
  ["Zeilentrenner U+2028", ["1755-foo .png"]],
  ["versteckte Datei", [".env"]],
  ["kodierte versteckte Datei", ["%2eenv"]],
  ["leeres Segment", ["a", "", "foo.png"]],
  ["privater Upload", ["private-1755-export.csv"]],
  ["privater Upload, kodiert", ["%70rivate-1755-export.csv"]],
  ["privater Upload im Unterordner", ["a", "private-1755-export.csv"]],
  ["fremde Adresse als Schlüssel", ["http:%2F%2F169.254.169.254%2Flatest"]],
  ["Segment über 255 Zeichen", [`1755-${"a".repeat(260)}.png`]],
];

describe("Angriffe bleiben draussen", () => {
  it.each(ANGRIFFE)("toMediaKey: %s", (_name, segments) => {
    expect(toMediaKey(`https://x/static/${segments.join("/")}`)).toBeNull();
  });

  it.each(ANGRIFFE)("toMediaSrc baut keinen Proxy-Pfad: %s", (_name, segments) => {
    const url = `https://x/static/${segments.join("/")}`;
    expect(toMediaSrc(url, "test.jibbit.ch")).toEqual({ src: url, unoptimized: true });
  });

  it.each(ANGRIFFE)("parseMediaPath, doppelt kodiert angefragt: %s", (_name, segments) => {
    expect(parseMediaPath(["test.jibbit.ch", ...segments])).toBeNull();
  });

  /** Der Regelfall: Next hat die Parameter einmal dekodiert. */
  it.each(ANGRIFFE)("parseMediaPath, von Next dekodiert: %s", (_name, segments) => {
    const decoded = segments.map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
    expect(parseMediaPath(["test.jibbit.ch", ...decoded])).toBeNull();
  });

  it("nimmt den Host nie aus dem Schlüssel", () => {
    // Ein Schlüssel, der wie ein Host aussieht, bleibt ein Dateiname unter
    // /static/ des Tenants — die Zieladresse steht nicht zur Wahl.
    expect(parseMediaPath(["test.jibbit.ch", "evil.example.ch", "foo.png"])).toEqual({
      host: "test.jibbit.ch",
      key: "evil.example.ch/foo.png",
    });
    expect(parseMediaPath(["evil.example.ch%2F", "foo.png"])).toBeNull();
    expect(parseMediaPath(["test.jibbit.ch%40evil.example.ch", "foo.png"])).toBeNull();
    expect(parseMediaPath(["test.jibbit.ch:80", "foo.png"])).toBeNull();
  });

  it("erkennt ein kodiertes /static/ nicht als Pfadsegment", () => {
    expect(toMediaKey("https://x/foo%2Fstatic%2F1755-foo.png")).toBeNull();
  });

  it("kodiert jedes Zeichen, das in einer URL etwas bedeuten könnte", () => {
    expect(encodeMediaKey("a/1755-x ?#%&=+;,:@[]()!'*\"<>.png")).toBe(
      "a/1755-x%20%3F%23%25%26%3D%2B%3B%2C%3A%40%5B%5D%28%29%21%27%2A%22%3C%3E.png",
    );
  });
});

describe("toMediaKey", () => {
  it("nimmt den Schlüssel hinter /static/", () => {
    expect(toMediaKey("http://medusa:9000/static/1755-elements.webp")).toBe(
      "1755-elements.webp",
    );
  });

  /**
   * DER FALL, DER IM BETRIEB EINTRITT und den ein Herkunftsvergleich falsch
   * beantworten würde: Medusa bildet die gespeicherte URL aus
   * MEDUSA_BACKEND_URL (auf der VPS `https://api-test.jibbit.ch`), die
   * TenantConfig derselben Storefront nennt als Backend aber den internen
   * Docker-Namen. Beide Angaben sind richtig und stimmen trotzdem nicht
   * überein.
   */
  it("greift auch, wenn die gespeicherte URL nicht der Tenant-Backend-URL entspricht", () => {
    expect(toMediaKey("https://api-test.jibbit.ch/static/1755-foo.webp")).toBe(
      "1755-foo.webp",
    );
  });

  it("behält Unterordner", () => {
    expect(toMediaKey("https://api.example.ch/static/2026/foo.webp")).toBe(
      "2026/foo.webp",
    );
  });

  it("ignoriert Query und Fragment", () => {
    expect(toMediaKey("https://api.example.ch/static/foo.webp?v=2#x")).toBe(
      "foo.webp",
    );
  });

  it("lehnt URLs ohne /static/ ab", () => {
    expect(toMediaKey("https://bucket.s3.eu-central-1.amazonaws.com/foo.webp")).toBeNull();
    expect(toMediaKey("")).toBeNull();
  });

  it("lehnt Pfadwechsel ab", () => {
    expect(toMediaKey("https://x/static/../medusa-config.js")).toBeNull();
    expect(toMediaKey("https://x/static/..%2Fsecret")).toBeNull();
    expect(toMediaKey("https://x/static/a/../../etc/passwd")).toBeNull();
    expect(toMediaKey("https://x/static/")).toBeNull();
  });

  /**
   * Der local-Provider legt private Dateien im SELBEN Verzeichnis ab und
   * kennzeichnet sie nur am Dateinamen. Ohne diese Regel wäre der Proxy ein
   * Weg, sie ohne Anmeldung abzurufen.
   */
  it("lehnt private Uploads ab", () => {
    expect(toMediaKey("https://x/static/private-1755-export.csv")).toBeNull();
    expect(toMediaKey("https://x/static/a/private-1755-export.csv")).toBeNull();
  });
});

describe("toMediaSrc", () => {
  it("macht aus einer Medusa-URL einen gleich-herkünftigen Pfad mit Host", () => {
    expect(
      toMediaSrc("http://medusa:9000/static/1755-elements.webp", "test.jibbit.ch"),
    ).toEqual({
      src: "/media/test.jibbit.ch/1755-elements.webp",
      unoptimized: false,
    });
  });

  it("lässt fremde URLs unverändert und schaltet die Optimierung ab", () => {
    const external = "https://cdn.example.ch/img/foo.webp";
    expect(toMediaSrc(external, "test.jibbit.ch")).toEqual({
      src: external,
      unoptimized: true,
    });
  });

  it("baut keinen Proxy-Pfad aus einem unbrauchbaren Host", () => {
    const url = "http://medusa:9000/static/foo.webp";
    expect(toMediaSrc(url, "").unoptimized).toBe(true);
    expect(toMediaSrc(url, "evil/../x").unoptimized).toBe(true);
    expect(toMediaSrc(url, "HOST.example.ch").unoptimized).toBe(true);
  });
});

describe("parseMediaPath", () => {
  /**
   * Hin und zurück: was `toMediaSrc` erzeugt, muss `parseMediaPath` wieder
   * auseinandernehmen können. Driften die beiden auseinander, liefert der
   * Shop stillschweigend nur noch Platzhalter aus.
   */
  it("liest zurück, was toMediaSrc geschrieben hat", () => {
    const { src } = toMediaSrc(
      "https://api-test.jibbit.ch/static/1755-elements.webp",
      "test.jibbit.ch",
    );
    expect(parseMediaPath(src.replace("/media/", "").split("/"))).toEqual({
      host: "test.jibbit.ch",
      key: "1755-elements.webp",
    });
  });

  it("nimmt Unterordner mit", () => {
    expect(parseMediaPath(["shop.example.ch", "2026", "foo.webp"])).toEqual({
      host: "shop.example.ch",
      key: "2026/foo.webp",
    });
  });

  it("lehnt fehlenden Host, fehlenden Schlüssel und Pfadwechsel ab", () => {
    expect(parseMediaPath([])).toBeNull();
    expect(parseMediaPath(["test.jibbit.ch"])).toBeNull();
    expect(parseMediaPath(["test.jibbit.ch", "..", "medusa-config.js"])).toBeNull();
    expect(parseMediaPath(["..", "foo.webp"])).toBeNull();
    expect(parseMediaPath(["test.jibbit.ch", "private-1755-export.csv"])).toBeNull();
  });
});

describe("resolveImageContentType", () => {
  it("übernimmt einen erlaubten Typ des Backends", () => {
    expect(resolveImageContentType("image/jpeg", "1755-foo.jpg")).toBe("image/jpeg");
    expect(resolveImageContentType("image/webp; charset=binary", "1755-foo.webp")).toBe(
      "image/webp",
    );
    expect(resolveImageContentType("IMAGE/PNG", "1755-foo.png")).toBe("image/png");
  });

  /**
   * DER AUSFALL VOM 20.09.2026: Medusas express.static (send -> mime 1.6.0)
   * kennt `.avif` nicht und meldet `application/octet-stream`. Der Proxy
   * machte daraus 404, der Bildoptimizer 400, und alle im Admin hochgeladenen
   * AVIF-Fotos standen im Shop als „Bild liess sich nicht laden".
   * Gemessen: GET api-test.jibbit.ch/static/1789907161607-5053_ocb.avif
   *   -> 200, Content-Type: application/octet-stream.
   */
  it("erkennt AVIF an der Endung, wenn das Backend nur octet-stream meldet", () => {
    expect(
      resolveImageContentType("application/octet-stream", "1789907161607-5053_ocb.avif"),
    ).toBe("image/avif");
  });

  it("entscheidet auch bei fehlendem Header und grossgeschriebener Endung nach der Endung", () => {
    expect(resolveImageContentType(null, "1755-foo.AVIF")).toBe("image/avif");
    expect(resolveImageContentType("", "2026/1755-foo.JPG")).toBe("image/jpeg");
    expect(resolveImageContentType(undefined, "1755-foo.jpeg")).toBe("image/jpeg");
  });

  it("lässt unbekannte Endungen auch bei octet-stream nicht durch", () => {
    expect(resolveImageContentType("application/octet-stream", "1755-foto.heic")).toBeNull();
    expect(resolveImageContentType("application/octet-stream", "1755-export.csv")).toBeNull();
    expect(resolveImageContentType("application/octet-stream", "1755-logo.svg")).toBeNull();
    expect(resolveImageContentType("application/octet-stream", "ohne-endung")).toBeNull();
  });

  /**
   * Die Endung darf eine AUSDRÜCKLICHE Angabe nie überstimmen — sonst liesse
   * sich eine HTML- oder SVG-Datei mit `.avif` im Namen durch den Proxy
   * schieben.
   */
  it("überstimmt einen konkreten fremden Typ nicht", () => {
    expect(resolveImageContentType("text/html", "1755-foo.avif")).toBeNull();
    expect(resolveImageContentType("image/svg+xml", "1755-foo.png")).toBeNull();
    expect(resolveImageContentType("application/json", "1755-foo.jpg")).toBeNull();
  });
});
