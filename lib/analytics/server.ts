import "server-only";

/**
 * PostHog — serverseitige Laufzeitkonfiguration.
 *
 * Schlüssel und Host kommen aus der UMGEBUNG und werden zur LAUFZEIT gelesen,
 * nicht als NEXT_PUBLIC_* zur Build-Zeit ins Bundle gebacken. Zwei Gründe:
 *
 *  1. Dieselbe Falle wie bei STATIC_TENANTS (siehe .env.example): ein
 *     gemeinsam genutztes Docker-Image darf keine deployment-spezifische
 *     Konfiguration enthalten. NEXT_PUBLIC_-Werte wären beim `next build`
 *     im Dockerfile eingefroren — eine Compose-`environment:`-Zeile hätte
 *     dann stillschweigend keine Wirkung.
 *  2. Der Wert landet trotzdem beim Client (als Prop aus app/layout.tsx) —
 *     der PostHog-Projektschlüssel ist dafür gedacht, öffentlich im Browser
 *     zu stehen. Er kommt nur eben aus der Umgebung statt aus dem Build.
 *
 * MANDANTEN — BEWUSST EINFACH GEHALTEN: EIN Schlüssel für alle Tenants.
 * Damit laufen die Daten ALLER Mandanten in EINEM PostHog-Projekt zusammen.
 * Sobald echte Fremd-Mandanten dazukommen, muss das getrennt werden — der
 * saubere Weg ist ein Schlüssel pro Tenant in der TenantConfig
 * (lib/tenant/*), analog zum Publishable Key in STATIC_TENANTS. Bis dahin
 * macht die Event-Eigenschaft `tenant_host` (lib/analytics/client.ts) die
 * Herkunft wenigstens filterbar.
 */

/** PostHog Cloud EU — die getroffene Entscheidung, siehe README/PR. */
const DEFAULT_HOST = "https://eu.i.posthog.com";

let hinted = false;

export function getAnalyticsRuntimeConfig(): {
  key: string | null;
  host: string;
} {
  const key = process.env.POSTHOG_KEY?.trim() || null;
  const host = process.env.POSTHOG_HOST?.trim() || DEFAULT_HOST;

  if (!key && !hinted) {
    hinted = true;
    // Fehlender Schlüssel ist ein legitimer Zustand (Konto existiert noch
    // nicht, lokaler Klon ohne .env.local) — deshalb genau EIN Hinweis im
    // Serverlog, kein Fehler, und im Browser gar nichts.
    console.info(
      "[analytics] POSTHOG_KEY ist nicht gesetzt — es wird keine Analyse geladen.",
    );
  }

  return { key, host };
}
