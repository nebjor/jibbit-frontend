import "server-only";

import type { TenantConfig } from "./types";

/**
 * Encode/decode a `TenantConfig` for the `x-tenant-config` request header.
 *
 * Base64url rather than raw JSON because header values are Latin-1 by spec —
 * theme strings are de-CH content (umlauts) and would get mangled otherwise.
 * `Buffer` is used deliberately: Proxy defaults to the Node.js runtime as of
 * Next.js 16, and rendering always runs in Node, so it is available in both
 * places this module is imported from.
 */

export function encodeTenantHeader(config: TenantConfig): string {
  return Buffer.from(JSON.stringify(config), "utf-8").toString("base64url");
}

/**
 * Returns `null` on anything malformed rather than throwing — a corrupt or
 * foreign header must degrade to "treat as absent", not crash rendering.
 */
export function decodeTenantHeader(value: string): TenantConfig | null {
  try {
    const json = Buffer.from(value, "base64url").toString("utf-8");
    const parsed = JSON.parse(json) as Partial<TenantConfig> | null;
    if (
      parsed &&
      typeof parsed.id === "string" &&
      typeof parsed.host === "string" &&
      typeof parsed.backendUrl === "string" &&
      typeof parsed.publishableKey === "string" &&
      parsed.theme &&
      typeof parsed.theme.storeName === "string" &&
      typeof parsed.theme.domain === "string" &&
      typeof parsed.theme.themeColor === "string"
    ) {
      return parsed as TenantConfig;
    }
    return null;
  } catch {
    return null;
  }
}
