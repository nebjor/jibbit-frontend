"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Fokusfalle für die Einwilligungs-Dialoge.
 *
 * Solange `active`, bleibt der Tastaturfokus IM Dialog (Tab zykelt), beim
 * Aktivieren springt er hinein, beim Deaktivieren zurück auf das Element,
 * das ihn vorher hatte (z. B. den Footer-Link «Cookie-Einstellungen»).
 *
 * `onEscape` ist bewusst optional: Der Cookie-Hinweis lässt sich mit Escape
 * ohne Entscheidung schliessen (keine Entscheidung = keine Analyse) — die
 * ALTERSABFRAGE übergibt KEIN `onEscape`, denn sie ist eine Bedingung, kein
 * Hinweis: sie geht erst nach einer Antwort weg.
 */
export function useDialogFocus(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onEscape?: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Erst den Dialog selbst fokussieren (er trägt tabIndex={-1}), damit
    // Screenreader Titel + Beschreibung vorlesen, bevor Tab die Knöpfe
    // erreicht.
    container.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (onEscape) {
          e.preventDefault();
          onEscape();
        }
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (e.shiftKey) {
        if (current === first || current === container) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last) {
        e.preventDefault();
        first.focus();
      } else if (current instanceof Node && !container.contains(current)) {
        // Fokus ist (z. B. per Maus) entwischt — zurückholen.
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previous && previous.isConnected) previous.focus();
    };
  }, [active, containerRef, onEscape]);
}
