"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  bannerUeberschrift,
  dismissKey,
  formatRestzeit,
  restMillisekunden,
  type Aktion,
} from "@/lib/aktionen";
import { useAktionJetzt } from "./useAktionJetzt";
import styles from "./AktionsBanner.module.css";

function istWeggeklickt(a: Aktion): boolean {
  try {
    return window.sessionStorage.getItem(dismissKey(a)) === "1";
  } catch {
    // Storage gesperrt (private Fenster, Richtlinien): Banner bleibt sichtbar.
    return false;
  }
}

function merkeWeggeklickt(a: Aktion) {
  try {
    window.sessionStorage.setItem(dismissKey(a), "1");
  } catch {
    // Dann kommt er beim nächsten Seitenaufruf wieder — kein Drama.
  }
}

/**
 * Aktionsbanner: ganze Breite, Markenrot. Die Aktion kommt vom Server
 * (lib/data.ts → getAktionen); hier läuft nur der Countdown.
 *
 * HYDRATION: Der Server weiss nicht, wie spät es beim Besucher ist. Er
 * liefert deshalb die Unterzeile OHNE Restzeit; sie kommt erst nach dem
 * Mounten dazu — so stimmen Server- und Client-HTML überein, und der
 * Banner steht trotzdem schon im ersten Bild.
 *
 * Ausgeblendet wird er (a) vom Besucher, gemerkt je Browser-Sitzung, und
 * (b) von selbst, sobald `giltBis` erreicht ist.
 */
export function AktionsBanner({
  aktion,
  ausserStartseite = false,
}: {
  aktion: Aktion;
  /** true: auf der Startseite (ohne Kategorie) steht der Hero statt des Banners. */
  ausserStartseite?: boolean;
}) {
  const [weg, setWeg] = useState(false);
  const jetzt = useAktionJetzt(aktion, () => setWeg(istWeggeklickt(aktion)));
  const pathname = usePathname();
  const suche = useSearchParams();
  const heroSteht = ausserStartseite && pathname === "/" && !suche.get("kategorie");

  const rest = jetzt === null ? null : restMillisekunden(aktion.giltBis, jetzt);
  const abgelaufen = jetzt !== null && aktion.giltBis !== null && rest === null;
  if (weg || abgelaufen || heroSteht) return null;

  return (
    <section className={styles.banner} role="region" aria-label="Aktion">
      <div className={`page ${styles.inner}`}>
        <p className={styles.headline}>{bannerUeberschrift(aktion)}</p>
        <p className={styles.sub}>
          Zusätzlich zu den Mengenrabatten · Wird an der Kasse automatisch abgezogen
          {rest !== null && (
            <>
              {" "}
              &middot;{" "}
              <span className="tnum" data-testid="aktion-restzeit">
                noch {formatRestzeit(rest)}
              </span>
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        className={styles.close}
        aria-label="Aktionshinweis schliessen"
        onClick={() => {
          merkeWeggeklickt(aktion);
          setWeg(true);
        }}
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </section>
  );
}
