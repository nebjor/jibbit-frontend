import { describe, expect, it } from "vitest";
import { parseMediaPath, toMediaKey, toMediaSrc } from "./media";

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
