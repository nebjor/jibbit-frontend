/**
 * Der Takt, in dem die Rückkehrseite nach der Bestellung fragt.
 *
 * ─── Warum zwei Phasen ────────────────────────────────────────────────────
 *
 * Nach der Zahlung bei zahls.ch entsteht die Bestellung nicht sofort: Medusa
 * braucht die Bestätigung des Zahlungsanbieters, und die kommt entweder beim
 * Nachfragen oder per Webhook — bei TWINT gerne erst Sekunden später.
 *
 * PHASE 1 fragt dicht nach (alle 2.5 s), weil die allermeisten Zahlungen in
 * diesem Fenster bestätigt sind. Der Kunde soll nicht unnötig warten.
 *
 * PHASE 2 fragt weiter, nur seltener (alle 8 s). Vorher hörte die Seite nach
 * Phase 1 GANZ auf zu fragen — traf die Bestätigung eine halbe Minute später
 * ein, blieb der Kunde auf «wir warten» sitzen, obwohl die Bestellung längst
 * existierte. Genau dieser Zustand ist gemeldet worden.
 *
 * Nach insgesamt gut drei Minuten hört auch Phase 2 auf. Ab dann ist Warten
 * im Browser sinnlos — der Webhook schliesst die Bestellung unabhängig vom
 * offenen Fenster ab, und der Kunde bekommt die Bestätigung per E-Mail.
 */

/** Phase 1: dicht, deckt den Normalfall ab. */
export const FAST_ATTEMPTS = 8;
export const FAST_DELAY_MS = 2_500;

/** Phase 2: ausdauernd, fängt späte Bestätigungen und Webhook-Nachzügler. */
export const SLOW_ATTEMPTS = 22;
export const SLOW_DELAY_MS = 8_000;

/**
 * Die Wartezeit VOR dem Versuch mit der Nummer `attempt` (1-basiert).
 * Der erste Versuch wartet nicht.
 */
export function delayBeforeAttempt(attempt: number): number {
  if (attempt <= 1) return 0;
  return attempt <= FAST_ATTEMPTS ? FAST_DELAY_MS : SLOW_DELAY_MS;
}

/** Gesamtzahl der Versuche über beide Phasen. */
export const TOTAL_ATTEMPTS = FAST_ATTEMPTS + SLOW_ATTEMPTS;

/** Ab hier zeigt die Seite «dauert länger» — und fragt trotzdem weiter. */
export const PATIENCE_AFTER = FAST_ATTEMPTS;
