import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Der Bildproxy als Ganzes, mit nachgestelltem Backend. Die Typregel selbst ist
 * in lib/media.test.ts abgedeckt — hier geht es darum, dass die Route sie auch
 * wirklich BENUTZT. Genau diese Lücke hat den Ausfall vom 20.09.2026 möglich
 * gemacht: die Liste der erlaubten Typen enthielt `image/avif`, nur kam dieser
 * Typ vom Backend nie an.
 */
vi.mock("@/lib/tenant/resolve-tenant", () => ({
  resolveTenantForHost: vi.fn(async (host: string) =>
    host === "test.jibbit.ch" ? { backendUrl: "http://medusa:9000/" } : null,
  ),
}));

import { GET } from "./route";

function backendAnswers(contentType: string | null, status = 200) {
  const fetchMock = vi.fn(async () => {
    const headers = new Headers({ "content-length": "4" });
    if (contentType) headers.set("content-type", contentType);
    return new Response(new Uint8Array([1, 2, 3, 4]), { status, headers });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function get(...path: string[]) {
  return GET(new Request(`http://localhost/media/${path.join("/")}`), {
    params: Promise.resolve({ path }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /media/<host>/<key>", () => {
  it("reicht ein JPEG mit dem Typ des Backends durch", async () => {
    const fetchMock = backendAnswers("image/jpeg");
    const res = await get("test.jibbit.ch", "1788861447697-Dubi-42.jpg");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://medusa:9000/static/1788861447697-Dubi-42.jpg",
      expect.anything(),
    );
  });

  /**
   * Die Anfrage, die im Shop scheiterte. Medusas express.static kennt `.avif`
   * nicht und antwortet mit `application/octet-stream`; vor der Korrektur kam
   * hier 404 heraus und im Browser „Bild liess sich nicht laden".
   */
  it("liefert ein AVIF aus, das das Backend als octet-stream meldet", async () => {
    backendAnswers("application/octet-stream");
    const res = await get("test.jibbit.ch", "1789907161607-5053_ocb.avif");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/avif");
    expect(res.headers.get("content-length")).toBe("4");
  });

  it("bleibt bei 404 für octet-stream ohne Bildendung", async () => {
    backendAnswers("application/octet-stream");
    expect((await get("test.jibbit.ch", "1755-export.csv")).status).toBe(404);
  });

  it("bleibt bei 404, wenn das Backend ausdrücklich etwas anderes liefert", async () => {
    backendAnswers("text/html; charset=utf-8");
    expect((await get("test.jibbit.ch", "1755-foo.avif")).status).toBe(404);
  });

  it("antwortet 404 bei fehlender Datei und unbekanntem Host", async () => {
    backendAnswers("text/html", 404);
    expect((await get("test.jibbit.ch", "1755-weg.jpg")).status).toBe(404);

    const fetchMock = backendAnswers("image/jpeg");
    expect((await get("fremd.example.ch", "1755-foo.jpg")).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * Dateinamen aus dem Admin mit Leerzeichen und Klammern. Vorher 404 — und
   * die Storefront gab solche Bilder deshalb gleich mit der Backend-Adresse
   * aus. Die Route bekommt von Next den KLARTEXT (Next dekodiert die
   * Parameter selbst, genau einmal); ans Backend geht der Name GENAU EINMAL
   * kodiert.
   */
  it.each([
    [
      "Leerzeichen",
      "1788953074723-RAW BLACK SLIM_01.jpg",
      "1788953074723-RAW%20BLACK%20SLIM_01.jpg",
    ],
    ["runde Klammern", "1755-Name (1).webp", "1755-Name%20%281%29.webp"],
    [
      "eckige Klammern und Komma",
      "1789907393708-[6] PURIZE White, 50er Pack.avif",
      "1789907393708-%5B6%5D%20PURIZE%20White%2C%2050er%20Pack.avif",
    ],
    [
      "Umlaute",
      "1755-Blättchen grün.avif",
      "1755-Bl%C3%A4ttchen%20gr%C3%BCn.avif",
    ],
    ["Prozentzeichen im Namen", "1755-100% Hanf.avif", "1755-100%25%20Hanf.avif"],
  ])("liefert Dateinamen mit Sonderzeichen aus: %s", async (_name, plain, upstream) => {
    const fetchMock = backendAnswers("application/octet-stream");
    const res = await get("test.jibbit.ch", plain);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^image\//);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://medusa:9000/static/${upstream}`,
      expect.anything(),
    );
  });

  /**
   * Kommt bei der Route noch eine Prozentfolge an, war die Adresse doppelt
   * kodiert (`/media/h/Name%2520(1).webp`). Ein zweites Dekodieren gibt es
   * nicht — und damit auch keinen zweiten Weg zum selben Bild.
   */
  it("dekodiert eine doppelt kodierte Adresse nicht ein zweites Mal", async () => {
    const fetchMock = backendAnswers("image/webp");

    expect((await get("test.jibbit.ch", "1755-Name%20(1).webp")).status).toBe(404);
    expect((await get("test.jibbit.ch", "1755-Name%2Ewebp")).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * Die Gegenprobe: nichts davon darf das Backend auch nur ERREICHEN. Geprüft
   * wird deshalb nicht nur der Status, sondern dass gar keine Anfrage
   * hinausgeht.
   */
  it.each([
    ["Pfadwechsel", ["..", "medusa-config.js"]],
    ["kodierte Punkte", ["%2e%2e", "medusa-config.js"]],
    ["doppelt kodierte Punkte", ["%252e%252e", "medusa-config.js"]],
    ["kodierter Schrägstrich", ["..%2fmedusa-config.js"]],
    ["dekodierter Schrägstrich im Segment", ["../medusa-config.js"]],
    ["doppelt kodierter Schrägstrich", ["1755-a%252f..%252fb.png"]],
    ["Backslash", ["1755-a\\..\\b.png"]],
    ["kodierter Backslash", ["1755-a%5c..%5cb.png"]],
    ["Nullbyte", ["1755-foo.png%00.csv"]],
    ["dekodiertes Nullbyte", ["1755-foo.png\u0000.csv"]],
    ["Zeilenumbruch", ["1755-foo%0d%0a.png"]],
    ["privater Upload", ["private-1755-export.png"]],
    ["privater Upload, kodiert", ["%70rivate-1755-export.png"]],
    ["versteckte Datei", [".env"]],
  ])("reicht nichts ans Backend weiter: %s", async (_name, segments) => {
    const fetchMock = backendAnswers("image/png");

    expect((await get("test.jibbit.ch", ...segments)).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("holt auch Sonderzeichen-Dateien nur beim Backend des Tenants", async () => {
    const fetchMock = backendAnswers("image/png");
    await get("test.jibbit.ch", "evil.example.ch", "1755-Name (1).png");

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(new URL(url).origin).toBe("http://medusa:9000");
    expect(new URL(url).pathname).toBe("/static/evil.example.ch/1755-Name%20%281%29.png");
  });

  it("lässt den Dateityp weiterhin nicht durch die Endung überstimmen", async () => {
    // Beide Anfragen ERREICHEN das Backend — abgelehnt wird die Antwort.
    let fetchMock = backendAnswers("text/html");
    expect((await get("test.jibbit.ch", "1755-Name (1).avif")).status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock = backendAnswers("application/octet-stream");
    expect((await get("test.jibbit.ch", "1755-Name (1).svg")).status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
