#!/usr/bin/env node
/**
 * Place-ID des Google-Unternehmensprofils ermitteln.
 *
 *   GOOGLE_PLACES_API_KEY=… npm run google-profil:place-id
 *   GOOGLE_PLACES_API_KEY=… npm run google-profil:place-id -- "Jibbit Unterwegli 1 Winterthur"
 *
 * Fragt die Places API (New) Text Search
 * (POST https://places.googleapis.com/v1/places:searchText) mit dem Suchtext
 * ab und gibt je Treffer Place-ID, Name, Adresse, Bewertung und Anzahl
 * Rezensionen aus. Die Place-ID des richtigen Treffers kommt als
 * GOOGLE_PLACE_ID in die Umgebung des Storefronts (docs/google-kundenrezensionen.md,
 * Abschnitt 10). Nur Node 20+ (fetch), keine Abhängigkeiten, nur lesend.
 *
 * Google Maps zeigt im Link nur die Knowledge-Graph-Kennung (/g/11p1f3mtw4) —
 * das ist KEINE Place-ID; darum dieses Script.
 */

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const DEFAULT_QUERY = "Jibbit Unterwegli 1 Winterthur";
const FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount";

const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
if (!apiKey) {
  console.error(
    "GOOGLE_PLACES_API_KEY fehlt. Schlüssel aus der Google Cloud Console (Places API (New)) setzen:\n" +
      "  GOOGLE_PLACES_API_KEY=… npm run google-profil:place-id",
  );
  process.exit(1);
}

const textQuery = process.argv.slice(2).join(" ").trim() || DEFAULT_QUERY;

const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
    "X-Goog-FieldMask": FIELD_MASK,
  },
  body: JSON.stringify({ textQuery, languageCode: "de", regionCode: "CH" }),
});

if (!res.ok) {
  console.error(`Places API antwortet ${res.status} ${res.statusText}`);
  console.error(await res.text());
  console.error(
    "\nHäufige Ursachen: Schlüssel nicht auf «Places API (New)» freigeschaltet, API im Projekt nicht aktiviert, Abrechnung nicht eingerichtet.",
  );
  process.exit(1);
}

const { places = [] } = await res.json();
if (places.length === 0) {
  console.log(`Keine Treffer für «${textQuery}». Suchtext anpassen (Name, Strasse, Ort).`);
  process.exit(2);
}

console.log(`Treffer für «${textQuery}»:\n`);
for (const p of places) {
  const rating = p.rating !== undefined ? `${p.rating.toFixed(1)} ★ (${p.userRatingCount ?? 0})` : "ohne Bewertung";
  console.log(`  ${p.displayName?.text ?? "?"} — ${p.formattedAddress ?? "?"}`);
  console.log(`    Place-ID: ${p.id}`);
  console.log(`    ${rating}\n`);
}
console.log(
  "Die Place-ID des passenden Treffers als GOOGLE_PLACE_ID eintragen (Anleitung: docs/google-kundenrezensionen.md, Abschnitt 10).",
);
