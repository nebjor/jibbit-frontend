"use client";

import { useRef, useSyncExternalStore } from "react";
import Script from "next/script";
import { isAnalyticsAllowed, onConsentChange } from "@/lib/consent/client";
import {
  badgeAllowed,
  badgeConfigured,
  MERCHANT_WIDGET_OPTIONS,
  MERCHANT_WIDGET_SRC,
} from "@/lib/google-kundenrezensionen/badge";

/**
 * GOOGLE KUNDENREZENSIONEN — das STORE WIDGET (Googles Nachfolger des
 * «Badge»), schwebend unten links auf jeder Seite, aus app/layout.tsx.
 *
 * Google zeichnet das Widget selbst (eigenes Styling, eigenes Panel mit
 * Shopbewertung und Rezensionen); die Komponente rendert nur das Skript und
 * braucht keinen Platz im Layout. Snippet und Optionen:
 * lib/google-kundenrezensionen/badge.ts (dort steht auch, warum NICHT das
 * alte platform.js-Badge).
 *
 * VIER WÄCHTER — fällt einer, wird das Skript GAR NICHT geladen:
 *
 *  1. SCHALTER `GOOGLE_KUNDENREZENSIONEN_BADGE=1` (Laufzeit, Server,
 *     lib/google-kundenrezensionen/server.ts). Standard AUS: ohne genügend
 *     Rezensionen zeigt Google «Bewertung nicht verfügbar» — ein Abzeichen,
 *     das nichts belegt, nimmt Vertrauen, statt es zu geben. Der Inhaber
 *     schaltet ein, wenn im Merchant Center eine Shopbewertung steht
 *     (docs/google-kundenrezensionen.md).
 *  2. MERCHANT-ID gesetzt — sonst ist das Programm nicht eingerichtet.
 *  3. EIGENE DOMAIN (STORE.domain): Google ordnet das Widget über die
 *     beanspruchte Domain zu; auf test.jibbit.ch oder bei fremden
 *     Mandanten hätte es nichts zu zeigen und würde trotzdem Google laden.
 *  4. EINWILLIGUNG: merchantwidget.js ist ein Drittskript von Google
 *     (gstatic.com) und erhebt laut Google aggregierte Nutzungsdaten —
 *     dieselbe Klasse und darum dieselbe Einwilligung wie Webanalyse und
 *     Opt-in-Modul (lib/consent, `analytics`). Wird sie erst später
 *     erteilt, lädt das Widget in dem Moment nach. Ein Widerruf holt ein
 *     geladenes Skript nicht zurück — das Widget bleibt bis zum nächsten
 *     Seitenaufruf stehen.
 *
 * Die Einwilligung wird als EXTERNE QUELLE gelesen (useSyncExternalStore:
 * Cookie als Momentaufnahme, `onConsentChange` als Abonnement, auf dem
 * Server immer «nein») — so steht im ausgelieferten HTML nie ein Google-
 * Skript, und das Erteilen im Cookie-Hinweis rendert die Komponente
 * einfach neu. Gestartet wird über next/script `onLoad` (Googles Snippet
 * hängt sich an das `load`-Ereignis des Script-Tags); ein Merker verhindert
 * einen zweiten `start`, falls das Script-Element je neu gemountet wird
 * (next/script ruft `onLoad` für ein bereits geladenes Skript erneut auf).
 * Das Layout bleibt über Navigationen hinweg gemountet, das Widget damit
 * auch — Google selbst hält es «always visible».
 */

export interface GoogleKundenrezensionenBadgeProps {
  /** `GOOGLE_KUNDENREZENSIONEN_BADGE` ausgewertet (parseBadgeSwitch). */
  enabled: boolean;
  /** Merchant-Center-ID zur Laufzeit; `null` = Programm nicht eingerichtet. */
  merchantId: number | null;
  /** Öffentliche Domain des aufgelösten Mandanten (TenantTheme.domain). */
  domain: string;
}

declare global {
  interface Window {
    merchantwidget?: {
      start: (options: Record<string, string | number>) => void;
    };
  }
}

/** Abonnement für useSyncExternalStore — meldet Erteilen UND Widerruf. */
function subscribeConsent(onChange: () => void): () => void {
  return onConsentChange(() => onChange());
}

export function GoogleKundenrezensionenBadge({
  enabled,
  merchantId,
  domain,
}: GoogleKundenrezensionenBadgeProps) {
  const started = useRef(false);

  // Wächter 4: das Cookie im Browser, auf dem Server stets «nein».
  const consent = useSyncExternalStore(
    subscribeConsent,
    isAnalyticsAllowed,
    () => false,
  );

  // Wächter 1–3 entscheiden ohne DOM (badgeConfigured), 4 kommt dazu.
  if (!badgeConfigured({ enabled, merchantId, domain })) return null;
  if (!badgeAllowed({ enabled, merchantId, domain, consent })) return null;

  return (
    <Script
      id="google-kundenrezensionen-widget"
      src={MERCHANT_WIDGET_SRC}
      strategy="afterInteractive"
      onLoad={() => {
        if (started.current) return;
        started.current = true;
        try {
          window.merchantwidget?.start({ ...MERCHANT_WIDGET_OPTIONS });
        } catch {
          // Googles Widget meldet Fehler selbst in der Konsole; der Shop
          // funktioniert ohne es.
        }
      }}
    />
  );
}
