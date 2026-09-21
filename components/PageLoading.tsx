import { PixelJoint } from "@/components/PixelJoint";
import styles from "./PageLoading.module.css";

/**
 * Routen-Ladezustand, eingehängt als loading.tsx in checkout/, konto/ und
 * suche/. Bewusst NICHT im Root: eine Suspense-Grenze über Startseite und
 * Produktseite liesse Next 200 senden, bevor notFound() ein 404 setzen kann.
 * Kopf und Fusszeile stehen im Layout
 * und bleiben sichtbar — es „lädt" also erkennbar die Seite, nicht der Shop.
 *
 * EIN Joint, mittig, mehr nicht. Und auch der erst nach `--loader-delay`
 * (app/tokens.css): Navigationen mit vorausgeladenem Segment oder
 * Mock-Fallback sind in wenigen hundert Millisekunden durch, da wäre jede
 * Animation nur ein Aufblitzen. Die Verzögerung liegt als reines CSS auf dem
 * Wrapper (animation-delay auf einer opacity-Rampe) — sie braucht kein JS
 * und hält deshalb auch, während der Haupt-Thread rendert.
 *
 * BARRIEREFREIHEIT: `role="status"` meldet den Zustand assistiven
 * Technologien, der Text trägt die Information, der Joint ist dekorativ
 * (aria-hidden in PixelJoint). Bei `prefers-reduced-motion` steht das Sprite
 * auf seinem ersten Bild (PixelJoint.module.css).
 */
export default function Loading() {
  return (
    <div className={`page ${styles.wrap}`} role="status">
      <div className={styles.reveal}>
        <PixelJoint variant="loading" px={3} />
        <p className={styles.text}>Lädt&hellip;</p>
      </div>
    </div>
  );
}
