/**
 * Scroll-Sperre für Overlays (Warenkorb-Schublade, Suchschicht, Cookie-
 * Dialoge) — OHNE Layout-Shift.
 *
 * DAS PROBLEM: `body { overflow: hidden }` allein lässt auf Desktop-Browsern
 * mit klassischer Scrollleiste (Windows, Linux, macOS mit «immer anzeigen»)
 * die Leiste verschwinden. Der Viewport wird dadurch ~15 px breiter, der
 * zentrierte Seiteninhalt rückt um die halbe Leistenbreite nach rechts —
 * die ganze Seite «zuckt» hinter der Schublade, einmal beim Öffnen und
 * einmal beim Schliessen (gemessen: 15 px Leistenbreite, Logo 96.5 -> 104 px,
 * zwei Layout-Shift-Einträge pro Öffnen/Schliessen).
 *
 * DIE LÖSUNG: beim Sperren die Leistenbreite messen (innerWidth minus
 * clientWidth des Wurzelelements) und dem body als `padding-right` geben.
 * Der Inhaltsbereich bleibt damit exakt gleich breit, nichts bewegt sich.
 * Auf Handys und bei Overlay-Scrollleisten ist die Breite 0 — dort passiert
 * schlicht nichts. Die gemessene Breite steht zusätzlich als CSS-Variable
 * `--scroll-lock-gap` auf dem Wurzelelement, falls ein `position: fixed`-
 * Element am rechten Rand sie ebenfalls ausgleichen muss.
 *
 * REFERENZZÄHLUNG: Zwei Overlays können gleichzeitig sperren (z. B.
 * Cookie-Einstellungen über der Schublade). Erst die ERSTE Sperre schreibt
 * die Styles, erst die LETZTE Freigabe stellt die vorherigen wieder her —
 * so kann ein Overlay dem anderen die Sperre nicht unter den Füssen
 * wegziehen. Jede Freigabe wirkt genau einmal (idempotent).
 *
 * Die DOM-Zugriffe laufen über eine kleine Schnittstelle, damit die Logik
 * in vitest (Node, kein DOM) testbar ist; `browserScrollLockTarget` ist der
 * Adapter für den echten Browser.
 */

export interface ScrollLockTarget {
  /** Breite des Fensters INKLUSIVE Scrollleiste (`window.innerWidth`). */
  innerWidth(): number;
  /** Breite des Wurzelelements OHNE Scrollleiste (`documentElement.clientWidth`). */
  clientWidth(): number;
  /** Inline-Styles des `body`. */
  body: {
    overflow: string;
    paddingRight: string;
  };
  /** Custom Property auf dem Wurzelelement setzen/entfernen. */
  setRootProperty(name: string, value: string): void;
  removeRootProperty(name: string): void;
}

/** Name der CSS-Variable mit der ausgeglichenen Scrollleistenbreite. */
export const SCROLL_LOCK_GAP_PROPERTY = "--scroll-lock-gap";

export interface ScrollLock {
  /** Sperrt; die zurückgegebene Funktion gibt (einmalig) wieder frei. */
  lock(target: ScrollLockTarget): () => void;
  /** Anzahl aktiver Sperren — für Tests. */
  depth(): number;
}

/**
 * Baut eine unabhängige Sperre mit eigener Referenzzählung. Die App nutzt
 * die eine Instanz `scrollLock` unten; Tests bauen sich frische.
 */
export function createScrollLock(): ScrollLock {
  let depth = 0;
  let previous: { overflow: string; paddingRight: string } | null = null;

  return {
    depth: () => depth,
    lock(target) {
      if (depth === 0) {
        previous = {
          overflow: target.body.overflow,
          paddingRight: target.body.paddingRight,
        };
        // Vor dem Verstecken messen: danach ist die Leiste weg und die
        // Differenz 0.
        const gap = Math.max(0, target.innerWidth() - target.clientWidth());
        target.body.overflow = "hidden";
        if (gap > 0) target.body.paddingRight = `${gap}px`;
        target.setRootProperty(SCROLL_LOCK_GAP_PROPERTY, `${gap}px`);
      }
      depth += 1;

      let released = false;
      return () => {
        if (released) return;
        released = true;
        depth -= 1;
        if (depth > 0 || !previous) return;
        target.body.overflow = previous.overflow;
        target.body.paddingRight = previous.paddingRight;
        target.removeRootProperty(SCROLL_LOCK_GAP_PROPERTY);
        previous = null;
      };
    },
  };
}

/** Adapter auf `window`/`document` — nur im Browser aufrufen. */
export function browserScrollLockTarget(): ScrollLockTarget {
  const root = document.documentElement;
  return {
    innerWidth: () => window.innerWidth,
    clientWidth: () => root.clientWidth,
    body: document.body.style,
    setRootProperty: (name, value) => root.style.setProperty(name, value),
    removeRootProperty: (name) => root.style.removeProperty(name),
  };
}

/** Die eine Sperre der App — alle Overlays teilen sich diese Zählung. */
export const scrollLock = createScrollLock();
