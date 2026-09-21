import { PixelJoint } from "@/components/PixelJoint";
import styles from "./PageLoading.module.css";

/**
 * Ladezustand: loading.tsx in checkout/, konto/ und suche/, auf Startseite und
 * Produktseite als Suspense-Fallback INNERHALB der Seite. Bewusst kein
 * Root-loading.tsx: eine Grenze über der ganzen Seite liesse Next 200 senden,
 * bevor notFound() ein 404 setzen kann. Kopf und Fusszeile stehen im Layout
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
export function PageLoading() {
  return (
    <div className={`page ${styles.wrap}`} role="status">
      <div className={styles.reveal}>
        <PixelJoint variant="loading" px={3} />
        <p className={styles.text}>Lädt&hellip;</p>
      </div>
    </div>
  );
}
