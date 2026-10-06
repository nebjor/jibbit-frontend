import { STORE } from "@/lib/config";

/**
 * Google Kundenrezensionen — das STORE WIDGET (ehemals «Badge»), reine
 * Entscheidungslogik ohne DOM, damit sie in Node testbar ist
 * (badge.test.ts). Die Einbindung selbst: components/GoogleKundenrezensionenBadge.tsx.
 *
 * Googles aktueller Snippet (support.google.com/merchants/answer/7105655,
 * abgerufen 2026-10-05) lädt `https://www.gstatic.com/shopping/merchant/merchantwidget.js`
 * und ruft nach dem Laden `merchantwidget.start({ position })`. Das ältere
 * `platform.js?onload=renderBadge` / `gapi.ratingbadge` ist laut derselben
 * Seite abgelöst und soll entfernt werden — darum wird hier NICHT
 * platform.js geladen, und es gibt keinen Konflikt mit dem Opt-in-Modul
 * (GoogleKundenrezensionen.tsx), das platform.js weiterhin braucht.
 *
 * Das Widget kennt keine Merchant-ID im Code: Google ordnet die Seite über
 * die im Merchant Center beanspruchte Domain zu. Die Merchant-ID bleibt
 * trotzdem ein Wächter — fehlt sie, ist das Programm nicht eingerichtet.
 */

/** Googles Skript-URL, einmalig definiert; Tests prüfen dagegen. */
export const MERCHANT_WIDGET_SRC =
  "https://www.gstatic.com/shopping/merchant/merchantwidget.js";

/**
 * Position und Abstände für `merchantwidget.start`.
 *
 * LEFT_BOTTOM statt Googles Vorgabe RIGHT_BOTTOM: rechts unten liegen bei
 * jibbit der Warenkorb-Button (Kopfleiste rechts, Schublade von rechts) und
 * mobil die Kaufleiste. Auf dem Handy zentriert Google das Widget am unteren
 * Rand; `mobileBottomMargin` 88 hebt es über die fixe Kaufleiste der
 * Produktseite (AddToCart.module.css `.bar`: zwei mal 12 px Polster plus
 * 44-px-Knopf plus Safe-Area) — Google: «Don't obscure the widget with any
 * other content on your pages.»
 */
export const MERCHANT_WIDGET_OPTIONS = {
  position: "LEFT_BOTTOM",
  sideMargin: 24,
  bottomMargin: 24,
  mobileSideMargin: 16,
  mobileBottomMargin: 88,
} as const;

/**
 * Laufzeitschalter `GOOGLE_KUNDENREZENSIONEN_BADGE`: nur "1" oder "true"
 * (Gross-/Kleinschreibung, Leerraum egal) schalten ein. Alles andere — leer,
 * "0", "ja", Tippfehler — bleibt AUS, denn das Widget zeigt ohne genügend
 * Rezensionen nur «Bewertung nicht verfügbar», und das wäre Werbung gegen
 * sich selbst.
 */
export function parseBadgeSwitch(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true";
}

export interface BadgeConfigInput {
  /** Der Schalter aus der Umgebung (parseBadgeSwitch). */
  enabled: boolean;
  /** Merchant-ID aus der Umgebung; `null` = Programm nicht eingerichtet. */
  merchantId: number | null;
  /** Öffentliche Domain des aufgelösten Mandanten. */
  domain: string;
}

export interface BadgeGateInput extends BadgeConfigInput {
  /** Analyse-Einwilligung erteilt (lib/consent)? */
  consent: boolean;
}

/**
 * Wächter 1–3 — Schalter, Merchant-ID, eigene Domain. Entscheiden ohne DOM
 * und ohne Cookie, also schon beim Server-Rendern.
 */
export function badgeConfigured(input: BadgeConfigInput): boolean {
  return (
    input.enabled &&
    input.merchantId !== null &&
    input.domain === STORE.domain
  );
}

/**
 * Alle vier Wächter, in dieser Reihenfolge. Fällt einer, wird das Skript GAR
 * NICHT geladen — dieselbe Haltung wie beim Opt-in-Modul.
 */
export function badgeAllowed(input: BadgeGateInput): boolean {
  return badgeConfigured(input) && input.consent;
}
