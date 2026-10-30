/**
 * Aktion im Warenkorb nachziehen: reine Entscheidung (kein Server-Zugriff).
 *
 * ══ WARUM ES DAS BRAUCHT ═════════════════════════════════════════════════
 * Medusa berechnet automatische Promotionen nur, wenn der Warenkorb
 * GESCHRIEBEN wird (Position hinzufügen/ändern, `POST /store/carts/:id`) —
 * nie bei einem `GET`. Ein Warenkorb, der vor dem Start einer Aktion
 * entstanden ist, bleibt deshalb ohne Rabatt, bis die Kundin etwas ändert.
 * Umgekehrt trägt ein Warenkorb, der während der Aktion entstand, den Rabatt
 * auch nach deren Ende weiter und würde ihn bei der Zahlung abziehen.
 *
 * Die Aktionen kommen aus `getAktionen()` (laufende, automatische Promotionen,
 * 60 s gecacht). Verglichen wird in BEIDE Richtungen:
 *   - eine laufende Aktion auf alle Artikel fehlt im Warenkorb  -> nachziehen
 *   - der Warenkorb trägt eine automatische Aktion, die nicht mehr läuft
 *                                                            -> nachziehen
 *
 * Teilsortiment-Aktionen zählen nur in der zweiten Richtung: ob sie auf diesen
 * Warenkorb passen, entscheiden Medusas Regeln — ein Fehlen ist dort normal.
 *
 * SCHUTZ VOR SCHLEIFEN: Nach dem Nachziehen steht in `metadata.aktion_geprueft`,
 * gegen welchen Stand der Aktionen geprüft wurde. Liefert Medusa trotzdem keinen
 * Rabatt (Regeln nicht erfüllt), wird derselbe Stand nicht erneut gebucht.
 */

import type { Aktion } from "@/lib/aktionen";

/** Metadata-Schlüssel mit dem zuletzt geprüften Stand der Aktionen. */
export const AKTION_MARKER = "aktion_geprueft";
/** Zeitpunkt der letzten Prüfung (nur zur Fehlersuche). */
export const AKTION_MARKER_ZEIT = "aktion_geprueft_am";

/** Der Teil eines Medusa-Warenkorbs, den die Entscheidung liest. */
export interface AktionCartLike {
  items?: readonly unknown[] | null;
  promotions?: readonly { code?: string | null; is_automatic?: boolean | null }[] | null;
  metadata?: Record<string, unknown> | null;
  completed_at?: string | Date | null;
}

export interface AktionEntscheid {
  nachziehen: boolean;
  /** Stand der Aktionen für den Marker, z. B. «EROEFFNUNG20@2026-10-30T…» oder «-». */
  stand: string;
}

function laeuft(a: Aktion, jetzt: number): boolean {
  const ab = a.giltAb ? Date.parse(a.giltAb) : null;
  const bis = a.giltBis ? Date.parse(a.giltBis) : null;
  if (ab !== null && !Number.isNaN(ab) && ab > jetzt) return false;
  if (bis !== null && !Number.isNaN(bis) && bis <= jetzt) return false;
  return true;
}

export function pruefeAktion(
  cart: AktionCartLike,
  aktionen: readonly Aktion[],
  jetzt: number,
): AktionEntscheid {
  const aktiv = aktionen.filter((a) => laeuft(a, jetzt));
  const stand = aktiv.length
    ? aktiv
        .map((a) => `${a.code}@${a.giltAb ?? ""}`)
        .sort()
        .join(",")
    : "-";

  if (!cart.items?.length || cart.completed_at) return { nachziehen: false, stand };

  // Manuelle Codes (is_automatic === false) gehen uns nichts an.
  const imWarenkorb = new Set(
    (cart.promotions ?? [])
      .filter((p) => p?.code && p.is_automatic !== false)
      .map((p) => p.code as string),
  );
  const aktiveCodes = new Set(aktiv.map((a) => a.code));
  const ganzesSortiment = aktiv.filter((a) => a.aufArtikel && !a.nurTeilsortiment);

  const fehlt = ganzesSortiment.some((a) => !imWarenkorb.has(a.code));
  const abgelaufen = [...imWarenkorb].some((code) => !aktiveCodes.has(code));
  if (!fehlt && !abgelaufen) return { nachziehen: false, stand };

  // Gegen diesen Stand schon geprüft: Medusa hat entschieden, nicht erneut buchen.
  if (cart.metadata?.[AKTION_MARKER] === stand) return { nachziehen: false, stand };

  return { nachziehen: true, stand };
}
