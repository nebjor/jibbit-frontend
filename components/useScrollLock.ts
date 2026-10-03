"use client";

import { useEffect } from "react";
import { browserScrollLockTarget, scrollLock } from "@/lib/scroll-lock";

/**
 * Sperrt das Scrollen der Seite, solange `active` — ohne dass der Inhalt
 * springt (Scrollleistenbreite wird ausgeglichen, siehe lib/scroll-lock.ts).
 * Alle Overlays nutzen DIESEN Hook, nicht eigene `overflow: hidden`-Effekte:
 * nur so zählt die gemeinsame Sperre richtig, wenn zwei gleichzeitig offen sind.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return scrollLock.lock(browserScrollLockTarget());
  }, [active]);
}
