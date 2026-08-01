/**
 * Medusa JS SDK singleton.
 *
 * ⚠️ ALL backend calls in this app go through this SDK — never bare fetch().
 * Store routes require the `x-publishable-api-key` header, which the SDK adds
 * automatically. A raw fetch() would 401.
 *
 * The publishable key is read from the environment. It is intentionally NOT
 * validated at module load: the backend is not up yet, and throwing here would
 * break `next build`. Missing key simply means requests fail and the data layer
 * falls back to the mock catalog.
 */

import Medusa from "@medusajs/js-sdk";

export const MEDUSA_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";

export const MEDUSA_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: MEDUSA_PUBLISHABLE_KEY,
});

/** True when we have enough config to even attempt a backend call. */
export const isBackendConfigured = Boolean(MEDUSA_PUBLISHABLE_KEY);
