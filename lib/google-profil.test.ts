import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GOOGLE_PROFIL } from "./trust";

/**
 * Places-API-Anbindung: gemockter fetch, kein Netz, kein Next-Cache.
 * Geprüft werden Abruf (URL, Schlüssel-Header, Feldmaske), strenge
 * Antwortprüfung und der Lader: ohne Konfiguration OHNE Zahl, bei Ausfall
 * der letzte gute Wert, erst ohne jeden früheren Wert die Zeile ohne Zahl.
 * Es gibt KEINE Zahl im Code, auf die zurückgefallen werden könnte.
 */

const cacheKeys: unknown[][] = [];
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown, key: unknown[]) => {
    cacheKeys.push(key);
    return fn;
  },
}));

const {
  createGoogleProfilLoader,
  DEFAULT_PLACES_ENDPOINT,
  fetchGoogleProfilRating,
  isProfilConfigured,
  liveProfil,
  parsePlacesResponse,
  REVALIDATE_SECONDS,
} = await import("./google-profil");

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
  it("ruft Place Details (New) mit Schlüssel-Header und Feldmaske ab", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ rating: 5, userRatingCount: 26 }),
    );
    const got = await fetchGoogleProfilRating({ apiKey: "key-123", placeId: "ChIJ/x", fetchImpl });

    expect(got).toEqual({ rating: 5, count: 26 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(DEFAULT_PLACES_ENDPOINT).toBe("https://places.googleapis.com/v1/places/");
    expect(url).toBe(`${DEFAULT_PLACES_ENDPOINT}ChIJ%2Fx?fields=rating,userRatingCount`);
    expect(init.headers["X-Goog-Api-Key"]).toBe("key-123");
    expect(init.headers["X-Goog-FieldMask"]).toBe("rating,userRatingCount");
  });

  it("null bei HTTP-Fehler, kaputtem JSON oder Netzfehler — wirft nie", async () => {
    const cases = [
      vi.fn().mockResolvedValue(jsonResponse({ error: "denied" }, 403)),
      vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })),
      vi.fn().mockRejectedValue(new Error("ECONNRESET")),
    ];
    for (const fetchImpl of cases) {
      expect(await fetchGoogleProfilRating({ apiKey: "k", placeId: "p", fetchImpl })).toBeNull();
    }
  });
});

describe("liveProfil", () => {
  it("liefert das Profil mit Abrufdatum und Profil-URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ rating: 4.9, userRatingCount: 40 }));
    const got = await liveProfil(ENV, fetchImpl, () => new Date("2026-11-03T10:00:00Z"));
    expect(got).toEqual({
      url: GOOGLE_PROFIL.url,
      rating: 4.9,
      count: 40,
      stand: "2026-11-03",
      source: "places",
    });
  });

  it("WIRFT bei Fehler — damit der Cache den alten Wert behält", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    await expect(liveProfil(ENV, fetchImpl)).rejects.toThrow(/keine Bewertung/);
  });

  it("nutzt einen abweichenden Endpunkt nur, wenn GOOGLE_PLACES_ENDPOINT gesetzt ist (Tests)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ rating: 5, userRatingCount: 1 }));
    await liveProfil({ ...ENV, GOOGLE_PLACES_ENDPOINT: "http://127.0.0.1:9100/places/v1/places/" }, fetchImpl);
    expect(fetchImpl.mock.calls[0][0]).toMatch(/^http:\/\/127\.0\.0\.1:9100\/places\/v1\/places\/ChIJtest\?/);
  });
});

describe("Lader (createGoogleProfilLoader)", () => {
  it("ohne Schlüssel oder Place-ID: OHNE Zahl, kein Abruf", async () => {
    const live = vi.fn();
    for (const env of [{}, { GOOGLE_PLACES_API_KEY: "k" }, { GOOGLE_PLACE_ID: "p" }, { GOOGLE_PLACES_API_KEY: " ", GOOGLE_PLACE_ID: "p" }]) {
      expect(isProfilConfigured(env)).toBe(false);
      const load = createGoogleProfilLoader({ env: () => env, live });
      expect(await load()).toEqual({
        url: GOOGLE_PROFIL.url,
        rating: null,
        count: null,
        stand: null,
        source: "ohne",
      });
    }
    expect(live).not.toHaveBeenCalled();
  });

  it("mit Konfiguration: der (gecachte) Live-Wert, Place-ID als Argument", async () => {
    const profil = { url: GOOGLE_PROFIL.url, rating: 5, count: 26, stand: "2026-10-05", source: "places" as const };
    const live = vi.fn().mockResolvedValue(profil);
    const load = createGoogleProfilLoader({ env: () => ENV, live });
    expect(await load()).toEqual(profil);
    expect(live).toHaveBeenCalledWith("ChIJtest");
  });

  it("bei Ausfall nach einem Erfolg: der letzte gute Wert bleibt stehen", async () => {
    const profil = { url: GOOGLE_PROFIL.url, rating: 5, count: 26, stand: "2026-10-05", source: "places" as const };
    const live = vi.fn().mockResolvedValueOnce(profil).mockRejectedValue(new Error("503"));
    let t = 1_000_000;
    const load = createGoogleProfilLoader({ env: () => ENV, live, now: () => t });
    await load();
    t += 30 * 3600 * 1000;
    const got = await load();
    expect(got).toEqual({ ...profil, source: "letzter-wert" });
    expect(got.rating).toBe(5);
  });

  it("bei Ausfall ohne jeden früheren Wert: OHNE Zahl — nie eine erfundene", async () => {
    const live = vi.fn().mockRejectedValue(new Error("403"));
    const load = createGoogleProfilLoader({ env: () => ENV, live });
    const got = await load();
    expect(got.rating).toBeNull();
    expect(got.count).toBeNull();
    expect(got.source).toBe("ohne");
  });

  it("ist 6 Stunden gecacht (unstable_cache, Schlüssel google-profil)", () => {
    expect(REVALIDATE_SECONDS).toBe(6 * 3600);
    expect(cacheKeys).toContainEqual(["google-profil"]);
  });
});
