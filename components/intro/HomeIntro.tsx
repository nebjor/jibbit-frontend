import { INTRO_FAILSAFE_MS, INTRO_SESSION_KEY } from "@/lib/intro/timings";
import { readConsentCookies } from "@/lib/consent/server";
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
 * Die Altersabfrage ist eine BEDINGUNG fürs Betreten, das Intro eine
 * Inszenierung — also: erst Altersabfrage, dann Intro, dann Cookie-Hinweis.
 * Konkret:
 *
 *   1. Alter noch unbeantwortet: der Server rendert die (deckende)
 *      Altersabfrage ins HTML (components/consent/), das Intro WARTET —
 *      der Startwächter (lib/intro/starter.ts) rührt die Entscheidung
 *      (lib/intro/decision.ts, setzt den «gesehen»-Marker!) erst an, wenn
 *      «adult» bestätigt ist. Es läuft also nichts im Hintergrund ab und
 *      nichts gilt als gesehen, solange der Besucher den Knopf sucht.
 *   2. Nach der Bestätigung startet das Intro aus dem Klick heraus; wer
 *      «nein» sagt, bleibt auf der Sperrseite und bekommt kein Intro.
 *   3. Der Cookie-Hinweis wartet, bis das Intro fertig oder übersprungen
 *      ist (ConsentGate.tsx fragt lib/intro/starter.ts) — er soll der
 *      Inszenierung nicht in die Quere kommen.
 *
 * Ist das Alter von einem früheren Besuch her bestätigt (Cookie, 12 Monate),
 * erscheint keine Abfrage und das Intro spielt sofort — dafür der Deckel
 * unten.
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
 *
 * NUR BEI BESTÄTIGTEM ALTER: Der Server rendert das Script ausschliesslich,
 * wenn das Alters-Cookie schon «adult» sagt — nur dann startet das Intro
 * mit dem ersten Paint. Ist das Alter offen, deckt die serverseitig
 * gerenderte Altersabfrage die Seite ab (kein Aufblitzen), und ein Deckel
 * hätte hier nichts verloren (er liegt seit der Härtung ohnehin UNTER der
 * Abfrage, z-index 400 gegen 500). Startet das Intro später
 * aus der Bestätigung heraus, setzt IntroOverlay.tsx das Attribut selbst —
 * synchron im Klick, bevor die Abfrage aus dem DOM geht.
 */
const PRE_SCRIPT =
  `(function(){try{` +
  `if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;` +
  `if(window.sessionStorage.getItem(${JSON.stringify(INTRO_SESSION_KEY)}))return;` +
  `var d=document.documentElement;d.setAttribute("data-jibbit-intro","");` +
  `window.__jibbitIntroFailsafe=window.setTimeout(function(){d.removeAttribute("data-jibbit-intro");},${INTRO_FAILSAFE_MS});` +
  `}catch(e){}})();`;

export async function HomeIntro() {
  const { age } = await readConsentCookies();
  return (
    <>
      {age === "adult" ? (
        <script dangerouslySetInnerHTML={{ __html: PRE_SCRIPT }} />
      ) : null}
      <IntroOverlay />
    </>
  );
}
