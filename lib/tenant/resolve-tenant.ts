import "server-only";

import { resolveTenantConfig, type ResolveOptions } from "./config-cache";
import { resolveLocalFallbackTenant } from "./local-fallback";
import { resolveStaticTenant } from "./static-tenants";
import type { TenantConfig } from "./types";

/**
 * Die Auflösungskette Host -> TenantConfig, an EINER Stelle.
 *
 * Reihenfolge: Dev-Rückfall, dann die statische Tabelle des Betreibers, dann
 * die Control Plane. Unbekannter Host -> `null`, niemals ein Vorgabe-Tenant.
 *
 * Zwei Aufrufer brauchen genau diese Kette: proxy.ts für jede Seitenanfrage
 * und app/media/[...path]/route.ts für Produktbilder. Warum der Bildproxy den
 * Host aus dem PFAD statt aus dem Header nimmt, steht dort — die Kette selbst
 * darf zwischen beiden aber nicht auseinanderlaufen, sonst hiesse „unbekannter
 * Host" an einer Stelle etwas anderes als an der anderen.
 */
export async function resolveTenantForHost(
  rawHost: string,
  opts?: ResolveOptions,
): Promise<TenantConfig | null> {
  return (
    resolveLocalFallbackTenant() ??
    resolveStaticTenant(rawHost) ??
    (await resolveTenantConfig(rawHost, opts))
  );
}
