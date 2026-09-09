import styles from "./SmokeCloud.module.css";

export type SmokeState = "hidden" | "grow" | "fade" | "gone";

/**
 * >>> AUSTAUSCHSTELLE RAUCHWOLKE <<<
 *
 * Schritt 1 der Abmachung: erst die Choreografie, dann der schöne Rauch.
 * Diese Wolke ist deshalb bewusst simpel — drei wachsende Kreise plus eine
 * deckende Fläche, die garantiert den GANZEN Bildschirm füllt (Vorgabe des
 * Betreibers). Gefällt der Ablauf, ersetzt die gezeichnete Rauchgrafik
 * (z. B. aus tools/pixel-art/) NUR diese Komponente samt ihrem CSS-Modul.
 *
 * Der Vertrag mit IntroOverlay.tsx, den ein Ersatz einhalten muss:
 *
 *   state="hidden"  unsichtbar, bereit (Ausgangslage)
 *   state="grow"    wächst und füllt den Bildschirm — Dauer var(--t-smoke-grow)
 *   state="fade"    verzieht sich, gibt das Logo dahinter frei —
 *                   Dauer var(--t-logo-reveal)
 *   state="gone"    weg (display: none, kostet nichts mehr)
 *
 * Die --t-*-Variablen kommen aus lib/intro/timings.ts (via IntroOverlay).
 * Auflage fürs Handy: AUSSCHLIESSLICH transform und opacity animieren.
 */
export function SmokeCloud({ state }: { state: SmokeState }) {
  return (
    <div className={styles.smoke} data-state={state} aria-hidden="true">
      <div className={styles.puff} />
      <div className={`${styles.puff} ${styles.puffB}`} />
      <div className={`${styles.puff} ${styles.puffC}`} />
      <div className={styles.cover} />
    </div>
  );
}
