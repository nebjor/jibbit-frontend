"use client";

/**
 * LOCAL CART — Context + localStorage.
 *
 * ⚠️ SEAM FOR THE MEDUSA BACKEND.
 * The Medusa backend is not up yet, so the cart lives entirely client-side.
 * Every mutation below is a single function (`addLine`, `setQuantity`,
 * `removeLine`, `clear`). When the backend is ready, replace the bodies with
 * `sdk.store.cart.createLineItem` / `updateLineItem` / `deleteLineItem` and
 * keep the same context surface — no consumer component changes.
 *
 * Prices are decimal CHF throughout. No cents conversion anywhere.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { CartLine } from "@/lib/types";
import { SHIPPING } from "@/lib/config";

const STORAGE_KEY = "jibbit.cart.v1";

interface CartContextValue {
  lines: CartLine[];
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
  /** Hydrated from localStorage yet? Guards against SSR mismatch. */
  ready: boolean;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addLine: (line: Omit<CartLine, "quantity">, qty?: number) => void;
  setQuantity: (variantId: string, qty: number) => void;
  removeLine: (variantId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Hydrate after mount so server and client markup match.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setLines(parsed as CartLine[]);
      }
    } catch {
      /* corrupt or unavailable storage — start empty */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* quota / private mode — cart just won't persist */
    }
  }, [lines, ready]);

  const addLine = useCallback(
    (line: Omit<CartLine, "quantity">, qty = 1) => {
      setLines((prev) => {
        const i = prev.findIndex((l) => l.variantId === line.variantId);
        if (i === -1) return [...prev, { ...line, quantity: qty }];
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + qty };
        return next;
      });
      setIsOpen(true);
    },
    [],
  );

  const setQuantity = useCallback((variantId: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.variantId !== variantId)
        : prev.map((l) => (l.variantId === variantId ? { ...l, quantity: qty } : l)),
    );
  }, []);

  const removeLine = useCallback((variantId: string) => {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((n, l) => n + l.quantity, 0);
    const subtotal = round2(
      lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
    );
    const qualifies = subtotal >= SHIPPING.freeThreshold;
    const shipping = count === 0 || qualifies ? 0 : SHIPPING.flatRate;
    const remaining = qualifies ? 0 : round2(SHIPPING.freeThreshold - subtotal);

    return {
      lines,
      count,
      subtotal,
      shipping,
      total: round2(subtotal + shipping),
      remainingForFreeShipping: remaining,
      freeShippingProgress: Math.min(subtotal / SHIPPING.freeThreshold, 1),
      ready,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addLine,
      setQuantity,
      removeLine,
      clear,
    };
  }, [lines, ready, isOpen, addLine, setQuantity, removeLine, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
