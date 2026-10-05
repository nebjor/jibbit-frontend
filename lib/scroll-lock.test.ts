import { describe, expect, it } from "vitest";
import {
  createScrollLock,
  SCROLL_LOCK_GAP_PROPERTY,
  type ScrollLockTarget,
} from "./scroll-lock";

/**
 * Nachbau eines Desktop-Browsers mit klassischer Scrollleiste: solange der
 * body nicht `overflow: hidden` trägt, ist das Wurzelelement um die
 * Leistenbreite schmaler als das Fenster — genau die Differenz, die beim
 * Sperren ausgeglichen werden muss.
 */
function fakeTarget(scrollbar: number) {
  const root = new Map<string, string>();
  const target: ScrollLockTarget & { root: Map<string, string> } = {
    root,
    innerWidth: () => 1440,
    clientWidth: () =>
      target.body.overflow === "hidden" ? 1440 : 1440 - scrollbar,
    body: { overflow: "", paddingRight: "" },
    setRootProperty: (name, value) => root.set(name, value),
    removeRootProperty: (name) => root.delete(name),
  };
  return target;
}

describe("scrollLock", () => {
  it("gleicht die Scrollleistenbreite als padding-right aus (kein Layout-Shift)", () => {
    const target = fakeTarget(15);
    const release = createScrollLock().lock(target);

    expect(target.body.overflow).toBe("hidden");
    expect(target.body.paddingRight).toBe("15px");
    expect(target.root.get(SCROLL_LOCK_GAP_PROPERTY)).toBe("15px");

    release();
    expect(target.body.overflow).toBe("");
    expect(target.body.paddingRight).toBe("");
    expect(target.root.has(SCROLL_LOCK_GAP_PROPERTY)).toBe(false);
  });

  it("setzt bei Overlay-Scrollleisten (Handy) kein padding", () => {
    const target = fakeTarget(0);
    const release = createScrollLock().lock(target);
    expect(target.body.overflow).toBe("hidden");
    expect(target.body.paddingRight).toBe("");
    expect(target.root.get(SCROLL_LOCK_GAP_PROPERTY)).toBe("0px");
    release();
  });

  it("stellt vorhandene Inline-Styles wieder her", () => {
    const target = fakeTarget(15);
    target.body.overflow = "auto";
    target.body.paddingRight = "3px";
    const release = createScrollLock().lock(target);
    expect(target.body.paddingRight).toBe("15px");
    release();
    expect(target.body.overflow).toBe("auto");
    expect(target.body.paddingRight).toBe("3px");
  });

  it("zählt überlappende Sperren: erst die letzte Freigabe gibt frei", () => {
    const target = fakeTarget(15);
    const lock = createScrollLock();
    const releaseA = lock.lock(target);
    // Zweite Sperre misst NICHT neu (die Leiste ist schon weg) und darf das
    // padding nicht auf 0 setzen.
    const releaseB = lock.lock(target);
    expect(lock.depth()).toBe(2);
    expect(target.body.paddingRight).toBe("15px");

    releaseA();
    expect(lock.depth()).toBe(1);
    expect(target.body.overflow).toBe("hidden");
    expect(target.body.paddingRight).toBe("15px");

    releaseB();
    expect(lock.depth()).toBe(0);
    expect(target.body.overflow).toBe("");
    expect(target.body.paddingRight).toBe("");
  });

  it("eine Freigabe wirkt nur einmal", () => {
    const target = fakeTarget(15);
    const lock = createScrollLock();
    const releaseA = lock.lock(target);
    lock.lock(target);
    releaseA();
    releaseA();
    expect(lock.depth()).toBe(1);
    expect(target.body.overflow).toBe("hidden");
  });
});
