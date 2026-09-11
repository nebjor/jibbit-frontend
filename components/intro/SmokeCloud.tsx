import styles from "./SmokeCloud.module.css";

export type SmokeState = "hidden" | "grow" | "fade" | "gone";

/**
 * >>> AUSTAUSCHSTELLE RAUCHWOLKE <<<
 *
 * Der Rauch-Übergang zwischen Joint und Logo: fünf versetzte Schwaden aus
 * geschichteten Radialverläufen quellen mit eigenen Verzögerungen, Grössen
 * und Drehungen aus der Bildmitte auf, zwei helle Schlieren ziehen durch
 * den dunklen Rauch, und eine deckende Fläche (inset: 0) garantiert, dass
 * am Ende von «grow» auf JEDEM Seitenverhältnis nichts von Joint oder
 * Seite durchscheint. Details und Begründung: SmokeCloud.module.css;
 * Eigenschaften abgesichert in SmokeCloud.test.ts.
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
 * Farben nur über Tokens aus tokens.css: --c-smoke, --c-muted.
 */
export function SmokeCloud({ state }: { state: SmokeState }) {
  return (
    <div className={styles.smoke} data-state={state} aria-hidden="true">
      <div className={styles.cover} />
      <div className={styles.puff} />
      <div className={`${styles.puff} ${styles.puffB}`} />
      <div className={`${styles.puff} ${styles.puffC}`} />
      <div className={`${styles.puff} ${styles.puffD}`} />
      <div className={`${styles.puff} ${styles.puffE}`} />
      <div className={styles.wisp} />
      <div className={`${styles.wisp} ${styles.wispB}`} />
    </div>
  );
}
