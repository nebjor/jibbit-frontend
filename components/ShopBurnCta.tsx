"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PixelJoint } from "./PixelJoint";
import {
  BURN_TOTAL_MS,
  decideBurnClick,
  hasBurnPlayed,
  markBurnPlayed,
  safeSessionStorage,
} from "@/lib/burn-cta";
import styles from "./ShopBurnCta.module.css";

/**
 * «ZUM SHOP» MIT VERBRENN-ANIMATION.
 *
 * Beim ersten Klick der Sitzung faltet sich der Knopf längs wie ein Paper
 * (der Knick), rollt sich ein, wird angezündet und verbrennt — dabei wächst
 * das Ganze — und erst dann geht es in den Shop. Zeiten und Regeln:
 * lib/burn-cta.ts. Optik: ShopBurnCta.module.css. Die Brennphase ist der
 * vorhandene Pixel-Joint (components/PixelJoint.tsx) — nichts neu erfunden.
 *
 * DER KNOPF BLEIBT EIN ECHTER LINK. Das <Link href="/shop"> steht immer im
 * DOM; die Animation ist eine dekorative Schicht darüber (aria-hidden,
 * pointer-events: none). Ohne JavaScript rendert der Server denselben
 * Anker und die Navigation funktioniert ganz gewöhnlich — die Zierde darf
 * nie der Weg zum Umsatz sein. Während der Animation wird der Link nur
 * durchsichtig (opacity), nicht entfernt: er behält Fokus und Namen, ein
 * Screenreader merkt von alledem nichts.
 *
 * Übersprungen wird die Animation (= sofortige Standard-Navigation) bei
 * `prefers-reduced-motion`, wenn sie in dieser Sitzung schon lief, wenn
 * eine Einblendung (Altersabfrage/Cookie-Hinweis/Warenkorb, role="dialog")
 * vorne liegt, und bei Modifikator-Klicks.
 */
export function ShopBurnCta({
  href = "/shop",
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [burning, setBurning] = useState(false);
  /** Ref statt State: der Doppelklick-Schutz darf nicht am Render hängen. */
  const runningRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  // Beim Abbau (z. B. Navigation über einen anderen Weg) den Timer räumen,
  // sonst feuert ein push auf einer Seite, die längst eine andere ist.
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    const memory = safeSessionStorage();
    const action = decideBurnClick({
      running: runningRef.current,
      modifiedClick:
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey,
      // Kein matchMedia => keine Animation. Im Zweifel navigieren.
      reducedMotion:
        typeof window.matchMedia !== "function" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      alreadyPlayed: hasBurnPlayed(memory),
      overlayOpen: document.querySelector('[role="dialog"]') !== null,
    });

    if (action === "navigate") return; // der Link navigiert selbst, sofort
    e.preventDefault();
    if (action === "ignore") return; // läuft schon, Weiterleitung kommt

    // action === "animate"
    runningRef.current = true;
    markBurnPlayed(memory);
    // Vorladen, WÄHREND es brennt — sonst folgt auf eine schöne Sekunde
    // eine weisse Wartezeit. (Der Link selbst prefetcht im Viewport auch,
    // aber darauf verlassen wir uns nicht.)
    router.prefetch(href);
    setBurning(true);
    timerRef.current = window.setTimeout(() => {
      router.push(href);
    }, BURN_TOTAL_MS);
  }

  return (
    <span className={styles.scene}>
      <Link
        href={href}
        className={[className, burning ? styles.linkBurning : undefined]
          .filter(Boolean)
          .join(" ")}
        onClick={onClick}
      >
        {children}
      </Link>
      {burning && (
        <span className={styles.stage} aria-hidden="true">
          {/* Das «Paper»: zwei Hälften des Knopfs, die obere klappt um. */}
          <span className={styles.sheet}>
            <span className={styles.foldTop}>
              <span className={styles.frontClip}>
                <span className={`${className ?? ""} ${styles.face}`}>
                  {children}
                </span>
              </span>
              <span className={styles.paperBack} />
            </span>
            <span className={styles.halfBottom}>
              <span className={`${className ?? ""} ${styles.faceBottom}`}>
                {children}
              </span>
            </span>
          </span>
          {/* Angezündet: der vorhandene Brenn-Sprite, wachsend. */}
          <span className={styles.jointWrap}>
            <PixelJoint variant="loading" px={2} />
          </span>
        </span>
      )}
    </span>
  );
}
