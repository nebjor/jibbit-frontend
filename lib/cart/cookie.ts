import "server-only";

import { cookies } from "next/headers";

/**
 * WHERE THE CART LIVES NOW.
 *
 * The cart used to be a localStorage array. It is now a real Medusa cart, and
 * the browser holds nothing but its id — in an httpOnly cookie, so no client
 * script can read or forge it and the id never reaches the JS bundle.
 *
 * MULTI-TENANCY: the cookie is set WITHOUT a `Domain` attribute, so the browser
 * scopes it to the exact host that set it. Tenant A's cart id is therefore
 * never sent to tenant B — the isolation is the browser's, not ours to get
 * wrong. Do not add a `Domain` attribute here; that would share one cart id
 * across every subdomain tenant on the platform.
 *
 * ⚠️ `cookies().set()` throws outside a Server Action or Route Handler. Reads
 * are fine anywhere. That is why `readCartId` is separate and why nothing on
 * the rendering path (layout, pages) ever creates a cart.
 */

const CART_COOKIE = "jibbit_cart_id";

/** A year: long enough that an abandoned cart is still there on a return visit. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export async function readCartId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(CART_COOKIE)?.value;
  return value && value.length > 0 ? value : null;
}

/** Server Actions / Route Handlers only. */
export async function writeCartId(cartId: string): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE, cartId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/**
 * Server Actions / Route Handlers only.
 *
 * Called when an order completes — a completed cart cannot be mutated, so
 * keeping the id would leave the customer with a cart they can never add to
 * again — and when a cart id no longer resolves (purged backend, wrong tenant).
 */
export async function clearCartId(): Promise<void> {
  const store = await cookies();
  store.delete(CART_COOKIE);
}
