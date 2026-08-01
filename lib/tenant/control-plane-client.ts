import "server-only";

import type { TenantConfig } from "./types";

/**
 * The one place that talks to the control plane over HTTP.
 *
 * ⚠️ Per the multi-tenancy design doc (medusa-ecom/docs/multi-tenancy-architecture.md
 * §3 P1, §6.2b): the control plane must never be on the request path. This
 * function is intentionally the *only* function in the app that calls it —
 * `lib/tenant/config-cache.ts` is what keeps almost every request from ever
 * reaching this file. Do not call this directly from a page or component.
 *
 * Contract assumed of the control plane (a separate service — not part of
 * this repo, see jibbit-control-plane):
 *
 *   GET {CONTROL_PLANE_URL}/api/tenants/resolve?host=<normalized host>
 *   Authorization: Bearer {CONTROL_PLANE_TOKEN}
 *
 *   200  -> TenantConfig JSON body
 *   404  -> no tenant maps to this host (confirmed absence — safe to
 *           negative-cache; see config-cache.ts)
 *   anything else, a network error, or a timeout -> thrown. The caller must
 *           treat this as "control plane unreachable", NOT as "host unknown"
 *           — conflating the two is exactly the fail-closed bug the config
 *           cache exists to avoid.
 */

const REQUEST_TIMEOUT_MS = 3000;

export async function fetchTenantConfigFromControlPlane(
  host: string,
): Promise<TenantConfig | null> {
  const base = process.env.CONTROL_PLANE_URL;
  if (!base) {
    throw new Error(
      "[tenant] CONTROL_PLANE_URL is not set — cannot resolve tenants beyond the local dev fallback",
    );
  }

  const url = new URL("/api/tenants/resolve", base);
  url.searchParams.set("host", host);

  const token = process.env.CONTROL_PLANE_TOKEN;

  const res = await fetch(url, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    // This is an internal service call, not a user-facing resource — Next's
    // fetch cache has no business here. Freshness policy lives entirely in
    // config-cache.ts, the one place it should be decided.
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`[tenant] control plane returned ${res.status} for host "${host}"`);
  }

  const body: unknown = await res.json();
  return parseTenantConfig(body, host);
}

function parseTenantConfig(body: unknown, host: string): TenantConfig {
  if (typeof body !== "object" || body === null) {
    throw new Error(`[tenant] control plane response for "${host}" was not an object`);
  }
  const b = body as Record<string, unknown>;
  const theme = b.theme;

  if (
    typeof b.id !== "string" ||
    typeof b.backendUrl !== "string" ||
    typeof b.publishableKey !== "string" ||
    typeof theme !== "object" ||
    theme === null
  ) {
    throw new Error(`[tenant] control plane response for "${host}" is missing required fields`);
  }
  const t = theme as Record<string, unknown>;
  if (
    typeof t.storeName !== "string" ||
    typeof t.domain !== "string" ||
    typeof t.themeColor !== "string"
  ) {
    throw new Error(`[tenant] control plane response for "${host}" has an incomplete theme`);
  }

  return {
    id: b.id,
    host,
    backendUrl: b.backendUrl,
    publishableKey: b.publishableKey,
    theme: { storeName: t.storeName, domain: t.domain, themeColor: t.themeColor },
  };
}
