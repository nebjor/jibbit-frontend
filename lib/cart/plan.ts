/**
 * WHICH REQUEST TO SEND FOR A CART CHANGE — pure, no network, no React.
 *
 * ══ WHY THIS FILE EXISTS ══════════════════════════════════════════════════
 * `POST /store/carts/:id/line-items` for a variant that is ALREADY in the cart
 * does not do what it looks like it does. Medusa merges the two lines
 * (`getLineItemActionsStep`) but keeps the unit price it calculated for the
 * quantity in THIS request — the delta, not the merged total. `addToCartWorkflow`
 * then calls `refreshCartItemsWorkflow` WITHOUT `force_refresh`, so nothing
 * re-prices the merged line.
 *
 * Measured against a real Medusa 2.13.6 with a 1/10/24 quantity break
 * (2.50 / 1.95 / 1.40):
 *
 *   add 24 at once                 -> 24 x 1.40 = CHF  33.60   correct
 *   add 1, then update to 24       -> 24 x 1.40 = CHF  33.60   correct
 *   add 20, then add 4 more        -> 24 x 2.50 = CHF  60.00   WRONG
 *
 * CHF 60.00 for a basket worth CHF 33.60 — and "put 20 in the cart, come back,
 * add 4 more" is an ordinary customer path, not an edge case.
 *
 * So: a variant already in the cart is never added to. It is UPDATED to the new
 * absolute quantity, which `updateLineItemInCartWorkflow` prices with
 * `quantity: update.quantity` — the correct, merged quantity.
 *
 * Keeping this decision as a pure function (rather than inline in the server
 * action) is deliberate: it is the one piece of cart logic whose failure costs
 * real money, and this way it is unit-testable without a backend.
 */

import type { CartLineView } from "./types";

export type CartMutation =
  | { kind: "create"; variantId: string; quantity: number }
  | { kind: "update"; itemId: string; quantity: number }
  | { kind: "delete"; itemId: string }
  | { kind: "noop" };

/** Medusa rejects quantities above this; the PDP stepper caps at the same value. */
export const MAX_LINE_QUANTITY = 999;

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 0;
  return Math.min(MAX_LINE_QUANTITY, Math.max(0, Math.floor(quantity)));
}

function findLine(
  lines: readonly CartLineView[],
  variantId: string,
): CartLineView | undefined {
  return lines.find((l) => l.variantId === variantId);
}

/**
 * "Add `quantity` of this variant."
 *
 * Existing line -> update to `existing + quantity` (absolute). Never a second
 * create; see the file header for what that costs.
 */
export function planAdd(
  lines: readonly CartLineView[],
  variantId: string,
  quantity: number,
): CartMutation {
  const qty = clampQuantity(quantity);
  if (qty <= 0) return { kind: "noop" };

  const existing = findLine(lines, variantId);
  if (!existing) return { kind: "create", variantId, quantity: qty };

  const merged = clampQuantity(existing.quantity + qty);
  if (merged === existing.quantity) return { kind: "noop" };
  return { kind: "update", itemId: existing.id, quantity: merged };
}

/** "Set this variant to exactly `quantity`." 0 or less removes the line. */
export function planSetQuantity(
  lines: readonly CartLineView[],
  variantId: string,
  quantity: number,
): CartMutation {
  const existing = findLine(lines, variantId);
  if (!existing) return { kind: "noop" };

  const qty = clampQuantity(quantity);
  if (qty <= 0) return { kind: "delete", itemId: existing.id };
  if (qty === existing.quantity) return { kind: "noop" };
  return { kind: "update", itemId: existing.id, quantity: qty };
}

/**
 * Neue Menge nach einem Klick auf "−" (-1) oder "+" (+1) im Warenkorb.
 *
 * IMMER Einerschritte. Früher stand hier die Stufengrösse, mit der die Zeile
 * in den Warenkorb kam (Chip "50" -> Schritt 50): "−" auf 50 ergab 0 und
 * löschte die ganze Zeile. Die Stufen-Chips gehören auf die Produktseite; der
 * Preis je Stufe kommt ohnehin von Medusa. Bei 1 bleibt "−" bei 1 — die Zeile
 * verschwindet nur über "Entfernen" (planRemove).
 */
export function stepQuantity(quantity: number, direction: 1 | -1): number {
  return Math.max(1, clampQuantity(quantity + direction));
}

export function planRemove(
  lines: readonly CartLineView[],
  variantId: string,
): CartMutation {
  const existing = findLine(lines, variantId);
  return existing ? { kind: "delete", itemId: existing.id } : { kind: "noop" };
}

/**
 * Belt and braces after a `create`.
 *
 * `planAdd` only knows the cart as it looked when the page last read it. If a
 * line for the same variant appeared in between — a second tab, a stale
 * snapshot, a retried request — Medusa silently merges our create into it and
 * mis-prices the result exactly as described in the file header.
 *
 * The tell is cheap and needs no price data: a create that was NOT merged
 * produces a line whose quantity equals what we asked for. Anything else means
 * a merge happened, and an absolute-quantity update re-prices it correctly.
 *
 * Returns `noop` when the line came out as requested, which is the normal case.
 */
export function planCorrectionAfterCreate(
  line: CartLineView | undefined,
  requestedQuantity: number,
): CartMutation {
  if (!line) return { kind: "noop" };
  const requested = clampQuantity(requestedQuantity);
  if (line.quantity === requested) return { kind: "noop" };
  return { kind: "update", itemId: line.id, quantity: line.quantity };
}
