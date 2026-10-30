"use client";

import { useEffect, useState } from "react";
import {
  bannerUeberschrift,
  dismissKey,
  formatRestzeit,
  restMillisekunden,
  type Aktion,
} from "@/lib/aktionen";
import styles from "./AktionsBanner.module.css";

/** Obergrenze für setTimeout (32-Bit-Millisekunden). */
const MAX_TIMEOUT = 2_147_000_000;

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
export function AktionsBanner({ aktion }: { aktion: Aktion }) {
  const [jetzt, setJetzt] = useState<number | null>(null);
  const [weg, setWeg] = useState(false);

  useEffect(() => {
    // Erst nach dem Mounten lesen (Hydration), und im Callback statt im
    // Effekt-Körper — kein synchrones setState im Effekt.
    const start = window.setTimeout(() => {
      setWeg(istWeggeklickt(aktion));
      setJetzt(Date.now());
    }, 0);

    // Minütlich aktualisieren, und genau zum Ende nochmals — sonst bliebe
    // der Banner bis zu 59 s über das Ende hinaus stehen.
    const takt = window.setInterval(() => setJetzt(Date.now()), 60_000);
    const rest = restMillisekunden(aktion.giltBis, Date.now());
    const ende =
      rest === null
        ? undefined
        : window.setTimeout(() => setJetzt(Date.now()), Math.min(rest, MAX_TIMEOUT));
    return () => {
      window.clearTimeout(start);
      window.clearInterval(takt);
      if (ende !== undefined) window.clearTimeout(ende);
    };
  }, [aktion]);

  const rest = jetzt === null ? null : restMillisekunden(aktion.giltBis, jetzt);
  const abgelaufen = jetzt !== null && aktion.giltBis !== null && rest === null;
  if (weg || abgelaufen) return null;

  return (
    <section className={styles.banner} role="region" aria-label="Aktion">
      <div className={`page ${styles.inner}`}>
        <p className={styles.headline}>{bannerUeberschrift(aktion)}</p>
        <p className={styles.sub}>
          Wird an der Kasse automatisch abgezogen
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
