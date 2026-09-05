/**
 * «ZUM SHOP»-VERBRENN-ANIMATION — reine Entscheidungslogik.
 *
 * Der Knopf auf der Startseite faltet sich beim ersten Klick wie ein Paper,
 * rollt sich ein, wird angezündet und verbrennt — danach geht es in den
 * Shop. Diese Datei enthält NUR die Entscheidung, ob das passieren darf,
 * und das Sitzungs-Gedächtnis dazu. Bewusst ohne DOM und ohne React, damit
 * sie unter Vitest (environment: node) testbar ist — dasselbe Muster wie
 * lib/consent/state.ts. Das Sichtbare steckt in
 * components/ShopBurnCta.tsx + .module.css.
 */

// ---------------------------------------------------------------------------
// Zeiten
// ---------------------------------------------------------------------------

/** Phase 1: der Knopf faltet sich längs in der Mitte — der Knick. */
export const BURN_FOLD_MS = 180;
/** Phase 2: der gefaltete Streifen wird eingerollt. */
export const BURN_ROLL_MS = 240;
/** Phase 3: anzünden und verbrennen (Sprite aus public/loader/). */
export const BURN_BURN_MS = 480;

/**
 * Gesamtdauer bis zur Weiterleitung. HARTE OBERGRENZE: unter einer
 * Sekunde — länger wirkt nicht aufwendiger, sondern langsam. Der Test
 * in burn-cta.test.ts hält diese Grenze fest. Während der ganzen Zeit
 * wächst das Objekt (Skalierung im CSS), das ist keine eigene Phase.
 */
export const BURN_TOTAL_MS = BURN_FOLD_MS + BURN_ROLL_MS + BURN_BURN_MS;

// ---------------------------------------------------------------------------
// Einmal je Sitzung
// ---------------------------------------------------------------------------

/**
 * sessionStorage-Schlüssel. Beim ersten Klick ist die Animation ein
 * Erlebnis, beim fünften eine Sekunde zwischen dem Kunden und seinem
 * Geld — deshalb läuft sie je Browser-Sitzung genau einmal.
 */
export const BURN_PLAYED_KEY = "jibbit_shop_burn_played";

/**
 * Kleinster gemeinsamer Nenner von `Storage`, den wir brauchen — als
 * eigener Typ, damit Tests ein Objekt statt echtem sessionStorage
 * hineinreichen können.
 */
export interface BurnMemory {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * `window.sessionStorage` hinter try/catch: im privaten Modus mancher
 * Browser (und bei blockierten Website-Daten) WIRFT schon der Zugriff
 * auf die Eigenschaft. Dann gibt es eben kein Gedächtnis (`null`) — die
 * Animation läuft dann höchstens einmal je Seitenaufruf, was in einem
 * gedächtnislosen Browser das erwartbare Verhalten ist.
 */
export function safeSessionStorage(): BurnMemory | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Schon gelaufen? Wirft NIE — ein kaputtes Storage heisst nur «nein». */
export function hasBurnPlayed(memory: BurnMemory | null): boolean {
  if (!memory) return false;
  try {
    return memory.getItem(BURN_PLAYED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Als gelaufen merken. Wirft NIE — schlägt das Schreiben fehl (volles
 * oder verweigertes Storage), verliert der Besucher nichts ausser der
 * Einmaligkeit.
 */
export function markBurnPlayed(memory: BurnMemory | null): void {
  if (!memory) return;
  try {
    memory.setItem(BURN_PLAYED_KEY, "1");
  } catch {
    // bewusst geschluckt, siehe oben
  }
}

// ---------------------------------------------------------------------------
// Die Klick-Entscheidung
// ---------------------------------------------------------------------------

export interface BurnClickContext {
  /** Läuft die Animation bereits (Doppelklick, Ungeduld)? */
  running: boolean;
  /**
   * Klick mit Modifikator (Strg/Cmd/Shift/Alt) oder nicht-linker
   * Maustaste — der Besucher will einen neuen Tab o. Ä. Das gehört
   * dem Browser, nicht uns.
   */
  modifiedClick: boolean;
  /** `prefers-reduced-motion: reduce` — oder kein matchMedia vorhanden. */
  reducedMotion: boolean;
  /** In dieser Sitzung schon gelaufen? */
  alreadyPlayed: boolean;
  /**
   * Liegt gerade eine Einblendung vorne (Altersabfrage, Cookie-Hinweis,
   * Warenkorb — alles mit role="dialog")? Dann ist der Weg nicht frei
   * und die Zierde hat Pause.
   */
  overlayOpen: boolean;
}

export type BurnClickAction =
  /** Nichts tun: Standard-Navigation des Links greift sofort. */
  | "navigate"
  /** Animation starten, Weiterleitung nach BURN_TOTAL_MS. */
  | "animate"
  /** Klick schlucken: es läuft schon, die Weiterleitung ist unterwegs. */
  | "ignore";

/**
 * Was passiert bei diesem Klick? Reihenfolge der Regeln:
 *
 * 1. Modifikator-Klick => dem Browser überlassen (auch während der
 *    Animation: ein neuer Tab verdoppelt unsere Weiterleitung nicht).
 * 2. Läuft schon => schlucken. Ein zweiter Klick darf weder eine zweite
 *    Animation starten noch die Weiterleitung verdoppeln.
 * 3. Reduzierte Bewegung => SOFORT weiterleiten, Animation komplett
 *    übersprungen (nicht abgeschwächt).
 * 4. Schon gelaufen oder Overlay vorne => still weiterleiten.
 * 5. Sonst: brennen.
 */
export function decideBurnClick(ctx: BurnClickContext): BurnClickAction {
  if (ctx.modifiedClick) return "navigate";
  if (ctx.running) return "ignore";
  if (ctx.reducedMotion) return "navigate";
  if (ctx.alreadyPlayed) return "navigate";
  if (ctx.overlayOpen) return "navigate";
  return "animate";
}
