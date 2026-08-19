"use client";

/**
 * LOCAL CART — module-level store + localStorage, exposed via Context.
 *
 * ⚠️ SEAM FOR THE MEDUSA BACKEND.
 * The Medusa backend is not up yet, so the cart lives entirely client-side.
 * Every mutation goes through one of four functions (`addLine`, `setQuantity`,
 * `removeLine`, `clear`). When the backend is ready, replace their bodies with
 * `sdk.store.cart.createLineItem` / `updateLineItem` / `deleteLineItem` and keep
 * the context surface identical — no consumer component changes.
 *
 * Why `useSyncExternalStore` rather than `useState` + an effect: localStorage is
 * an external store that does not exist during SSR. `getServerSnapshot` returns
 * an empty cart, so the server markup and the first client render always agree,
 * and React re-reads the snapshot right after subscribing to pick up the
 * hydrated value. That avoids both a hydration mismatch and a setState-in-effect
 * cascade.
 *
 * Prices are decimal CHF throughout. No cents conversion anywhere.
 */

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CartLine } from "@/lib/types";
import { SHIPPING } from "@/lib/config";
import { lineTotal } from "@/lib/pricing";

const STORAGE_KEY = "jibbit.cart.v1";

/** Stable empty reference — snapshots must be referentially stable. */
const EMPTY: readonly CartLine[] = Object.freeze([]);

// ---------------------------------------------------------------------------
// External store
// ---------------------------------------------------------------------------

let snapshot: readonly CartLine[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function readStorage(): readonly CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartLine[]) : EMPTY;
  } catch {
    // Corrupt JSON, or storage blocked (private mode) — start empty.
    return EMPTY;
  }
}

function writeStorage(lines: readonly CartLine[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Quota exceeded or storage blocked — the cart just won't persist.
  }
}

function update(next: (prev: readonly CartLine[]) => readonly CartLine[]) {
  snapshot = next(snapshot);
  writeStorage(snapshot);
  emit();
}

function subscribe(listener: () => void) {
  // Hydrate once, on the first subscription — i.e. after the initial client
  // render has already matched the server's empty cart.
  if (!hydrated) {
    hydrated = true;
    const stored = readStorage();
    if (stored.length > 0) snapshot = stored;
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => EMPTY;

// ---------------------------------------------------------------------------
// Mutations (the SDK seam)
// ---------------------------------------------------------------------------

function addLineToStore(line: Omit<CartLine, "quantity">, qty: number) {
  update((prev) => {
    const i = prev.findIndex((l) => l.variantId === line.variantId);
    if (i === -1) return [...prev, { ...line, quantity: qty }];
    const next = [...prev];
    next[i] = { ...next[i], quantity: next[i].quantity + qty };
    return next;
  });
}

function setQuantityInStore(variantId: string, qty: number) {
  update((prev) =>
    qty <= 0
      ? prev.filter((l) => l.variantId !== variantId)
      : prev.map((l) => (l.variantId === variantId ? { ...l, quantity: qty } : l)),
  );
}

function removeLineFromStore(variantId: string) {
  update((prev) => prev.filter((l) => l.variantId !== variantId));
}

function clearStore() {
  update(() => EMPTY);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface CartContextValue {
  lines: readonly CartLine[];
  /** Total item count, for the header badge. */
  count: number;
  /** Goods subtotal in CHF. */
  subtotal: number;
  /** Shipping cost given the current subtotal. */
  shipping: number;
  total: number;
  /** CHF still needed for free shipping; 0 once reached. */
  remainingForFreeShipping: number;
  /** 0..1 progress toward the free-shipping threshold. */
  freeShippingProgress: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addLine: (line: Omit<CartLine, "quantity">, qty?: number) => void;
  setQuantity: (variantId: string, qty: number) => void;
  removeLine: (variantId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/** Round to rappen — guards against float drift when summing line totals. */
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const lines = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((n, l) => n + l.quantity, 0);
    // Tier-aware: `l.price` is the rate at quantity 1, so multiplying it by the
    // quantity would show 24 x 1.95 = 46.80 for a basket Medusa charges 33.60
    // for. The drawer must not be more expensive than the checkout — that is
    // how you lose a customer just before they see the real price.
    const subtotal = round2(lines.reduce((sum, l) => sum + lineTotal(l), 0));
    const qualifies = subtotal >= SHIPPING.freeThreshold;
    const shipping = count === 0 || qualifies ? 0 : SHIPPING.flatRate;

    return {
      lines,
      count,
      subtotal,
      shipping,
      total: round2(subtotal + shipping),
      remainingForFreeShipping: qualifies
        ? 0
        : round2(SHIPPING.freeThreshold - subtotal),
      freeShippingProgress: Math.min(subtotal / SHIPPING.freeThreshold, 1),
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addLine: (line, qty = 1) => {
        addLineToStore(line, qty);
        setIsOpen(true); // Open the drawer so the customer stays on the page.
      },
      setQuantity: setQuantityInStore,
      removeLine: removeLineFromStore,
      clear: clearStore,
    };
  }, [lines, isOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
