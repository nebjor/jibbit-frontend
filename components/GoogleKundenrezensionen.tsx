"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { DELIVERY, FEATURES, STORE } from "@/lib/config";
import { isAnalyticsAllowed, onConsentChange } from "@/lib/consent/client";
import { isAnalyticsAllowed as decideConsent } from "@/lib/consent/state";
import {
  kundenrezensionenPayload,
  type GcrOptInPayload,
  type GcrOrderInput,
} from "@/lib/google-kundenrezensionen/payload";

/**
 * GOOGLE KUNDENREZENSIONEN — das Opt-in-Modul auf der Bestätigungsseite.
 *
 * Googles Skript (platform.js) blendet nach der Bestellung ein kleines
 * Fenster ein: «Möchtest du jibbit nach der Lieferung bewerten?». Sagt die
 * Kundin ja, mailt Google ihr nach dem voraussichtlichen Lieferdatum eine
 * Umfrage; die Bewertungen laufen im Merchant Center zusammen und werden —
 * ab rund 100 Rezensionen in 24 Monaten — als Sterne bei Google angezeigt
 * (docs/google-kundenrezensionen.md). Die Komponente rendert selbst nichts
 * Sichtbares: das Fenster zeichnet Google als Overlay, es braucht keinen
 * Platz im Layout und verschiebt nichts.
 *
 * VIER WÄCHTER, in dieser Reihenfolge — fällt einer, wird das Skript GAR
 * NICHT geladen (nicht «geladen, aber stumm»):
 *
 *  1. MERCHANT-ID. Kommt zur Laufzeit aus der Umgebung
 *     (lib/google-kundenrezensionen/server.ts); fehlt sie, gibt es nichts
 *     einzubinden. Die Seite reicht `null` durch.
 *
 *  2. EIGENE DOMAIN. Nur wenn `domain === STORE.domain` (jibbit.ch) —
 *     dieselbe Prüfung wie für die Anbieterkennzeichnung in
 *     lib/seo/jsonld.ts. Ein fremder Mandant darf keine Bewertungen auf
 *     jibbits Merchant-Center-Konto sammeln, und auf test.jibbit.ch würden
 *     Testbestellungen zu echten Umfragen an echte Adressen.
 *
 *  3. EINWILLIGUNG. platform.js ist ein Drittskript von Google und setzt
 *     Google-Cookies; die E-Mail-Adresse der Kundin wandert an Google. Das
 *     ist dieselbe Klasse wie die Webanalyse — darum hängt es an DERSELBEN
 *     Einwilligung (lib/consent/*, `analytics`); eine eigene Kategorie gibt
 *     die Einwilligungsschicht nicht her, und ein zweiter Schalter für eine
 *     Frage, die der Kundin nicht erklärt werden kann, wäre schlechter als
 *     einer, der ehrlich beschrieben ist (Cookie-Hinweis, Datenschutz
 *     Ziffer 7). «Nur notwendige» => kein Google, keine Einladung. Wird die
 *     Einwilligung auf dieser Seite erst erteilt, lädt das Modul dann.
 *     Ein Widerruf kann ein bereits geladenes Skript nicht zurückholen;
 *     es ruft aber auch nichts mehr auf — das Fenster ist einmalig.
 *
 *  4. NUTZLAST. Ohne E-Mail oder Bestelldatum gibt es nichts einzuladen
 *     (lib/google-kundenrezensionen/payload.ts liefert `null`).
 *
 * EINMAL PRO SEITENANSICHT: `window.renderOptIn` wird VOR dem Skript
 * definiert (Google ruft es über `?onload=renderOptIn`, sobald platform.js
 * bereit ist) und löscht sich nach dem Aufruf selbst; ein Merker hält den
 * Strict-Mode-Doppelmount und spätere Einwilligungs-Ereignisse ab. Ein
 * Reload der Seite zeigt das Fenster erneut — das ist Googles Verhalten
 * für alle Shops und bewusst nicht unterdrückt: Google selbst merkt sich
 * ein «Nein, danke» je Bestellung.
 */

export interface GoogleKundenrezensionenProps {
  /** Merchant-Center-ID zur Laufzeit; `null` = Modul aus. */
  merchantId: number | null;
  /** Öffentliche Domain des aufgelösten Mandanten (TenantTheme.domain). */
  domain: string;
  order: GcrOrderInput;
}

declare global {
  interface Window {
    renderOptIn?: () => void;
    gapi?: {
      load: (api: "surveyoptin", callback: () => void) => void;
      surveyoptin?: { render: (payload: GcrOptInPayload) => void };
    };
  }
}

/** Googles Skript, mit dem dokumentierten onload-Haken. */
export const GCR_SCRIPT_SRC =
  "https://apis.google.com/js/platform.js?onload=renderOptIn";

export function GoogleKundenrezensionen({
  merchantId,
  domain,
  order,
}: GoogleKundenrezensionenProps) {
  const [payload, setPayload] = useState<GcrOptInPayload | null>(null);
  const armed = useRef(false);

  // Wächter 1, 2 und 4 brauchen kein DOM — sie entscheiden synchron.
  const eligible =
    FEATURES.googleReviews &&
    merchantId !== null &&
    domain === STORE.domain &&
    kundenrezensionenPayload(order, { merchantId, delivery: DELIVERY }) !==
      null;

  useEffect(() => {
    if (!eligible || merchantId === null) return;

    const arm = () => {
      if (armed.current) return;
      const next = kundenrezensionenPayload(order, {
        merchantId,
        delivery: DELIVERY,
      });
      if (!next) return;
      armed.current = true;

      // Vor dem Skript definieren — platform.js ruft den Namen aus
      // `?onload=` auf, sobald es geladen ist.
      window.renderOptIn = () => {
        delete window.renderOptIn;
        window.gapi?.load("surveyoptin", () => {
          try {
            window.gapi?.surveyoptin?.render(next);
          } catch {
            // Googles Modul meldet Fehler selbst in der Konsole; der
            // Kundin zeigen wir deswegen nichts — die Bestellung steht.
          }
        });
      };
      setPayload(next);
    };

    // Wächter 3: jetzt schon erlaubt? Sonst auf das Erteilen warten.
    if (isAnalyticsAllowed()) {
      arm();
      return;
    }
    return onConsentChange((decision) => {
      if (decideConsent(decision)) arm();
    });
  }, [eligible, merchantId, order]);

  if (!payload) return null;

  return (
    <Script
      id="google-kundenrezensionen"
      src={GCR_SCRIPT_SRC}
      strategy="afterInteractive"
    />
  );
}
