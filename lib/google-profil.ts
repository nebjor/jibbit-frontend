import { unstable_cache } from "next/cache";
import { GOOGLE_PROFIL, type GoogleProfilRating } from "./trust";

/**
 * GOOGLE-UNTERNEHMENSPROFIL — Bewertung und Anzahl Rezensionen, wahlweise
 * live über die Places API (New), sonst aus der Konstante GOOGLE_PROFIL
 * (lib/trust.ts). Für die Vertrauensleiste (components/TrustBar.tsx).
 *
 * Abruf: `GET https://places.googleapis.com/v1/places/{placeId}?fields=rating,userRatingCount`
 * mit `X-Goog-Api-Key` (Places API (New), Place Details). Nur diese zwei
 * Felder (Feldmaske) — welche Preisstufe Google dafür verrechnet, steht in
 * Googles Preisliste; bei 6 Stunden Cache sind es ohnehin 4 Abrufe pro Tag.
 *
 * ZWEI UMGEBUNGSVARIABLEN, beide standardmässig leer:
 *   GOOGLE_PLACES_API_KEY — Schlüssel aus der Google Cloud Console, auf
 *     «Places API (New)» beschränkt. Serverseitig, nie NEXT_PUBLIC_.
 *   GOOGLE_PLACE_ID — die Place-ID des Profils. Maps zeigt nur die
 *     Knowledge-Graph-ID `/g/11p1f3mtw4`, die ist KEINE Place-ID; ermitteln
 *     über https://developers.google.com/maps/documentation/places/web-service/place-id
 *     (Place ID Finder) mit «Jibbit .ch - Headshop, Winterthur».
 *
 * RÜCKFALL: fehlt eine der beiden, antwortet Google mit Fehler, oder die
 * Antwort ist unbrauchbar (keine Zahl, Bewertung ausserhalb 1–5, null
 * Rezensionen — fast sicher eine falsche Place-ID) => die Konstante, mit
 * einem Hinweis im Serverlog. Die Leiste zeigt also nie «undefined bei
 * Google», höchstens die zuletzt von Hand gepflegte Zahl.
 *
 * CACHE: `unstable_cache`, 6 Stunden, kein Mandantenbezug — es gibt genau
 * ein Profil (jibbit). Dasselbe Muster wie app/merchant-feed.tsv/route.ts.
 * Innerhalb des Cache-Scopes keine Request-APIs (cookies/headers) — hier
 * werden keine gebraucht.
 */

export const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places/";
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
  fetchImpl?: typeof fetch;
}

/** Ein Abruf; `null` bei jedem Fehler (Netz, Status, Inhalt). Wirft nie. */
export async function fetchGoogleProfilRating({
  apiKey,
  placeId,
  fetchImpl = fetch,
}: FetchOptions): Promise<PlacesRating | null> {
  const url = `${PLACES_ENDPOINT}${encodeURIComponent(placeId)}?fields=rating,userRatingCount`;
  try {
    const res = await fetchImpl(url, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "rating,userRatingCount",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      console.warn(
        `[google-profil] Places API antwortet ${res.status} — Rückfall auf GOOGLE_PROFIL.`,
      );
      return null;
    }
    const parsed = parsePlacesResponse(await res.json());
    if (!parsed) {
      console.warn(
        "[google-profil] Places-Antwort ohne brauchbare rating/userRatingCount — Rückfall auf GOOGLE_PROFIL (Place-ID prüfen).",
      );
    }
    return parsed;
  } catch (err) {
    console.warn(
      `[google-profil] Places API nicht erreichbar (${err instanceof Error ? err.message : String(err)}) — Rückfall auf GOOGLE_PROFIL.`,
    );
    return null;
  }
}

export interface ProfilEnv {
  GOOGLE_PLACES_API_KEY?: string;
  GOOGLE_PLACE_ID?: string;
}

/** Die Konstante als vollständiges Profil. */
export function fallbackProfil(): GoogleProfilRating {
  return { ...GOOGLE_PROFIL, source: "konstante" };
}

let hinted = false;

/**
 * Entscheidung ohne Cache: Umgebung lesen, bei vollständiger Konfiguration
 * abrufen, sonst oder bei Fehler die Konstante. Rein, damit testbar.
 */
export async function resolveGoogleProfil(
  env: ProfilEnv,
  fetchImpl: typeof fetch = fetch,
  today: () => Date = () => new Date(),
): Promise<GoogleProfilRating> {
  const apiKey = env.GOOGLE_PLACES_API_KEY?.trim();
  const placeId = env.GOOGLE_PLACE_ID?.trim();

  if (!apiKey || !placeId) {
    if (!hinted) {
      hinted = true;
      console.info(
        "[google-profil] GOOGLE_PLACES_API_KEY/GOOGLE_PLACE_ID nicht gesetzt — die Vertrauensleiste zeigt die von Hand gepflegten Zahlen aus GOOGLE_PROFIL.",
      );
    }
    return fallbackProfil();
  }

  const live = await fetchGoogleProfilRating({ apiKey, placeId, fetchImpl });
  if (!live) return fallbackProfil();

  return {
    rating: live.rating,
    count: live.count,
    stand: today().toISOString().slice(0, 10),
    url: GOOGLE_PROFIL.url,
    source: "places",
  };
}

/** Für die Leiste: gecacht, 6 Stunden. */
export const getGoogleProfil = unstable_cache(
  () =>
    resolveGoogleProfil({
      GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
      GOOGLE_PLACE_ID: process.env.GOOGLE_PLACE_ID,
    }),
  ["google-profil"],
  { revalidate: REVALIDATE_SECONDS, tags: ["google-profil"] },
);
