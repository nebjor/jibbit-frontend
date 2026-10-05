"use client";

import { useRef } from "react";
import Link from "next/link";
import { useDialogFocus } from "./useDialogFocus";
import styles from "./ConsentBanner.module.css";

/**
 * Cookie-Hinweis mit echter Wahl.
 *
 * ABLEHNEN IST GENAU SO LEICHT WIE ANNEHMEN: beide Knöpfe stehen
 * nebeneinander, gleich gross, gleich gestaltet — kein verstecktes
 * «Einstellungen»-Labyrinth, keine drei Klicks bis zum Nein. Ein Banner,
 * bei dem nur «Alle annehmen» prominent ist, wäre in der EU angreifbar
 * (Stichwort Dark Pattern) und hier schlicht unehrlich.
 *
 * Escape und Klick auf den Scrim schliessen OHNE Entscheidung: es wird
 * kein Cookie geschrieben, Analyse bleibt aus (keine Einwilligung = nein),
 * und der Hinweis kommt beim nächsten vollen Seitenaufruf wieder. So kann
 * man z. B. erst die Datenschutzerklärung lesen, ohne zu einer Wahl
 * gezwungen zu sein.
 *
 * Im Modus «settings» (Footer-Link «Cookie-Einstellungen») zeigt derselbe
 * Dialog zusätzlich die aktuell gespeicherte Wahl — das ist der Widerruf:
 * «Nur notwendige» überschreibt eine früher erteilte Einwilligung sofort.
 */
export function ConsentBanner({
  mode,
  currentAnalytics,
  onAcceptAll,
  onNecessaryOnly,
  onClose,
}: {
  mode: "initial" | "settings";
  /** Nur im Settings-Modus relevant: aktuell gespeicherte Wahl (null = keine). */
  currentAnalytics: boolean | null;
  onAcceptAll: () => void;
  onNecessaryOnly: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, dialogRef, onClose);

  return (
    <div className={styles.overlay}>
      <button
        type="button"
        className={styles.scrim}
        onClick={onClose}
        aria-label="Ohne Entscheidung schliessen"
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        aria-describedby="consent-text"
        tabIndex={-1}
        className={styles.sheet}
      >
        <div className={styles.head}>
          <h2 id="consent-title" className={styles.title}>
            {mode === "settings" ? "Cookie-Einstellungen" : "Cookies"}
          </h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Ohne Entscheidung schliessen"
          >
            &times;
          </button>
        </div>

        <p id="consent-text" className={styles.text}>
          Zwingend notwendige Cookies (Warenkorb, Anmeldung) laufen immer.
          Analyse-Cookies helfen uns zu verstehen, wie der Shop genutzt wird,
          und erlauben nach einer Bestellung die Einladung zur Google-Bewertung
          — sie laufen nur, wenn du zustimmst. Deine Wahl kannst du jederzeit
          über «Cookie-Einstellungen» im Footer ändern.{" "}
          <Link
            href="/datenschutz"
            className={styles.more}
            /* Navigieren heisst: erst lesen, noch nicht entscheiden. Der
               Dialog geht zu, damit die Seite lesbar ist; gespeichert wird
               nichts. */
            onClick={onClose}
          >
            Details in der Datenschutzerklärung
          </Link>
        </p>

        {mode === "settings" && (
          <p className={styles.current} aria-live="polite">
            {currentAnalytics === null
              ? "Du hast noch keine Wahl getroffen — Analyse ist aus."
              : currentAnalytics
                ? "Aktuell erlaubt: Analyse läuft."
                : "Aktuell gespeichert: nur notwendige — Analyse ist aus."}
          </p>
        )}

        {/* Gleichrangige Knöpfe: gleiche Grösse, gleiche Gestaltung. */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.choice}
            onClick={onNecessaryOnly}
          >
            Nur notwendige
          </button>
          <button type="button" className={styles.choice} onClick={onAcceptAll}>
            Alle akzeptieren
          </button>
        </div>
      </div>
    </div>
  );
}
