"use client";

/**
 * PostHog — die clientseitige Verdrahtung.
 *
 * Hier laufen die drei Teile zusammen:
 *   - lib/consent/client.ts  → DIE Wahrheit über die Einwilligung
 *     (isAnalyticsAllowed / onConsentChange — genau die Andockstelle,
 *     die der Einwilligungs-Code dafür vorgesehen hat),
 *   - lib/analytics/gate.ts  → wann geladen, gestoppt, gesendet wird,
 *   - lib/analytics/events.ts → was in den Ereignissen steht.
 *
 * posthog-js wird DYNAMISCH importiert (`import("posthog-js")`): Next legt
 * das Paket damit in einen eigenen Chunk, den der Browser erst holt, wenn
 * die Einwilligung erteilt ist. Ohne Einwilligung wird das Skript also gar
 * nicht erst geladen — nicht «geladen, aber stumm».
 */

import {
  isAnalyticsAllowed,
  onConsentChange,
} from "@/lib/consent/client";
import { isAnalyticsAllowed as decideConsent } from "@/lib/consent/state";
import {
  createAnalyticsGate,
  type AnalyticsClientLike,
  type AnalyticsGate,
} from "./gate";
import {
  addToCartEvent,
  checkoutStartedEvent,
  orderCompletedEvent,
  productViewedEvent,
  type AnalyticsEvent,
  type CheckoutStartedInput,
  type OrderCompletedInput,
} from "./events";
import type { ProductVariantView, ProductView } from "@/lib/types";

let gate: AnalyticsGate | null = null;

/**
 * Ereignisse, die feuern, bevor `setupAnalytics` durch ist — React führt
 * Kind-Effekte (z. B. TrackProductView auf der Produktseite) VOR dem
 * Layout-Effekt aus, der das Gate aufbaut. Kurz anstellen statt verlieren;
 * ob sie gesendet werden dürfen, entscheidet danach das Gate.
 */
let preSetup: AnalyticsEvent[] = [];
const MAX_PRE_SETUP = 20;

/**
 * Einmalig vom AnalyticsGate-Component (app/layout.tsx) gerufen. Schlüssel
 * und Host kommen als Props vom Server — zur LAUFZEIT aus der Umgebung
 * gelesen (lib/analytics/server.ts), nicht als NEXT_PUBLIC_* in den Build
 * gebacken. Ohne Schlüssel bleibt alles hier ein stilles No-op.
 */
export function setupAnalytics({
  key,
  host,
}: {
  key: string | null;
  host: string;
}): void {
  // Strict-Mode-Doppelmount und Client-Navigationen: einmal reicht.
  if (gate) return;

  gate = createAnalyticsGate({
    key,
    load: async () => {
      const posthog = (await import("posthog-js")).default;
      posthog.init(key as string, {
        api_host: host,
        // Toolbar- und «in PostHog ansehen»-Links müssen auf den echten
        // EU-Host zeigen, nicht auf den Ingestion-Endpunkt.
        ui_host: "https://eu.posthog.com",

        /**
         * Schaltet die modernen Voreinstellungen frei. Wichtig sind zwei:
         *  - `capture_pageview: "history_change"` — der App Router lädt die
         *    Seite nie neu; ohne das würde nur der allererste Aufruf
         *    gezählt. Zusammen mit `$pageleave` ergibt das Seitenaufrufe
         *    UND Verweildauer.
         *  - Autocapture für Klicks — die Klickwege.
         *
         * Bewusst NICHT "2026-06-25" oder neuer: ab dort ist zusätzlich
         * `session_recording.streamNetworkBody` an, und Netzwerk-Payloads
         * im Replay sind in einem Shop genau der Ort, an dem Adress- und
         * Zahlungsdaten durchlaufen würden.
         */
        defaults: "2026-05-30",

        /**
         * Die IP-Adresse wird nicht am Ereignis gespeichert. PostHog leitet
         * den ungefähren Standort serverseitig aus der Request-IP ab, bevor
         * sie verworfen wird — Land und Stadt bleiben auswertbar. Im Code
         * statt als Projekteinstellung, damit die Zusage in der
         * Datenschutzerklärung nicht an einer Einstellung hängt, die beim
         * nächsten Projektumzug vergessen geht.
         */
        property_denylist: ["$ip"],

        // Kein Personenprofil für jeden anonymen Browser. Profile entstehen
        // erst bei posthog.identify() — das rufen wir bewusst nirgends.
        person_profiles: "identified_only",

        // MANDANTEN: Cookies strikt an den Host binden, der sie gesetzt hat —
        // gleiche Begründung wie bei Warenkorb- und Einwilligungs-Cookie
        // (lib/consent/state.ts). Nichts läuft über die Basis-Domain.
        cross_subdomain_cookie: false,

        session_recording: {
          /**
           * DIE STRENGSTE STUFE: SÄMTLICHE Eingabefelder werden maskiert,
           * nicht nur die als sensibel erkannten. Auf dieser Seite werden
           * Adressen, E-Mail-Adressen und Telefonnummern eingetippt — die
           * Aufzeichnung zeigt dann Sternchen statt Tastatureingaben.
           * (Die Zahlung selbst passiert auf der zahls.ch-Bezahlseite und
           * wird gar nicht erst aufgezeichnet.)
           */
          maskAllInputs: true,
        },
      });

      /**
       * MANDANTEN: Vorerst EIN Schlüssel für alle (siehe
       * lib/analytics/server.ts). Damit die Daten mehrerer Mandanten im
       * gemeinsamen Projekt wenigstens unterscheidbar sind, hängt an jedem
       * Ereignis der Host, auf dem es passiert ist.
       */
      posthog.register({ tenant_host: window.location.host });

      return posthog as AnalyticsClientLike;
    },
  });

  // Jetzt schon erteilt? Dann laden. (Erst NACH createAnalyticsGate — das
  // Gate entscheidet, nicht wir.)
  if (isAnalyticsAllowed()) void gate.setConsent(true);

  // Erteilen UND Widerruf — der Widerruf stoppt sofort, ohne Reload.
  onConsentChange((decision) => void gate?.setConsent(decideConsent(decision)));

  const backlog = preSetup;
  preSetup = [];
  for (const e of backlog) gate.capture(e.name, e.properties);
}

function track(event: AnalyticsEvent): void {
  if (gate) {
    gate.capture(event.name, event.properties);
    return;
  }
  if (preSetup.length < MAX_PRE_SETUP) preSetup.push(event);
}

// ---------------------------------------------------------------------------
// Die öffentliche Oberfläche für Komponenten
// ---------------------------------------------------------------------------

export function trackProductViewed(product: ProductView): void {
  track(productViewedEvent(product));
}

export function trackAddToCart(
  product: ProductView,
  variant: ProductVariantView,
  quantity: number,
  unitPrice: number,
): void {
  track(addToCartEvent(product, variant, quantity, unitPrice));
}

export function trackCheckoutStarted(input: CheckoutStartedInput): void {
  track(checkoutStartedEvent(input));
}

export function trackOrderCompleted(input: OrderCompletedInput): void {
  track(orderCompletedEvent(input));
}
