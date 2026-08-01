"use client";

import { useCart } from "./CartProvider";
import styles from "./CartButton.module.css";

/**
 * Cart indicator. Always visible — never hidden inside the mobile hamburger.
 * The count carries aria-live so screen readers announce cart changes.
 */
export function CartButton() {
  const { count, openCart, ready } = useCart();

  return (
    <button className={styles.btn} onClick={openCart} aria-label="Warenkorb öffnen">
      <span className={styles.label}>Warenkorb</span>
      <span className={styles.badge} aria-live="polite" aria-atomic="true">
        <span className="tnum">{ready ? count : 0}</span>
        <span className="srOnly">
          {" "}
          {ready && count === 1 ? "Artikel im Warenkorb" : "Artikel im Warenkorb"}
        </span>
      </span>
    </button>
  );
}
