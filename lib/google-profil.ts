import { unstable_cache } from "next/cache";
import { GOOGLE_PROFIL, profilOhneZahl, type GoogleProfil } from "./trust";

/**
 * GOOGLE-UNTERNEHMENSPROFIL — Bewertung und Anzahl Rezensionen, live über
 * die Places API (New). Für die Vertrauenszeile im Shop-Kopf
 * (components/ShopTrust.tsx).
 *
 * NORMALWEG: `GET https://places.googleapis.com/v1/places/{placeId}?fields=rating,userRatingCount`
 * mit `X-Goog-Api-Key` (Place Details (New)), nur diese zwei Felder
 * (Feldmaske). Gecacht 6 Stunden (`unstable_cache`, Muster wie
 * app/merchant-feed.tsv/route.ts) — also rund 4 Abrufe pro Tag.
 *
 * UMGEBUNG (beide nötig, sonst wird OHNE Zahl gerendert):
 *   GOOGLE_PLACES_API_KEY — Schlüssel aus der Google Cloud Console,
 *     beschränkt auf «Places API (New)». Serverseitig, nie NEXT_PUBLIC_.
 *   GOOGLE_PLACE_ID — Place-ID des Profils; ermitteln mit
 *     `npm run google-profil:place-id` (scripts/google-place-id.mjs).
 *   GOOGLE_PLACES_ENDPOINT — nur für Tests (E2E-Mock); Standard ist Google.
 *
 * KEINE VERALTETE ZAHL, NIE: Es gibt keine von Hand gepflegte Zahl im Code.
 * Ohne Schlüssel/Place-ID zeigt die Zeile «Bewertungen auf Google» als Link
 * — ehrlich und prüfbar, aber ohne Note. Fällt die API AUS, während der
 * Shop läuft, bleibt der letzte erfolgreich abgerufene Wert stehen: zuerst
 * über den Cache (die gecachte Funktion WIRFT bei Fehlern, darum bleibt der
 * alte Eintrag im Next-Cache und wird weiter ausgeliefert), zusätzlich über
 * einen In-Memory-Merker je Prozess (`lastGood`, mit Zeitstempel) für den
 * Fall, dass der Cache-Eintrag selbst verfallen oder geleert ist. Erst wenn
 * es nie einen erfolgreichen Abruf gab, erscheint die Zeile ohne Zahl.
 *
 * Innerhalb des Cache-Scopes keine Request-APIs (cookies/headers) — hier
 * werden keine gebraucht; der Cache-Schlüssel enthält die Place-ID, NICHT
 * den API-Schlüssel (der würde sonst im Dateisystem-Cache landen).
 */

export const DEFAULT_PLACES_ENDPOINT = "https://places.googleapis.com/v1/places/";
export const REVALIDATE_SECONDS = 6 * 3600;

export interface PlacesRating {
  rating: number;
  count: number;
}

/** Googles Antwort auf `rating`, `userRatingCount` prüfen — streng. */
export function parsePlacesResponse(json: unknown): PlacesRating | null {
  if (typeof json !== "object" || json === null) return null;
  const { rating, userRatingCount } = json as Record<string, unknown>;
  if (typeof rating !== "number" || !Number.isFinite(rating)) return null;
  if (rating < 1 || rating > 5) return null;
  if (typeof userRatingCount !== "number" || !Number.isInteger(userRatingCount))
    return null;
  if (userRatingCount < 1) return null;
  return { rating, count: userRatingCount };
}

export interface FetchOptions {
  apiKey: string;
  placeId: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

/** Ein Abruf; `null` bei jedem Fehler (Netz, Status, Inhalt). Wirft nie. */
export async function fetchGoogleProfilRating({
  apiKey,
  placeId,
  endpoint = DEFAULT_PLACES_ENDPOINT,
  fetchImpl = fetch,
}: FetchOptions): Promise<PlacesRating | null> {
  const url = `${endpoint}${encodeURIComponent(placeId)}?fields=rating,userRatingCount`;
  try {
    const res = await fetchImpl(url, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "rating,userRatingCount",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      console.warn(`[google-profil] Places API antwortet ${res.status}.`);
      return null;
    }
    const parsed = parsePlacesResponse(await res.json());
    if (!parsed) {
      console.warn(
        "[google-profil] Places-Antwort ohne brauchbare rating/userRatingCount — Place-ID prüfen.",
      );
    }
    return parsed;
  } catch (err) {
    console.warn(
      `[google-profil] Places API nicht erreichbar (${err instanceof Error ? err.message : String(err)}).`,
    );
    return null;
  }
}

export interface ProfilEnv {
  GOOGLE_PLACES_API_KEY?: string;
  GOOGLE_PLACE_ID?: string;
  GOOGLE_PLACES_ENDPOINT?: string;
}

/** Live abrufen; WIRFT bei Fehler (damit ein Cache den alten Wert behält). */
export async function liveProfil(
  env: ProfilEnv,
  fetchImpl: typeof fetch = fetch,
  today: () => Date = () => new Date(),
): Promise<GoogleProfil> {
  const apiKey = env.GOOGLE_PLACES_API_KEY?.trim() ?? "";
  const placeId = env.GOOGLE_PLACE_ID?.trim() ?? "";
  const live = await fetchGoogleProfilRating({
    apiKey,
    placeId,
    endpoint: env.GOOGLE_PLACES_ENDPOINT?.trim() || DEFAULT_PLACES_ENDPOINT,
    fetchImpl,
  });
  if (!live) throw new Error("Places API lieferte keine Bewertung");
  return {
    url: GOOGLE_PROFIL.url,
    rating: live.rating,
    count: live.count,
    stand: today().toISOString().slice(0, 10),
    source: "places",
  };
}

export function isProfilConfigured(env: ProfilEnv): boolean {
  return Boolean(env.GOOGLE_PLACES_API_KEY?.trim() && env.GOOGLE_PLACE_ID?.trim());
}

export interface LoaderDeps {
  env: () => ProfilEnv;
  /** Die (gecachte) Live-Funktion — wirft bei Fehler. */
  live: (placeId: string) => Promise<GoogleProfil>;
  now?: () => number;
}

/**
 * Baut den Lader: Umgebung prüfen → gecachter Live-Abruf → bei Fehler der
 * letzte gute Wert aus dem Speicher → sonst ohne Zahl. Als Fabrik, damit
 * Tests einen eigenen Lader ohne Next-Cache und ohne Netz bauen können.
 */
export function createGoogleProfilLoader({ env, live, now = Date.now }: LoaderDeps) {
  let lastGood: { profil: GoogleProfil; at: number } | null = null;
  let hinted = false;

  return async function getGoogleProfil(): Promise<GoogleProfil> {
    const e = env();
    if (!isProfilConfigured(e)) {
      if (!hinted) {
        hinted = true;
        console.info(
          "[google-profil] GOOGLE_PLACES_API_KEY/GOOGLE_PLACE_ID nicht gesetzt — die Vertrauenszeile zeigt «Bewertungen auf Google» ohne Zahl.",
        );
      }
      return profilOhneZahl();
    }

    try {
      const profil = await live(e.GOOGLE_PLACE_ID!.trim());
      lastGood = { profil, at: now() };
      return profil;
    } catch (err) {
      if (lastGood) {
        const hours = Math.round((now() - lastGood.at) / 36e5);
        console.warn(
          `[google-profil] Abruf fehlgeschlagen (${err instanceof Error ? err.message : String(err)}) — zeige den letzten Wert (vor ${hours} h).`,
        );
        return { ...lastGood.profil, source: "letzter-wert" };
      }
      console.warn(
        `[google-profil] Abruf fehlgeschlagen (${err instanceof Error ? err.message : String(err)}) und kein früherer Wert — Zeile ohne Zahl.`,
      );
      return profilOhneZahl();
    }
  };
}

function readEnv(): ProfilEnv {
  return {
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
    GOOGLE_PLACE_ID: process.env.GOOGLE_PLACE_ID,
    GOOGLE_PLACES_ENDPOINT: process.env.GOOGLE_PLACES_ENDPOINT,
  };
}

/**
 * Gecachter Live-Abruf, 6 h. Der Schlüssel enthält nur die Place-ID; der
 * API-Schlüssel wird INNERHALB gelesen. Wirft bei Fehler — dann bleibt der
 * vorherige Cache-Eintrag bestehen (Next liefert ihn weiter aus).
 */
const cachedLive = unstable_cache(
  (placeId: string) =>
    liveProfil({ ...readEnv(), GOOGLE_PLACE_ID: placeId }),
  ["google-profil"],
  { revalidate: REVALIDATE_SECONDS, tags: ["google-profil"] },
);

/** Für den Shop-Kopf. */
export const getGoogleProfil = createGoogleProfilLoader({
  env: readEnv,
  live: cachedLive,
});
