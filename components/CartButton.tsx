"use client";

import { useCart } from "./CartProvider";
import styles from "./CartButton.module.css";

/**
 * Cart indicator. Always visible — never hidden inside the mobile hamburger.
 * The count carries aria-live so screen readers announce cart changes.
 */
export function CartButton() {
  const { count, openCart } = useCart();

  return (
    <button className={styles.btn} onClick={openCart} aria-label="Warenkorb öffnen">
      <span className={styles.label}>Warenkorb</span>
      {/* aria-live so screen readers announce cart changes. */}
      <span className={styles.badge} aria-live="polite" aria-atomic="true">
        <span className="tnum">{count}</span>
        <span className="srOnly"> Artikel im Warenkorb</span>
      </span>
    </button>
  );
}
