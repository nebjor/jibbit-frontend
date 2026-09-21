/**
 * A Medusa cart whose lines point at deleted or unpublished variants still
 * reads fine, but every write re-validates all lines (`refreshCartItemsWorkflow`)
 * and fails with 400 — deleting one line fails on the next dead one. The only
 * way out is a fresh cart holding what is still orderable.
 *
 * Pure apart from the passed SDK.
 */

import type Medusa from "@medusajs/js-sdk";
import type { HttpTypes } from "@medusajs/types";
import { toCartLineView } from "./adapter";
import type { CartLineView } from "./types";

/** Loose on purpose, so a reworded Medusa message does not switch recovery off. */
const STALE_PATTERNS = [/do not exist/i, /not published/i, /do not have a price/i];

function statusOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const e = error as { status?: unknown; statusCode?: unknown };
  const s = e.status ?? e.statusCode;
  return typeof s === "number" ? s : undefined;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "";
}

/**
 * The variants Medusa refused, `[]` if it did not name them, or `null` when
 * the error is not about dead lines at all.
 */
export function staleVariantIds(error: unknown): string[] | null {
  const status = statusOf(error);
  if (status !== undefined && status !== 400) return null;
  const message = messageOf(error);
  if (!/variant/i.test(message) || !STALE_PATTERNS.some((p) => p.test(message))) {
    return null;
  }
  return Array.from(new Set(message.match(/variant_[0-9A-Za-z]+/g) ?? []));
}

export const NETWORK_ERROR =
  "Der Warenkorb ist gerade nicht erreichbar. Bitte in einem Moment nochmals versuchen.";

export const REJECTED_ERROR =
  "Der Warenkorb liess sich nicht aktualisieren. Bitte lade die Seite neu. " +
  "Klappt es dann immer noch nicht, schreib uns kurz — wir helfen sofort weiter.";

/** "Try again later" only when retrying can help: no response, 5xx or 429. */
export function describeCartFailure(error: unknown): string {
  const status = statusOf(error);
  if (status === undefined || status >= 500 || status === 429) {
    return NETWORK_ERROR;
  }
  return REJECTED_ERROR;
}

function lineLabel(line: CartLineView): string {
  return line.variantTitle ? `${line.title} (${line.variantTitle})` : line.title;
}

export function droppedNotice(
  dropped: readonly CartLineView[],
  remainingCount: number,
): string {
  if (dropped.length === 0) {
    return "Dein Warenkorb wurde aktualisiert, weil sich das Sortiment geändert hat.";
  }
  const names = dropped.map((l) => `«${lineLabel(l)}»`).join(", ");
  const head =
    dropped.length === 1
      ? `${names} ist nicht mehr erhältlich und wurde aus dem Warenkorb entfernt.`
      : `Diese Artikel sind nicht mehr erhältlich und wurden aus dem Warenkorb entfernt: ${names}.`;
  return remainingCount > 0
    ? `${head} Der Rest deiner Bestellung ist unverändert.`
    : `${head} Dein Warenkorb ist jetzt leer — im Shop findest du das aktuelle Sortiment.`;
}

type AddressLike = HttpTypes.StoreCartAddress | null | undefined;

/** `POST /store/carts` validates addresses `.strict()` — no id, no timestamps. */
function toAddressPayload(address: AddressLike) {
  if (!address?.country_code) return undefined;
  const pick = (v: string | null | undefined) => v ?? undefined;
  return {
    first_name: pick(address.first_name),
    last_name: pick(address.last_name),
    company: pick(address.company),
    address_1: pick(address.address_1),
    address_2: pick(address.address_2),
    postal_code: pick(address.postal_code),
    city: pick(address.city),
    country_code: address.country_code,
    province: pick(address.province),
    phone: pick(address.phone),
  };
}

export interface RebuildResult {
  cart: HttpTypes.StoreCart;
  dropped: CartLineView[];
}

/**
 * Lines are re-added one by one (one dead item in a bulk create would sink
 * the rest); a dead-line refusal drops the line, any other error aborts.
 */
export async function rebuildCart(
  sdk: Pick<Medusa, "store">,
  stale: HttpTypes.StoreCart,
  options: { regionId?: string; knownDead: readonly string[]; fields: string },
): Promise<RebuildResult> {
  const dead = new Set(options.knownDead);
  const regionId = options.regionId ?? stale.region_id ?? undefined;

  const createBody: HttpTypes.StoreCreateCart = {};
  if (regionId) createBody.region_id = regionId;
  if (stale.email) createBody.email = stale.email;
  const shipping = toAddressPayload(stale.shipping_address);
  if (shipping) createBody.shipping_address = shipping;
  const billing = toAddressPayload(stale.billing_address);
  if (billing) createBody.billing_address = billing;

  let { cart } = await sdk.store.cart.create(createBody, {
    fields: options.fields,
  });

  const dropped: CartLineView[] = [];
  for (const item of stale.items ?? []) {
    const line = toCartLineView(item);
    if (!item.variant_id || dead.has(item.variant_id) || !(item.quantity > 0)) {
      dropped.push(line);
      continue;
    }
    try {
      ({ cart } = await sdk.store.cart.createLineItem(
        cart.id,
        { variant_id: item.variant_id, quantity: item.quantity },
        { fields: options.fields },
      ));
    } catch (error) {
      if (staleVariantIds(error) === null) throw error;
      dropped.push(line);
    }
  }

  return { cart, dropped };
}
