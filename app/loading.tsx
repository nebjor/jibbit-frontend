import { PixelJoint } from "@/components/PixelJoint";
import styles from "./loading.module.css";

/**
 * Routen-Ladezustand für die ganze App (Next-Konvention: loading.tsx wird zur
 * Suspense-Fallback-UI jeder Navigation unterhalb des Root-Layouts, solange
 * ein Segment kein eigenes definiert). Kopf und Fusszeile stehen im Layout
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
