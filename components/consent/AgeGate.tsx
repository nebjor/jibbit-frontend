"use client";

import { useRef } from "react";
import { MIN_AGE } from "@/lib/config";
import { useDialogFocus } from "./useDialogFocus";
import styles from "./AgeGate.module.css";

/**
 * Altersabfrage — Vollbild, VOR dem Shop.
 *
 * WARUM ES SIE GIBT (Kurzfassung; ausführlich in lib/consent/state.ts):
 * keine gesetzliche Pflicht für dieses Sortiment, aber AGB Ziffer 3
 * verspricht «Verkauf nur ab 18». Diese Abfrage setzt das eigene
 * Versprechen durch — nicht entfernen, nur weil kein Gesetz sie verlangt.
 *
 * KEIN AUFBLITZEN DES SHOPS: Ob dieses Overlay gerendert wird, entscheidet
 * der SERVER anhand des Cookies (app/layout.tsx -> ConsentGate). Beim
 * ersten Besuch steht das Overlay damit schon im ausgelieferten HTML und
 * die Fläche ist VOLLSTÄNDIG DECKEND (CSS, wirkt vor jeder Hydration) —
 * der Shop dahinter ist zu keinem Zeitpunkt sichtbar, auch nicht auf einem
 * langsamen Mobilgerät, das noch auf JavaScript wartet.
 *
 * SUCHMASCHINEN: Der Shop-Inhalt bleibt dabei normal im DOM — das Overlay
 * liegt nur darüber. Ein Crawler ohne Cookie bekommt also weiterhin die
 * vollständige Produkt-/Kategorienseite ausgeliefert, nicht «nur die
 * Altersabfrage». Deshalb ist das hier ein Overlay und KEIN Redirect auf
 * eine eigene Abfrage-Seite.
 *
 * Escape schliesst hier NICHTS: die Abfrage ist eine Bedingung, kein
 * Hinweis (useDialogFocus ohne onEscape).
 */
export function AgeGate({
  declined,
  onConfirm,
  onDecline,
  onReset,
}: {
  /** true = Besucher hat «nein» geantwortet -> ruhige Sperrseite. */
  declined: boolean;
  onConfirm: () => void;
  onDecline: () => void;
  onReset: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, dialogRef);

  return (
    <div className={styles.overlay}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-gate-title"
        aria-describedby="age-gate-text"
        tabIndex={-1}
        className={styles.card}
      >
        <p className="eyebrow">Kurz vorab</p>

        {declined ? (
          <>
            <h2 id="age-gate-title" className={styles.title}>
              Bis später
            </h2>
            {/* Ruhig und sachlich — keine Moralpredigt. */}
            <p id="age-gate-text" className={styles.text}>
              Unser Sortiment richtet sich gemäss unseren AGB an Personen ab{" "}
              {MIN_AGE} Jahren. Danke für die ehrliche Antwort — der Shop
              bleibt darum an dieser Stelle zu. Schau gern wieder vorbei,
              sobald du {MIN_AGE} bist.
            </p>
            <button type="button" className={styles.reset} onClick={onReset}>
              Falsch geklickt? Antwort ändern
            </button>
          </>
        ) : (
          <>
            <h2 id="age-gate-title" className={styles.title}>
              Bist du {MIN_AGE} oder älter?
            </h2>
            <p id="age-gate-text" className={styles.text}>
              Wir verkaufen Raucherzubehör — und gemäss unseren AGB nur an
              Personen ab {MIN_AGE} Jahren. Bitte bestätige kurz dein Alter.
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.confirm}
                onClick={onConfirm}
              >
                Ja, ich bin {MIN_AGE} oder älter
              </button>
              <button
                type="button"
                className={styles.decline}
                onClick={onDecline}
              >
                Nein, noch nicht
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
