/**
 * /terms — die Adresse der AGB im alten Odoo-Shop.
 *
 * Bewusst KEINE Weiterleitung: https://jibbit.ch/terms ist im Google Merchant
 * Center als URL der Rückgaberichtlinie hinterlegt und muss genau unter
 * dieser Adresse weiter eine Seite liefern. Es ist dieselbe Seite wie /agb,
 * samt deren `rel=canonical` auf /agb — für die Suche bleibt es bei einer
 * Adresse, und /terms steht deshalb auch nicht in der Sitemap.
 *
 * Sobald im Merchant Center /service/rueckgabe (oder /agb) eingetragen ist,
 * kann diese Datei weg und `/terms` in lib/seo/legacy-redirects.ts wieder
 * ein 301 werden (dort `KEPT_PATHS`).
 */
export { default, metadata } from "../agb/page";
