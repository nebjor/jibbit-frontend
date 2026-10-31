import { SHOP } from "@/shop.config";

/**
 * Aktionsbanner: reine Hilfsfunktionen (kein Server-, kein Browser-Zugriff).
 *
 * Die Aktionen kommen vom Backend (`GET /store/aktionen`, siehe lib/data.ts) —
 * hier steht nichts Festes: weder Daten noch Prozentsätze. Das Backend liefert
 * nur AUTOMATISCHE Promotionen, die gerade laufen; trotzdem wird das Fenster
 * hier nochmals geprüft, weil die Antwort bis zu 60 s alt sein darf und der
 * Banner sich am Ende selbst ausblenden muss.
 *
 * Abgerechnet wird der Rabatt allein von Medusa im Warenkorb. Der Banner ist
 * reine Anzeige.
 */

export interface Aktion {
  code: string;
  titel: string;
  /** Prozentrabatt, z. B. 20. */
  prozent?: number;
  /** Fixbetrag in `waehrung`. */
  betrag?: number;
  waehrung?: string;
  /** ISO-Zeitpunkt oder null (ohne Startdatum). */
  giltAb: string | null;
  /** ISO-Zeitpunkt oder null (unbefristet). */
  giltBis: string | null;
  nurTeilsortiment: boolean;
  aufArtikel: boolean;
}

const MINUTE = 60_000;
const STUNDE = 60 * MINUTE;
const TAG = 24 * STUNDE;

function alsZeit(iso: unknown): number | null {
  if (typeof iso !== "string") return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

function alsZahl(wert: unknown): number | undefined {
  return typeof wert === "number" && Number.isFinite(wert) && wert > 0
    ? wert
    : undefined;
}

/**
 * Backend-Antwort (`{ aktionen: [...] }`, snake_case) → Aktionen, die JETZT
 * laufen. Unbrauchbare Einträge werden verworfen, nie geworfen: eine kaputte
 * Antwort heisst «kein Banner», nicht «Fehlerseite».
 */
export function parseAktionen(raw: unknown, jetzt: number): Aktion[] {
  const liste = (raw as { aktionen?: unknown } | null)?.aktionen;
  if (!Array.isArray(liste)) return [];

  const ergebnis: Aktion[] = [];
  for (const e of liste) {
    if (!e || typeof e !== "object") continue;
    const r = e as Record<string, unknown>;
    if (typeof r.code !== "string" || !r.code) continue;

    const prozent = alsZahl(r.prozent);
    const betrag = alsZahl(r.betrag);
    if (prozent === undefined && betrag === undefined) continue;

    const ab = alsZeit(r.gilt_ab);
    const bis = alsZeit(r.gilt_bis);
    if (ab !== null && ab > jetzt) continue;
    if (bis !== null && bis <= jetzt) continue;

    ergebnis.push({
      code: r.code,
      titel: typeof r.titel === "string" ? r.titel : "",
      prozent,
      betrag,
      waehrung: typeof r.waehrung === "string" ? r.waehrung : undefined,
      giltAb: ab === null ? null : (r.gilt_ab as string),
      giltBis: bis === null ? null : (r.gilt_bis as string),
      nurTeilsortiment: r.nur_teilsortiment === true,
      // Ältere Backends kennen das Feld nicht: dann gilt der Rabatt auf Artikel.
      aufArtikel: r.auf_artikel !== false,
    });
  }
  return ergebnis;
}

/** Die Aktion für den Banner: die zuerst endende, unbefristete zuletzt. */
export function waehleBanner(aktionen: readonly Aktion[]): Aktion | undefined {
  return [...aktionen].sort((a, b) => {
    const x = a.giltBis ? Date.parse(a.giltBis) : Infinity;
    const y = b.giltBis ? Date.parse(b.giltBis) : Infinity;
    return x === y ? 0 : x < y ? -1 : 1;
  })[0];
}

function zahl(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** Grosse Zeile: «Zusätzlich 20 % auf alles» — zusätzlich, weil die Mengenrabatte
 *  der Produkte unverändert gelten und der Aktionsrabatt obendrauf kommt. */
export function bannerUeberschrift(a: Aktion): string {
  const ziel = a.nurTeilsortiment ? "auf ausgewählte Artikel" : "auf alles";
  if (a.prozent !== undefined) return `Zusätzlich ${zahl(a.prozent)} % ${ziel}`;
  if (a.betrag !== undefined) {
    const waehrung = a.waehrung ?? "CHF";
    return `${waehrung} ${zahl(a.betrag)} Rabatt ${a.nurTeilsortiment ? "auf ausgewählte Artikel" : "auf deinen Einkauf"}`;
  }
  return a.titel;
}

/**
 * Hinweis für die Produktseite — nur bei einer Prozent-Aktion auf das ganze
 * Sortiment, die auf Artikel wirkt. Sonst null: bei einem Teilsortiment wüsste
 * die Produktseite nicht, ob DIESES Produkt gemeint ist.
 */
export function produktHinweis(aktionen: readonly Aktion[]): string | null {
  const a = waehleBanner(
    aktionen.filter(
      (x) => x.prozent !== undefined && x.aufArtikel && !x.nurTeilsortiment,
    ),
  );
  return a ? `Zusätzlich ${zahl(a.prozent!)} % Aktionsrabatt wird an der Kasse abgezogen` : null;
}

/** Verbleibende Zeit bis `bis` (ms seit Epoche), oder null wenn abgelaufen/unbefristet. */
export function restMillisekunden(
  giltBis: string | null,
  jetzt: number,
): number | null {
  const bis = alsZeit(giltBis);
  if (bis === null) return null;
  const rest = bis - jetzt;
  return rest > 0 ? rest : null;
}

/**
 * «23 h 12 min», «1 Tag 3 h», «45 min», «weniger als 1 min». Minuten werden
 * abgerundet, damit der Banner nie mehr verspricht, als noch da ist.
 */
export function formatRestzeit(rest: number): string {
  if (rest < MINUTE) return "weniger als 1 min";
  const tage = Math.floor(rest / TAG);
  const stunden = Math.floor((rest % TAG) / STUNDE);
  const minuten = Math.floor((rest % STUNDE) / MINUTE);
  if (tage > 0) {
    const t = `${tage} ${tage === 1 ? "Tag" : "Tage"}`;
    return stunden > 0 ? `${t} ${stunden} h` : t;
  }
  if (stunden > 0) return `${stunden} h ${minuten} min`;
  return `${minuten} min`;
}

/** Schlüssel des «weggeklickt»-Merkers (sessionStorage): je Aktion (Code). */
export function dismissKey(a: Pick<Aktion, "code">): string {
  return `${SHOP.id}-aktionsbanner:${a.code}`;
}

/**
 * Die Aktion für den grossen Hero-Block der Startseite: nur eine, die das
 * ganze Sortiment betrifft und auf Artikel wirkt («20 % auf alles»). Für
 * Teilsortimente bleibt es beim schmalen Banner.
 */
export function heroAktion(aktionen: readonly Aktion[]): Aktion | undefined {
  return waehleBanner(aktionen.filter((a) => a.aufArtikel && !a.nurTeilsortiment));
}

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/**
 * «30. Oktober, 19:30 Uhr» — Zeitpunkt in Schweizer Zeit (Europe/Zurich),
 * egal wo Server oder Besucher stehen. Der Monat kommt aus einer festen
 * Liste statt aus Intl, damit Server und Browser nie verschieden schreiben.
 */
export function formatGiltBis(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const teile = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(t));
  const wert = (typ: string) => teile.find((p) => p.type === typ)?.value ?? "";
  const monat = MONATE[Number(wert("month")) - 1];
  return `${Number(wert("day"))}. ${monat}, ${wert("hour")}:${wert("minute")} Uhr`;
}
