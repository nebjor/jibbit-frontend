import "server-only";

import { STORE, THEME_COLOR } from "@/lib/config";
import type { TenantConfig } from "./types";

/**
 * Local development, single-tenant fallback — requirement: "must still work
 * with a single tenant and no control plane."
 *
 * Reuses the existing `NEXT_PUBLIC_MEDUSA_BACKEND_URL` /
 * `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` env vars so `npm run dev` behaves
 * exactly as it did before multi-tenancy: no DNS, no control plane, `Host`
 * header ignored entirely.
 *
 * Guarded two ways, deliberately redundant:
 *   1. Requires `LOCAL_TENANT_ENABLED=true` — off by default.
 *   2. Hard-disabled whenever `NODE_ENV === "production"`, regardless of (1).
 *      A stray env var surviving into a prod deploy must not silently turn
 *      every hostname into the same tenant — that is precisely the "unknown
 *      host serves someone else's store" failure mode requirement 2 forbids.
 */
export function resolveLocalFallbackTenant(): TenantConfig | null {
  if (process.env.NODE_ENV === "production") return null;
  if (process.env.LOCAL_TENANT_ENABLED !== "true") return null;

  return {
    id: "local-dev",
    host: "local",
    backendUrl: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000",
    publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "",
    theme: {
      storeName: STORE.name,
      domain: STORE.domain,
      themeColor: THEME_COLOR,
    },
  };
}
