import { INTRO_FAILSAFE_MS, INTRO_SESSION_KEY } from "@/lib/intro/timings";
import { IntroOverlay } from "./IntroOverlay";
import "./intro-global.css";

/**
 * ERSTBESUCHS-INTRO DER STARTSEITE — Einstiegspunkt (Server-Komponente).
 *
 * Choreografie und Zeiten: lib/intro/timings.ts. Austauschstelle für die
 * Rauchgrafik: components/intro/SmokeCloud.tsx. Das Overlay selbst:
 * IntroOverlay.tsx (Client).
 *
 * ABFOLGE MIT ALTERSABFRAGE UND COOKIE-HINWEIS
 * Die Consent-Schicht (components/consent/, UNANGETASTET) steckt beim ersten
 * Besuch bereits serverseitig im HTML (AgeGate z-index 300, Banner 290). Das
 * Intro legt sich mit z-index 400/410 DARÜBER: erst die Inszenierung, dann
 * die Pflichten — nie drei Schichten gleichzeitig sichtbar. Endet das Intro
 * (oder wird es übersprungen), steht die Altersabfrage unverändert da, mit
 * ihrem eigenen Fokus-Management. Damit ein Tastendruck während des Intros
 * nicht versehentlich einen Knopf der darunterliegenden Abfrage auslöst,
 * fängt IntroOverlay.tsx aktivierende Tasten in der Capture-Phase ab.
 *
 * SUCHMASCHINEN sehen nie «nur das Intro»: die Startseite bleibt vollständig
 * serverseitig gerendert, das Overlay ist eine rein clientseitige Zutat
 * (rendert serverseitig null). Der weisse Vor-Hydrations-Deckel unten wird
 * NUR wirksam, wenn das Inline-Script per JavaScript das Attribut
 * `data-jibbit-intro` setzt — ein Crawler ohne JavaScript bekommt schlicht
 * die Seite.
 *
 * WOZU DAS INLINE-SCRIPT? Zwischen erstem Paint und React-Hydration läge
 * sonst ein Moment, in dem die Startseite kurz aufblitzt, bevor das Intro
 * sie überdeckt. Das Script läuft, während das HTML geparst wird: es prüft
 * dieselben Bedingungen wie lib/intro/decision.ts (Sitzungs-Marker,
 * prefers-reduced-motion, werfender Speicher -> gar nichts tun) und setzt
 * nur ein Attribut; den weissen Deckel malt intro-global.css. Übernimmt
 * React nie (Bundle-Fehler), räumt die Notbremse (INTRO_FAILSAFE_MS) den
 * Deckel wieder weg — die Seite bleibt nie dauerhaft verdeckt.
 */
const PRE_SCRIPT =
  `(function(){try{` +
  `if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;` +
  `if(window.sessionStorage.getItem(${JSON.stringify(INTRO_SESSION_KEY)}))return;` +
  `var d=document.documentElement;d.setAttribute("data-jibbit-intro","");` +
  `window.__jibbitIntroFailsafe=window.setTimeout(function(){d.removeAttribute("data-jibbit-intro");},${INTRO_FAILSAFE_MS});` +
  `}catch(e){}})();`;

export function HomeIntro() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PRE_SCRIPT }} />
      <IntroOverlay />
    </>
  );
}
