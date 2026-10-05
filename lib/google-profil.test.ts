import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GOOGLE_PROFIL } from "./trust";

/**
 * Places-API-Anbindung: gemockter fetch, kein Netz. Geprüft werden Abruf
 * (URL, Schlüssel-Header, Feldmaske), strenge Antwortprüfung und der
 * Rückfall auf GOOGLE_PROFIL in jedem Fehlerfall — die Leiste darf nie eine
 * leere oder unsinnige Zahl zeigen.
 */

const cacheKeys: unknown[][] = [];
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown, key: unknown[]) => {
    cacheKeys.push(key);
    return fn;
  },
}));

const { fetchGoogleProfilRating, parsePlacesResponse, resolveGoogleProfil, PLACES_ENDPOINT, REVALIDATE_SECONDS } =
  await import("./google-profil");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ENV = { GOOGLE_PLACES_API_KEY: "key-123", GOOGLE_PLACE_ID: "ChIJtest" };

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("parsePlacesResponse", () => {
  it("nimmt rating 1–5 und userRatingCount ≥ 1", () => {
    expect(parsePlacesResponse({ rating: 4.7, userRatingCount: 31 })).toEqual({
      rating: 4.7,
      count: 31,
    });
  });

  it("verwirft alles Unbrauchbare", () => {
    for (const bad of [
      null,
      "x",
      {},
      { rating: "5", userRatingCount: 3 },
      { rating: 5, userRatingCount: "3" },
      { rating: 0.5, userRatingCount: 3 },
      { rating: 5.1, userRatingCount: 3 },
      { rating: 4, userRatingCount: 0 },
      { rating: 4, userRatingCount: 2.5 },
      { rating: NaN, userRatingCount: 3 },
    ]) {
      expect(parsePlacesResponse(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("fetchGoogleProfilRating", () => {
  it("ruft Place Details mit Schlüssel-Header und Feldmaske ab", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ rating: 5, userRatingCount: 26 }),
    );
    const got = await fetchGoogleProfilRating({ apiKey: "key-123", placeId: "ChIJ/x", fetchImpl });

    expect(got).toEqual({ rating: 5, count: 26 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${PLACES_ENDPOINT}ChIJ%2Fx?fields=rating,userRatingCount`);
    expect(init.headers["X-Goog-Api-Key"]).toBe("key-123");
    expect(init.headers["X-Goog-FieldMask"]).toBe("rating,userRatingCount");
  });

  it("null bei HTTP-Fehler, kaputtem JSON oder Netzfehler — wirft nie", async () => {
    expect(
      await fetchGoogleProfilRating({
        apiKey: "k",
        placeId: "p",
        fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ error: "denied" }, 403)),
      }),
    ).toBeNull();
    expect(
      await fetchGoogleProfilRating({
        apiKey: "k",
        placeId: "p",
        fetchImpl: vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })),
      }),
    ).toBeNull();
    expect(
      await fetchGoogleProfilRating({
        apiKey: "k",
        placeId: "p",
        fetchImpl: vi.fn().mockRejectedValue(new Error("ECONNRESET")),
      }),
    ).toBeNull();
  });
});

describe("resolveGoogleProfil", () => {
  it("ohne Schlüssel oder Place-ID: Konstante, KEIN Abruf", async () => {
    const fetchImpl = vi.fn();
    for (const env of [
      {},
      { GOOGLE_PLACES_API_KEY: "k" },
      { GOOGLE_PLACE_ID: "p" },
      { GOOGLE_PLACES_API_KEY: " ", GOOGLE_PLACE_ID: "p" },
    ]) {
      const got = await resolveGoogleProfil(env, fetchImpl);
      expect(got).toEqual({ ...GOOGLE_PROFIL, source: "konstante" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("mit Konfiguration: Live-Zahlen, heutiges Datum, Profil-URL aus der Konstante", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ rating: 4.9, userRatingCount: 40 }),
    );
    const got = await resolveGoogleProfil(ENV, fetchImpl, () => new Date("2026-11-03T10:00:00Z"));
    expect(got).toEqual({
      rating: 4.9,
      count: 40,
      stand: "2026-11-03",
      url: GOOGLE_PROFIL.url,
      source: "places",
    });
  });

  it("bei Fehler der API: Konstante", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    const got = await resolveGoogleProfil(ENV, fetchImpl);
    expect(got.source).toBe("konstante");
    expect(got.rating).toBe(GOOGLE_PROFIL.rating);
    expect(got.count).toBe(GOOGLE_PROFIL.count);
  });

  it("ist 6 Stunden gecacht (unstable_cache, Schlüssel google-profil)", () => {
    expect(REVALIDATE_SECONDS).toBe(6 * 3600);
    expect(cacheKeys).toContainEqual(["google-profil"]);
  });
});
