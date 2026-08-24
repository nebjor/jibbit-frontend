/**
 * CART OPERATIONS AGAINST MEDUSA — server-only.
 *
 * ══ WHY SERVER ACTIONS AND NOT A BROWSER SDK CLIENT ══════════════════════
 * The publishable key and the backend URL are not build-time constants in this
 * app: they come from the TenantConfig that `proxy.ts` resolves per request
 * from the `Host` header. A browser client would need them in the bundle, and a
 * SHARED multi-tenant bundle cannot carry any one tenant's key — that is the
 * exact leak `lib/medusa.ts` was rewritten to prevent. Everything therefore
 * goes through Server Actions: the key stays server-side, the browser talks
 * only to its own origin, and no CORS entry is needed per tenant domain.
 *
 * Every function returns a `CartActionResult`. Failures are values, not thrown
 * exceptions — a cart that cannot reach the backend must still render.
 */

import "server-only";

import type Medusa from "@medusajs/js-sdk";
import { getSdkForTenant, isBackendConfigured } from "@/lib/medusa";
import { getTenantContext } from "@/lib/tenant/context";
import { getCurrentRegionId } from "@/lib/data";
import type { TenantConfig } from "@/lib/tenant/types";
import { toCartState } from "./adapter";
import { clearCartId, readCartId, writeCartId } from "./cookie";
import {
  planAdd,
  planCorrectionAfterCreate,
  planRemove,
  planSetQuantity,
  type CartMutation,
} from "./plan";
import { EMPTY_CART, type CartActionResult, type CartState } from "./types";

/**
 * The field list for EVERY cart read and mutation response, so the shape never
 * varies by call site.
 *
 * Only `+`/`*` prefixed entries: those ADD to the route's defaults instead of
 * replacing them. `items.total` is the one that matters — it is NOT in the
 * defaults, and without it the drawer would have to multiply `unit_price` by
 * `quantity` itself, which can drift a rappen from `item_total`.
 */
const CART_FIELDS = "+items.total,+items.original_total,*payment_collection";

const NETWORK_ERROR =
  "Der Warenkorb ist gerade nicht erreichbar. Bitte in einem Moment nochmals versuchen.";

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: number }).status === 404
  );
}

/**
 * Fehler aus dem Medusa-SDK lesbar protokollieren.
 *
 * ⚠️ WARUM NICHT NUR `error.message`: Das JS-SDK wirft bei jedem
 * Serverfehler einen Error, dessen `message` schlicht «An unknown error
 * occurred.» lautet. Status und Ursache haengen als eigene Felder daran und
 * gingen bisher verloren — im Log stand dreimal dieselbe nichtssagende Zeile,
 * waehrend die eigentliche Auskunft danebenlag.
 *
 * Ausgegeben werden deshalb zusaetzlich `status` und alles, was das SDK an
 * Serverantwort mitfuehrt. KEINE Kopfzeilen und kein Anfragerumpf: dort
 * stecken Publishable Key und Adressdaten, und Containerlogs werden
 * weitergereicht, archiviert und in Fehlerberichte kopiert.
 */
function logCartError(where: string, error: unknown) {
  const parts: string[] = [
    error instanceof Error ? error.message : String(error),
  ];

  const e = (error ?? {}) as Record<string, unknown>;

  const status = e.status ?? e.statusCode;
  if (status != null) parts.push(`status=${String(status)}`);

  const type = e.type ?? e.code;
  if (type != null) parts.push(`type=${String(type)}`);

  // Das SDK legt die Serverantwort je nach Pfad unterschiedlich ab.
  const body = e.response ?? e.body ?? e.data;
  if (body != null) {
    let rendered: string;
    try {
      rendered = typeof body === "string" ? body : JSON.stringify(body);
    } catch {
      rendered = String(body);
    }
    // Deckeln, damit ein HTML-Fehlerdokument das Log nicht flutet.
    parts.push(`response=${rendered.slice(0, 500)}`);
  }

  console.error(`[cart] ${where}: ${parts.join(" | ")}`);
}

interface CartContext {
  tenant: TenantConfig;
  sdk: Medusa;
}

async function cartContext(): Promise<CartContext | null> {
  const tenant = await getTenantContext();
  if (!isBackendConfigured(tenant)) return null;
  return { tenant, sdk: getSdkForTenant(tenant) };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * The current cart, or an empty one.
 *
 * READ-ONLY BY DESIGN: this is what the root layout calls on every render, and
 * `cookies().set()` throws outside a Server Action. So no cookie is written and
 * NO CART IS CREATED here — an unknown or expired id simply yields an empty
 * cart, and the next mutation creates a fresh one.
 */
export async function readCartState(): Promise<CartState> {
  const cartId = await readCartId();
  if (!cartId) return EMPTY_CART;

  const ctx = await cartContext();
  if (!ctx) return EMPTY_CART;

  try {
    const { cart } = await ctx.sdk.store.cart.retrieve(cartId, {
      fields: CART_FIELDS,
    });
    // A cart that has been completed is an order now. Showing its lines would
    // invite the customer to "check out" something they already bought.
    if (cart.completed_at) return EMPTY_CART;
    return toCartState(cart);
  } catch (error) {
    if (!isNotFound(error)) logCartError("retrieve", error);
    return EMPTY_CART;
  }
}

/** Internal: the live cart plus its id, creating one if needed. Actions only. */
async function getOrCreateCart(
  ctx: CartContext,
): Promise<{ id: string; state: CartState }> {
  const existing = await readCartId();

  if (existing) {
    try {
      const { cart } = await ctx.sdk.store.cart.retrieve(existing, {
        fields: CART_FIELDS,
      });
      if (!cart.completed_at) return { id: cart.id, state: toCartState(cart) };
      // Completed — fall through and start a new cart below.
    } catch (error) {
      if (!isNotFound(error)) throw error;
      // Unknown id: the backend was reset, or the cookie survived a tenant
      // change. Start over rather than failing every mutation forever.
    }
  }

  const regionId = await getCurrentRegionId();
  const { cart } = await ctx.sdk.store.cart.create(
    regionId ? { region_id: regionId } : {},
    { fields: CART_FIELDS },
  );
  await writeCartId(cart.id);
  return { id: cart.id, state: toCartState(cart) };
}

// ---------------------------------------------------------------------------
// Mutating
// ---------------------------------------------------------------------------

async function applyMutation(
  ctx: CartContext,
  cartId: string,
  mutation: CartMutation,
): Promise<CartState | null> {
  switch (mutation.kind) {
    case "create": {
      const { cart } = await ctx.sdk.store.cart.createLineItem(
        cartId,
        { variant_id: mutation.variantId, quantity: mutation.quantity },
        { fields: CART_FIELDS },
      );
      return toCartState(cart);
    }
    case "update": {
      const { cart } = await ctx.sdk.store.cart.updateLineItem(
        cartId,
        mutation.itemId,
        { quantity: mutation.quantity },
        { fields: CART_FIELDS },
      );
      return toCartState(cart);
    }
    case "delete": {
      await ctx.sdk.store.cart.deleteLineItem(cartId, mutation.itemId);
      // The delete response carries a differently shaped payload, so re-read
      // rather than adapt a second shape.
      const { cart } = await ctx.sdk.store.cart.retrieve(cartId, {
        fields: CART_FIELDS,
      });
      return toCartState(cart);
    }
    case "noop":
      return null;
  }
}

/**
 * Run one planned mutation and hand back the resulting cart.
 *
 * `plan` receives the CURRENT server-side cart, not a client snapshot — the
 * client's idea of the cart can be stale, and `lib/cart/plan.ts` explains in
 * detail what a mis-planned add costs (CHF 60.00 for a CHF 33.60 basket).
 */
async function mutate(
  plan: (cart: CartState) => CartMutation,
  where: string,
): Promise<CartActionResult> {
  const ctx = await cartContext();
  if (!ctx) {
    return {
      ok: false,
      message: "Der Shop ist noch nicht mit dem Backend verbunden.",
      cart: EMPTY_CART,
    };
  }

  try {
    const { id, state } = await getOrCreateCart(ctx);
    const mutation = plan(state);
    const next = await applyMutation(ctx, id, mutation);
    if (!next) return { ok: true, cart: state };

    // See planCorrectionAfterCreate: a create that Medusa merged into an
    // existing line keeps the price it calculated for the delta quantity.
    if (mutation.kind === "create") {
      const line = next.lines.find((l) => l.variantId === mutation.variantId);
      const correction = planCorrectionAfterCreate(line, mutation.quantity);
      if (correction.kind !== "noop") {
        console.warn(
          `[cart] line for variant ${mutation.variantId} was merged by Medusa — re-pricing at the merged quantity`,
        );
        const corrected = await applyMutation(ctx, id, correction);
        if (corrected) return { ok: true, cart: corrected };
      }
    }

    return { ok: true, cart: next };
  } catch (error) {
    logCartError(where, error);
    return { ok: false, message: NETWORK_ERROR, cart: await readCartState() };
  }
}

export function addLineToCart(
  variantId: string,
  quantity: number,
): Promise<CartActionResult> {
  return mutate((cart) => planAdd(cart.lines, variantId, quantity), "addLine");
}

export function setLineQuantity(
  variantId: string,
  quantity: number,
): Promise<CartActionResult> {
  return mutate(
    (cart) => planSetQuantity(cart.lines, variantId, quantity),
    "setQuantity",
  );
}

export function removeCartLine(variantId: string): Promise<CartActionResult> {
  return mutate((cart) => planRemove(cart.lines, variantId), "removeLine");
}

/** Empties the cart line by line — Medusa has no "clear cart" route. */
export async function clearCart(): Promise<CartActionResult> {
  const ctx = await cartContext();
  const cartId = await readCartId();
  if (!ctx || !cartId) return { ok: true, cart: EMPTY_CART };

  try {
    const current = await readCartState();
    for (const line of current.lines) {
      try {
        await ctx.sdk.store.cart.deleteLineItem(cartId, line.id);
      } catch (error) {
        // The snapshot was taken before this loop's turn in the queue, so a
        // line can already be gone — another tab, a "remove" that landed
        // first. That is the outcome we wanted anyway; anything else is real.
        if (!isNotFound(error)) throw error;
      }
    }
    const { cart } = await ctx.sdk.store.cart.retrieve(cartId, {
      fields: CART_FIELDS,
    });
    return { ok: true, cart: toCartState(cart) };
  } catch (error) {
    logCartError("clear", error);
    return { ok: false, message: NETWORK_ERROR, cart: await readCartState() };
  }
}

// ---------------------------------------------------------------------------
// Shared with the checkout layer
// ---------------------------------------------------------------------------

export { CART_FIELDS, NETWORK_ERROR, cartContext, isNotFound, logCartError };
export type { CartContext };

/** The cart id, or null. Checkout steps operate on an existing cart only. */
export async function currentCartId(): Promise<string | null> {
  return readCartId();
}

export { clearCartId };
