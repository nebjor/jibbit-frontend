/**
 * Medusa JS SDK client factory — one client per tenant, never a shared one.
 *
 * ⚠️ ALL backend calls in this app go through a client from here — never bare
 * fetch(). Store routes require the `x-publishable-api-key` header, which the
 * SDK adds automatically. A raw fetch() would 401.
 *
 * ⚠️ THIS FILE USED TO EXPORT A SINGLETON `sdk` BUILT FROM `process.env` AT
 * MODULE LOAD. That is the textbook cross-tenant leak: one process now serves
 * many tenants, so there is no single "the" backend URL or publishable key to
 * bake in at load time — whichever tenant's env happened to be read would
 * leak into every other tenant's requests. `getSdkForTenant` replaces it with
 * a `Map` keyed by tenant id: each tenant gets its own client, built from its
 * own resolved `TenantConfig`, and nothing here ever holds a single mutable
 * "current tenant" slot that a concurrent request for a different tenant
 * could overwrite.
 *
 * The `Map` grows for as long as the process lives, one entry per distinct
 * tenant it has ever served — fine at the platform's stated scale (tens of
 * tenants per host), not fine at thousands; an LRU eviction policy would be
 * the fix if that scale is ever reached.
 */

import "server-only";
import Medusa from "@medusajs/js-sdk";
import type { TenantConfig } from "./tenant/types";

const clients = new Map<string, Medusa>();

/** Returns this tenant's Medusa client, creating and memoizing it on first use. */
export function getSdkForTenant(tenant: TenantConfig): Medusa {
  const cached = clients.get(tenant.id);
  if (cached) return cached;

  const client = new Medusa({
    baseUrl: tenant.backendUrl,
    debug: process.env.NODE_ENV === "development",
    publishableKey: tenant.publishableKey,
  });
  clients.set(tenant.id, client);
  return client;
}

/** True when this tenant has enough config to even attempt a backend call. */
export function isBackendConfigured(tenant: TenantConfig): boolean {
  return Boolean(tenant.publishableKey);
}
