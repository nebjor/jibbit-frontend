import "server-only";

import { parseBadgeSwitch } from "./badge";
import { parseMerchantId } from "./payload";

/**
 * Google Kundenrezensionen — serverseitige Laufzeitkonfiguration.
 *
 * Die Merchant-Center-ID kommt aus der UMGEBUNG und wird zur LAUFZEIT
 * gelesen, nicht als NEXT_PUBLIC_* zur Build-Zeit ins Bundle gebacken —
 * aus denselben zwei Gründen wie beim PostHog-Schlüssel
 * (lib/analytics/server.ts): ein gemeinsam genutztes Docker-Image darf
 * keine deployment-spezifische Konfiguration enthalten, und der Wert darf
 * ohnehin öffentlich im Browser stehen (er steht in Googles Snippet auf
 * jeder Bestätigungsseite). Er kommt nur eben aus der Umgebung statt aus
 * dem Build und wandert als Prop zur Client-Komponente.
 *
 * Nicht gesetzt oder keine Zahl => `null` => die Komponente rendert nichts.
 * Kein Fehler, ein einmaliger Hinweis im Serverlog.
 */

let hinted = false;

export function getKundenrezensionenMerchantId(): number | null {
  const id = parseMerchantId(process.env.GOOGLE_KUNDENREZENSIONEN_MERCHANT_ID);

  if (id === null && !hinted) {
    hinted = true;
    console.info(
      "[kundenrezensionen] GOOGLE_KUNDENREZENSIONEN_MERCHANT_ID ist nicht gesetzt — das Google-Opt-in wird nicht eingebunden.",
    );
  }

  return id;
}

/**
 * Schalter für das Store Widget («Badge») — `GOOGLE_KUNDENREZENSIONEN_BADGE=1`.
 * Standard AUS: das Widget zeigt erst mit genügend Rezensionen eine
 * Bewertung, davor nur «nicht verfügbar». Wann der Inhaber einschaltet:
 * docs/google-kundenrezensionen.md, Abschnitt «Store Widget». Wie die
 * Merchant-ID zur LAUFZEIT gelesen, nicht in den Build gebacken.
 */
export function isKundenrezensionenBadgeEnabled(): boolean {
  return parseBadgeSwitch(process.env.GOOGLE_KUNDENREZENSIONEN_BADGE);
}
