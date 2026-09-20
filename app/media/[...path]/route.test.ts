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
});
