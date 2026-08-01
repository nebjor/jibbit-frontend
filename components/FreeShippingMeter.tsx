"use client";

import { useCart } from "./CartProvider";
import { formatPrice } from "@/lib/format";
import { SHIPPING } from "@/lib/config";
import styles from "./FreeShippingMeter.module.css";

/**
 * "Noch CHF X bis Gratisversand" — the single strongest AOV lever in the cart.
 * Reads straight off local cart state.
 */
export function FreeShippingMeter() {
  const { subtotal, remainingForFreeShipping, freeShippingProgress, count } =
    useCart();

  if (count === 0) return null;

  const reached = remainingForFreeShipping <= 0;

  return (
    <div className={styles.wrap}>
      <p className={styles.label} aria-live="polite">
        {reached ? (
          <>
            <strong className={styles.win}>Gratisversand</strong> freigeschaltet
            — nice.
          </>
        ) : (
          <>
            Noch{" "}
            <strong className="tnum">
              {formatPrice(remainingForFreeShipping)}
            </strong>{" "}
            bis Gratisversand
          </>
        )}
      </p>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={SHIPPING.freeThreshold}
        aria-valuenow={Math.min(subtotal, SHIPPING.freeThreshold)}
        aria-label="Fortschritt bis Gratisversand"
      >
        <div
          className={styles.fill}
          data-reached={reached ? "true" : "false"}
          style={{ width: `${Math.round(freeShippingProgress * 100)}%` }}
        />
      </div>
      {!reached && (
        <p className={styles.hint}>
          Versand {formatPrice(SHIPPING.flatRate)} · gratis ab{" "}
          {formatPrice(SHIPPING.freeThreshold)}
        </p>
      )}
    </div>
  );
}
