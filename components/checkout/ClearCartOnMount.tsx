"use client";

import { useEffect } from "react";
import { useCart } from "@/components/CartProvider";
import { EMPTY_CART } from "@/lib/cart/types";

/**
 * Empties the client-side cart once the confirmation page renders.
 *
 * The cart cookie is already cleared server-side when the order is created, but
 * the root layout does not re-render on a client-side navigation, so the
 * provider would still be holding the old lines and the header badge would keep
 * showing them. This is the client half of that cleanup.
 */
export function ClearCartOnMount() {
  const { applyCart } = useCart();

  useEffect(() => {
    applyCart(EMPTY_CART);
    // Once, on mount. `applyCart` is stable enough for this purpose and adding
    // it to the deps would re-run the effect on every cart change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
