"use client";

/**
 * MEDUSA CART — one real server-side cart, mirrored into React state.
 *
 * ══ WHAT CHANGED, AND WHY ═════════════════════════════════════════════════
 * This used to be a localStorage array with a note saying "replace the four
 * mutation bodies when the backend is ready". The backend is ready. The four
 * mutations (`addLine`, `setQuantity`, `removeLine`, `clear`) now call Server
 * Actions that talk to Medusa; the cart id lives in an httpOnly cookie
 * (lib/cart/cookie.ts), not in localStorage.
 *
 * The context surface is deliberately almost identical — `CartDrawer`,
 * `CartButton` and `FreeShippingMeter` needed no structural change. Three
 * things had to be added, because the operations are now network calls:
 *
 *   isPending  — a mutation is in flight. Consumers disable their controls;
 *                without it, a customer can queue five clicks and watch the
 *                quantity jump around as the responses land.
 *   error      — the backend can be unreachable. A cart that silently ignores
 *                an "add to cart" click is worse than one that says so.
 *   applyCart  — the checkout steps get a fresh cart back from their own
 *                actions and push it in here, so the drawer and the checkout
 *                summary can never show different totals.
 *
 * ══ NO PRICES ARE COMPUTED HERE ═══════════════════════════════════════════
 * `subtotal` and `total` come from Medusa (`item_total` / `total`). The old
 * implementation summed `lineTotal(line)` locally, which is exactly how a
 * drawer starts disagreeing with the checkout. `lib/pricing.ts` still serves
 * the product page, where there is no cart to ask.
 *
 * The one number that IS derived locally is shipping BEFORE a delivery method
 * exists — Medusa reports 0 until then, and showing "Versand: gratis" to
 * someone who will be charged CHF 4.50 is not an option. It is flagged as an
 * estimate (`shippingIsEstimate`) and uses the same rule as the backend
 * provider; see lib/cart/shipping.ts.
 *
 * ══ MUTATIONS ARE SERIALISED ══════════════════════════════════════════════
 * Each mutation plans itself from the CURRENT SERVER CART, so two overlapping
 * "+1" clicks must not both read quantity 20 and both write 21. They are
 * chained through `queue`, so they apply in order.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  addLineAction,
  clearCartAction,
  removeLineAction,
  setQuantityAction,
} from "@/app/actions/cart";
import {
  estimateShipping,
  freeShippingProgress,
  remainingForFreeShipping,
} from "@/lib/cart/shipping";
import { NETWORK_ERROR } from "@/lib/cart/recover";
import type {
  CartActionResult,
  CartLineView,
  CartState,
} from "@/lib/cart/types";
import { EMPTY_CART } from "@/lib/cart/types";
import type { CartLine } from "@/lib/types";

/**
 * What `AddToCart` hands over. Only `variantId` reaches the backend — the
 * price, tiers and titles in here are the PRODUCT PAGE's view of the line, and
 * sending any of them would be actively harmful: a `unit_price` in the request
 * is treated by Medusa as a custom price and taken at face value. They are
 * accepted and ignored so the call site did not have to change.
 */
export type AddLineInput = Omit<CartLine, "quantity">;

interface CartContextValue {
  /** Medusa cart id, or null when nothing has been added yet. */
  cartId: string | null;
  lines: readonly CartLineView[];
  /** Total item count, for the header badge. */
  count: number;
  /** Goods subtotal in CHF, gross — Medusa's `item_total`. */
  subtotal: number;
  /** Shipping in CHF. Estimated until a delivery method is on the cart. */
  shipping: number;
  /** True while `shipping` is the storefront's estimate, not Medusa's charge. */
  shippingIsEstimate: boolean;
  /** In `total` enthaltene Steuer (Medusas `tax_total`), 0 wenn keine anfällt. */
  taxTotal: number;
  /** True once a delivery method is on the cart, i.e. `shipping` is binding. */
  hasShippingMethod: boolean;
  /**
   * Abholung im Laden gewählt (lib/checkout/pickup.ts). Dann ist `shipping`
   * 0 — auch als Schätzung — und der Gratisversand-Hinweis entfällt.
   */
  pickup: boolean;
  total: number;
  currency: string;
  /** Guest e-mail on the cart, or null. Set in the checkout's first step. */
  email: string | null;
  /** True once a delivery address is on the cart. */
  hasShippingAddress: boolean;
  /** CHF still needed for free shipping; 0 once reached. */
  remainingForFreeShipping: number;
  /** 0..1 progress toward the free-shipping threshold. */
  freeShippingProgress: number;
  /** A cart mutation is in flight. */
  isPending: boolean;
  /** Last failure, in German, or null. */
  error: string | null;
  /** Non-failure news from the last mutation, e.g. items that were removed. */
  notice: string | null;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addLine: (line: AddLineInput, qty?: number) => void;
  setQuantity: (variantId: string, qty: number) => void;
  /**
   * Schrittweite der +/−-Knöpfe für diese Zeile: die Preisstufe, mit der sie
   * in den Warenkorb kam (24er Display -> 24), sonst 1. Lebt nur im Browser
   * (localStorage) — reine Bedienhilfe, der Preis kommt immer von Medusa.
   */
  stepFor: (variantId: string) => number;
  removeLine: (variantId: string) => void;
  clear: () => void;
  /** Replace the whole cart — used by the checkout steps. */
  applyCart: (cart: CartState) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/** localStorage-Schlüssel für die Schrittweiten je Variante. */
const STEPS_KEY = "jibbit-cart-steps";

/** Round to rappen — guards against float drift in the shipping estimate. */
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function CartProvider({
  initialCart = EMPTY_CART,
  children,
}: {
  /**
   * Rendered server-side by the root layout, so the header badge is correct in
   * the very first paint — no hydration mismatch, no count flashing from 0.
   */
  initialCart?: CartState;
  children: ReactNode;
}) {
  const [cart, setCart] = useState<CartState>(initialCart);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Schrittweiten je Variante. Nur in Klick-Handlern gebraucht, deshalb ein
  // Ref, der beim ersten Zugriff aus localStorage gelesen wird — kein State,
  // kein Effekt, kein Hydration-Thema.
  const steps = useRef<Record<string, number> | null>(null);
  const loadSteps = useCallback((): Record<string, number> => {
    if (steps.current) return steps.current;
    try {
      const raw = window.localStorage.getItem(STEPS_KEY);
      steps.current = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch {
      // Kein Speicher (privates Fenster o.ä.) — dann eben Einerschritte.
      steps.current = {};
    }
    return steps.current;
  }, []);
  const rememberStep = useCallback(
    (variantId: string, step: number) => {
      const next = { ...loadSteps(), [variantId]: step };
      steps.current = next;
      try {
        window.localStorage.setItem(STEPS_KEY, JSON.stringify(next));
      } catch {
        // siehe oben
      }
    },
    [loadSteps],
  );

  /** Serialises mutations; see the header. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const run = useCallback(
    (operation: () => Promise<CartActionResult>) => {
      const previous = queue.current;
      // Run regardless of how the previous mutation ended — one failure must
      // not wedge the queue for the rest of the session.
      const next = previous.then(
        () => operation(),
        () => operation(),
      );
      queue.current = next.then(
        () => undefined,
        () => undefined,
      );

      startTransition(async () => {
        try {
          const result = await next;
          setCart(result.cart);
          setError(result.ok ? null : result.message);
          setNotice(result.ok ? (result.notice ?? null) : null);
        } catch {
          setError(NETWORK_ERROR);
        }
      });
    },
    [],
  );

  const value = useMemo<CartContextValue>(() => {
    const shippingIsEstimate = !cart.hasShippingMethod && cart.count > 0;
    // Abholung kostet nichts — auch die Schätzung vor der Methode ist 0.
    const shipping = cart.hasShippingMethod
      ? cart.shipping
      : cart.pickup
        ? 0
        : estimateShipping(cart.subtotal);
    const total = cart.hasShippingMethod
      ? cart.total
      : round2(cart.subtotal + shipping);

    return {
      cartId: cart.id,
      lines: cart.lines,
      count: cart.count,
      subtotal: cart.subtotal,
      shipping,
      shippingIsEstimate,
      taxTotal: cart.taxTotal ?? 0,
      hasShippingMethod: cart.hasShippingMethod,
      pickup: cart.pickup,
      total,
      currency: cart.currency,
      email: cart.email,
      hasShippingAddress: cart.hasShippingAddress,
      // Bei Abholung gibt es nichts freizuschalten — der Hinweis entfällt
      // (FreeShippingMeter), die Zahlen bleiben für die Lieferung gültig.
      remainingForFreeShipping: cart.pickup ? 0 : remainingForFreeShipping(cart.subtotal),
      freeShippingProgress: freeShippingProgress(cart.subtotal),
      isPending,
      error,
      notice,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addLine: (line, qty = 1) => {
        // Open immediately rather than after the round trip: the drawer is how
        // the customer knows the click registered.
        setIsOpen(true);
        rememberStep(
          line.variantId,
          Number.isInteger(line.step) && (line.step ?? 0) > 0 ? line.step! : 1,
        );
        run(() => addLineAction(line.variantId, qty));
      },
      setQuantity: (variantId, qty) =>
        run(() => setQuantityAction(variantId, qty)),
      stepFor: (variantId) => loadSteps()[variantId] ?? 1,
      removeLine: (variantId) => run(() => removeLineAction(variantId)),
      clear: () => run(() => clearCartAction()),
      applyCart: (next) => {
        setCart(next);
        setError(null);
        setNotice(null);
      },
    };
  }, [cart, error, notice, isOpen, isPending, run, loadSteps, rememberStep]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
