import { describe, expect, it } from "vitest";
import {
  initialPresence,
  presenceReducer,
  type PresenceEvent,
  type PresenceState,
} from "./presence";

function run(start: PresenceState, ...events: PresenceEvent["type"][]) {
  return events.reduce(
    (s, type) => presenceReducer(s, { type } as PresenceEvent),
    start,
  );
}

describe("presenceReducer", () => {
  it("startet geschlossen ohne Element im DOM", () => {
    expect(initialPresence(false)).toEqual({ mounted: false, shown: false });
  });

  it("ein bereits offenes Overlay wird ohne Animation gezeigt", () => {
    expect(initialPresence(true)).toEqual({ mounted: true, shown: true });
  });

  it("öffnet in zwei Schritten: erst eingehängt (closed-Styles), dann gezeigt", () => {
    const mounted = run(initialPresence(false), "open");
    expect(mounted).toEqual({ mounted: true, shown: false });
    expect(run(mounted, "reveal")).toEqual({ mounted: true, shown: true });
  });

  it("zeigt nichts, was nicht eingehängt ist", () => {
    expect(run(initialPresence(false), "reveal")).toEqual(initialPresence(false));
  });

  it("bleibt beim Schliessen im DOM, bis die Transition durch ist", () => {
    const closing = run(initialPresence(true), "close");
    expect(closing).toEqual({ mounted: true, shown: false });
    expect(run(closing, "exited")).toEqual({ mounted: false, shown: false });
  });

  it("ein verspätetes transitionend hängt ein wieder geöffnetes Overlay nicht aus", () => {
    const reopened = run(initialPresence(true), "close", "open", "reveal");
    expect(reopened).toEqual({ mounted: true, shown: true });
    expect(run(reopened, "exited")).toBe(reopened);
  });

  it("gibt bei wirkungslosen Ereignissen dasselbe Objekt zurück (kein Re-Render)", () => {
    const open = initialPresence(true);
    expect(run(open, "open")).toBe(open);
    expect(run(open, "reveal")).toBe(open);
    const closed = initialPresence(false);
    expect(run(closed, "close")).toBe(closed);
    expect(run(closed, "exited")).toBe(closed);
  });
});
