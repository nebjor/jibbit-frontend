/**
 * PostHog — Lade- und Einwilligungssteuerung, als reine Logik.
 *
 * Bewusst ohne DOM, ohne posthog-js-Import und ohne Next-Abhängigkeit, damit
 * sie unter Vitest (environment: node) testbar ist — dasselbe Muster wie
 * lib/consent/state.ts. Die echte Verdrahtung (dynamischer Import von
 * posthog-js, Abo auf die Einwilligung) steckt in lib/analytics/client.ts.
 *
 * Drei harte Regeln, die dieses Modul durchsetzt:
 *
 *  1. OHNE EINWILLIGUNG WIRD NICHTS GELADEN. Nicht «laden und stumm
 *     bleiben» — `load()` (und damit der Download des posthog-js-Chunks)
 *     passiert erst, wenn `setConsent(true)` gerufen wurde.
 *
 *  2. WIDERRUF WIRKT SOFORT. `setConsent(false)` stoppt Erfassung und
 *     Sitzungsaufzeichnung ohne Seiten-Reload. Kommt der Widerruf, während
 *     der Chunk noch lädt, wird unmittelbar nach dem Laden opt-out gesetzt —
 *     es geht kein einziges Ereignis mehr raus.
 *
 *  3. OHNE SCHLÜSSEL PASSIERT NICHTS. Kein Wurf, kein Netzwerkzugriff, kein
 *     Fehler im Browser — der Betreiber legt das PostHog-Konto erst noch an.
 *     (Der Hinweis dazu steht im Serverlog: lib/analytics/server.ts.)
 */

/**
 * Das Wenige, das wir von posthog-js brauchen — als Interface, damit die
 * Tests einen Stub hineingeben können, statt das echte Paket zu laden.
 */
export interface AnalyticsClientLike {
  capture(event: string, properties?: Record<string, unknown>): unknown;
  opt_in_capturing(): void;
  opt_out_capturing(): void;
  has_opted_out_capturing(): boolean;
  startSessionRecording?(): void;
  stopSessionRecording?(): void;
}

export interface AnalyticsGate {
  /** Einwilligung erteilt/widerrufen. Löst Laden bzw. sofortigen Stopp aus. */
  setConsent(allowed: boolean): Promise<void>;
  /** Ereignis senden — stilles No-op ohne Einwilligung oder ohne Schlüssel. */
  capture(event: string, properties?: Record<string, unknown>): void;
  isActive(): boolean;
}

/**
 * Ereignisse, die zwischen «Einwilligung erteilt» und «Chunk fertig geladen»
 * anfallen (z. B. product_viewed beim ersten Seitenaufruf), werden kurz
 * angestellt statt verworfen. Klein begrenzt: das ist eine Überbrückung von
 * Millisekunden, kein Offline-Puffer.
 */
const MAX_QUEUE = 20;

export function createAnalyticsGate(options: {
  /** PostHog-Projektschlüssel — `null`, solange der Betreiber keinen gesetzt hat. */
  key: string | null;
  /** Lädt und initialisiert posthog-js. Wird höchstens einmal gerufen. */
  load: () => Promise<AnalyticsClientLike>;
}): AnalyticsGate {
  const { key, load } = options;

  let client: AnalyticsClientLike | null = null;
  let loading: Promise<void> | null = null;
  let allowed = false;
  let queue: Array<{ event: string; properties?: Record<string, unknown> }> =
    [];

  function start(c: AnalyticsClientLike): void {
    // posthog-js merkt sich einen früheren Opt-out selbst (localStorage).
    // Sagt das Einwilligungs-Cookie inzwischen wieder ja, heben wir ihn auf.
    if (c.has_opted_out_capturing()) c.opt_in_capturing();
    c.startSessionRecording?.();
  }

  function stop(c: AnalyticsClientLike): void {
    c.stopSessionRecording?.();
    c.opt_out_capturing();
  }

  function flush(c: AnalyticsClientLike): void {
    const pending = queue;
    queue = [];
    for (const e of pending) c.capture(e.event, e.properties);
  }

  async function setConsent(next: boolean): Promise<void> {
    allowed = next;

    // Ohne Schlüssel bewusst GAR nichts — Regel 3.
    if (!key) return;

    if (!next) {
      // Widerruf: Angestelltes verwerfen, Laufendes stoppen — Regel 2.
      queue = [];
      if (client) stop(client);
      return;
    }

    if (client) {
      start(client);
      flush(client);
      return;
    }

    if (!loading) {
      loading = load()
        .then((c) => {
          client = c;
          // Zwischen Ladebeginn und -ende kann die Einwilligung widerrufen
          // worden sein — dann sofort opt-out, nichts nachsenden.
          if (allowed) {
            start(c);
            flush(c);
          } else {
            queue = [];
            stop(c);
          }
        })
        .catch(() => {
          // Adblocker, offline, CSP: still bleiben. Analyse ist nie ein
          // Grund, dem Besucher einen Fehler zu zeigen.
          queue = [];
        })
        .finally(() => {
          loading = null;
        });
    }
    await loading;
  }

  function capture(
    event: string,
    properties?: Record<string, unknown>,
  ): void {
    if (!allowed || !key) return;
    if (client) {
      client.capture(event, properties);
      return;
    }
    if (queue.length < MAX_QUEUE) queue.push({ event, properties });
  }

  return {
    setConsent,
    capture,
    isActive: () => allowed && client !== null,
  };
}
