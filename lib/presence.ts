/**
 * Zustandsautomat für Overlays mit Schliess-Animation («Presence»).
 *
 * Ein Overlay, das beim Schliessen einfach aus dem DOM fällt, kann keine
 * Austritts-Transition zeigen. Deshalb trennen wir zwei Fragen:
 *
 *   mounted — steht das Element im DOM?
 *   shown   — trägt es die «offen»-Styles (data-state="open")?
 *
 * Öffnen:    mounted=true (Element erscheint mit den «geschlossen»-Styles),
 *            dann `reveal` -> shown=true: der Wechsel der Styles läuft als
 *            CSS-Transition (hineinschieben).
 * Schliessen: shown=false (Transition hinaus läuft), das Element bleibt
 *            im DOM, bis `exited` kommt (transitionend bzw. Fallback-Timer)
 *            -> mounted=false.
 *
 * Reiner Reducer ohne React/DOM — so ist er in vitest (Node) testbar; der
 * Hook `usePresence` (components/usePresence.ts) verdrahtet ihn mit den
 * Effekten.
 */

export interface PresenceState {
  mounted: boolean;
  shown: boolean;
}

export type PresenceEvent =
  | { type: "open" }
  | { type: "reveal" }
  | { type: "close" }
  | { type: "exited" };

export function initialPresence(open: boolean): PresenceState {
  // Startet ein Overlay bereits offen (z. B. vom Server gerendert), wird
  // nicht animiert — es war ja nie geschlossen.
  return { mounted: open, shown: open };
}

export function presenceReducer(
  state: PresenceState,
  event: PresenceEvent,
): PresenceState {
  switch (event.type) {
    case "open":
      return state.mounted ? state : { ...state, mounted: true };
    case "reveal":
      // Nur ein eingehängtes Element kann sich zeigen.
      if (!state.mounted || state.shown) return state;
      return { ...state, shown: true };
    case "close":
      return state.shown ? { ...state, shown: false } : state;
    case "exited":
      // Ein verspätetes transitionend nach einem erneuten Öffnen darf das
      // offene Overlay nicht aushängen.
      if (state.shown || !state.mounted) return state;
      return { ...state, mounted: false };
  }
}
