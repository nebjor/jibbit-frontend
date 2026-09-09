/* =========================================================================
   INTRO-CHOREOGRAFIE — ALLE ZEITEN STEHEN HIER UND NUR HIER.
   =========================================================================
   Der Betreiber will am Timing drehen: eine Zahl ändern genügt. Die Werte
   fliessen (a) in die Phasen-Maschine (lib/intro/machine.ts) und (b) als
   CSS-Custom-Properties in die Übergänge (IntroOverlay.tsx setzt sie als
   Inline-Variablen) — Logik und CSS können also nicht auseinanderlaufen.

   Ablauf (jede Phase eine Zeile):

     white       weisse Fläche, sonst nichts
     jointIn     der brennende Pixel-Joint fliegt von unten links zur Mitte
     jointBurn   er brennt kurz in der Mitte (die Sprite-Schleife läuft)
     smokeGrow   die Rauchwolke wächst, bis sie den ganzen Bildschirm füllt
     logoReveal  die Wolke verzieht sich, dahinter steht das jibbit-Logo
     logoHold    das Logo steht — die «2 Sekunden» aus dem Briefing
     logoFlight  FLIP-Flug des Logos an seinen Platz oben links im Header;
                 gleichzeitig blendet die weisse Fläche auf die Seite über
   ========================================================================= */

export const INTRO_PHASE_ORDER = [
  "white",
  "jointIn",
  "jointBurn",
  "smokeGrow",
  "logoReveal",
  "logoHold",
  "logoFlight",
] as const;

export type IntroPhase = (typeof INTRO_PHASE_ORDER)[number];

/** Dauer jeder Phase in Millisekunden. HIER drehen, nirgendwo sonst. */
export const INTRO_TIMINGS: Readonly<Record<IntroPhase, number>> = {
  white: 350,
  jointIn: 900,
  jointBurn: 500,
  smokeGrow: 800,
  logoReveal: 600,
  logoHold: 2000,
  logoFlight: 650,
};

/** Gesamtdauer des ungestörten Durchlaufs (derzeit 5800 ms). */
export const INTRO_TOTAL_MS = INTRO_PHASE_ORDER.reduce(
  (sum, phase) => sum + INTRO_TIMINGS[phase],
  0,
);

/** sessionStorage-Schlüssel: Intro nur beim ERSTEN Besuch pro Sitzung. */
export const INTRO_SESSION_KEY = "jibbit-intro-seen";

/**
 * Notbremse für den Vor-Hydrations-Deckel (Inline-Script in HomeIntro.tsx):
 * übernimmt React nie (Bundle-Fehler, Uralt-Browser), räumt dieser Timer den
 * weissen Deckel wieder weg, damit die serverseitig gerenderte Seite nicht
 * dauerhaft verdeckt bleibt. Läuft die Übernahme normal, löscht
 * IntroOverlay.tsx den Timer, bevor er feuert.
 */
export const INTRO_FAILSAFE_MS = 5000;
