"use client";

import {
  useEffect,
  useReducer,
  type RefObject,
  type TransitionEvent,
} from "react";
import { initialPresence, presenceReducer } from "@/lib/presence";

/** Reserve über der längsten Austritts-Transition, falls kein transitionend kommt. */
const EXIT_FALLBACK_MS = 400;

export interface Presence {
  /** Element rendern? (true auch WÄHREND der Schliess-Animation) */
  mounted: boolean;
  /** Wert für `data-state` — die CSS-Transitionen hängen daran. */
  state: "open" | "closed";
  /** Auf das animierte Element legen: beendet den Austritt, sobald die Transition durch ist. */
  onTransitionEnd: (e: TransitionEvent<HTMLElement>) => void;
  /** Austritt sofort beenden (z. B. bei Seitenwechsel: keine Animation mehr nötig). Wirkt nur im geschlossenen Zustand. */
  finish: () => void;
}

/**
 * Hält ein Overlay während seiner Schliess-Transition im DOM (Automat:
 * lib/presence.ts).
 *
 * `ref` zeigt auf das animierte Element. Beim Öffnen wird es zuerst mit den
 * «geschlossen»-Styles eingehängt; der Hook erzwingt dann über
 * `getBoundingClientRect()` einen Style-/Layout-Durchlauf, BEVOR er auf
 * «open» schaltet. Ohne diesen Schritt sähe der Browser nur den Endzustand
 * und würde keine Transition abspielen (React rendert beide Zustände
 * sonst innerhalb desselben Frames).
 *
 * Austritt: `transitionend` auf dem Element selbst (nicht von Kindern
 * hochgeblubbert) hängt es aus; ein Fallback-Timer deckt den Fall ab, dass
 * keine Transition läuft (ältere Browser, abgeschaltete Animationen).
 * `prefers-reduced-motion` braucht hier nichts Eigenes: globals.css kürzt
 * jede Transition auf 0.01 ms, `transitionend` kommt dann sofort.
 */
export function usePresence(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
): Presence {
  const [state, dispatch] = useReducer(
    presenceReducer,
    open,
    initialPresence,
  );

  useEffect(() => {
    dispatch({ type: open ? "open" : "close" });
  }, [open]);

  // Zeigen erst NACH dem Einhängen — mit erzwungenem Ausgangs-Layout.
  useEffect(() => {
    if (!open || !state.mounted || state.shown) return;
    ref.current?.getBoundingClientRect();
    dispatch({ type: "reveal" });
  }, [open, state.mounted, state.shown, ref]);

  useEffect(() => {
    if (open || !state.mounted) return;
    const t = setTimeout(() => dispatch({ type: "exited" }), EXIT_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [open, state.mounted]);

  return {
    finish: () => {
      if (!open) dispatch({ type: "exited" });
    },
    mounted: state.mounted,
    state: state.shown ? "open" : "closed",
    onTransitionEnd: (e) => {
      if (e.target !== e.currentTarget || open) return;
      dispatch({ type: "exited" });
    },
  };
}
