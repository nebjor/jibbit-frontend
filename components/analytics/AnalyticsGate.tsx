"use client";

import { useEffect } from "react";
import { setupAnalytics } from "@/lib/analytics/client";

/**
 * Verdrahtet PostHog mit der Einwilligung — einmal pro Seitenleben, aus
 * app/layout.tsx. Rendert nichts.
 *
 * `posthogKey`/`posthogHost` kommen serverseitig aus der Umgebung
 * (lib/analytics/server.ts) — warum als Props statt NEXT_PUBLIC_*, steht
 * dort. Ohne Schlüssel ist `setupAnalytics` ein stilles No-op; ob und wann
 * geladen wird, entscheidet allein die Einwilligung (lib/analytics/gate.ts).
 */
export function AnalyticsGate({
  posthogKey,
  posthogHost,
}: {
  posthogKey: string | null;
  posthogHost: string;
}) {
  useEffect(() => {
    setupAnalytics({ key: posthogKey, host: posthogHost });
  }, [posthogKey, posthogHost]);

  return null;
}
