"use client";

import { useEffect, useRef, useState } from "react";
import { restMillisekunden, type Aktion } from "@/lib/aktionen";

/** Obergrenze für setTimeout (32-Bit-Millisekunden). */
const MAX_TIMEOUT = 2_147_000_000;

/**
 * Die Uhrzeit des Besuchers für den Countdown von Banner und Hero.
 *
 * `null` bis zum Mounten: der Server weiss nicht, wie spät es beim Besucher
 * ist, also stimmen Server- und Client-HTML nur ohne Restzeit überein.
 * Danach minütlich, und genau zum Ende der Aktion nochmals — sonst bliebe
 * der Block bis zu 59 s über das Ende hinaus stehen.
 *
 * `beimStart` läuft einmal nach dem Mounten (z. B. «weggeklickt» lesen).
 */
export function useAktionJetzt(aktion: Aktion, beimStart?: () => void): number | null {
  const [jetzt, setJetzt] = useState<number | null>(null);
  const start = useRef(beimStart);

  useEffect(() => {
    // Im Callback statt im Effekt-Körper — kein synchrones setState im Effekt.
    const t0 = window.setTimeout(() => {
      start.current?.();
      setJetzt(Date.now());
    }, 0);
    const takt = window.setInterval(() => setJetzt(Date.now()), 60_000);
    const rest = restMillisekunden(aktion.giltBis, Date.now());
    const ende =
      rest === null
        ? undefined
        : window.setTimeout(() => setJetzt(Date.now()), Math.min(rest, MAX_TIMEOUT));
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(takt);
      if (ende !== undefined) window.clearTimeout(ende);
    };
  }, [aktion]);

  return jetzt;
}
