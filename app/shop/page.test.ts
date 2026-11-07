import { describe, expect, it, vi } from "vitest";

/**
 * /shop läuft nicht ins Leere: die Adresse ist draussen verlinkt
 * (Suchmaschinen, gespeicherte Links) und leitet deshalb DAUERHAFT auf
 * die Startseite um, die jetzt den Katalog trägt. Der Query-String zieht
 * vollständig mit, damit alte Kategorielinks — auch mit Sonderzeichen im
 * Handle — weiter auf der gefilterten Ansicht landen.
 */

class RedirectSignal extends Error {
  constructor(public readonly to: string) {
    super(`redirect:${to}`);
  }
}

vi.mock("next/navigation", () => ({
  permanentRedirect: (to: string) => {
    throw new RedirectSignal(to);
  },
}));

const { default: ShopRedirect } = await import("./page");

function target(params: { [key: string]: string | string[] | undefined }) {
  return ShopRedirect({ searchParams: Promise.resolve(params) }).then(
    () => {
      throw new Error("keine Umleitung ausgelöst");
    },
    (e: unknown) => (e as RedirectSignal).to,
  );
}

describe("/shop — dauerhafte Umleitung auf die Startseite", () => {
  it("leitet ohne Parameter auf die Startseite", async () => {
    expect(await target({})).toBe("/");
  });

  it("leitet eine Kategorie gleich auf ihre Kategorieseite", async () => {
    expect(await target({ kategorie: "papers" })).toBe("/kategorie/papers");
  });

  it("kodiert Sonderzeichen im Handle", async () => {
    const to = await target({ kategorie: "filter-&-tips" });
    expect(to).toBe("/kategorie/filter-%26-tips");
  });

  it("nimmt auch übrige Parameter vollständig mit", async () => {
    const to = await target({ kategorie: "papers", ref: "newsletter" });
    expect(to).toBe("/kategorie/papers?ref=newsletter");
  });
});
