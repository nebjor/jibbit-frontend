"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { FreeShippingMeter } from "./FreeShippingMeter";
import { formatPrice } from "@/lib/format";
import styles from "./CartDrawer.module.css";

/**
 * Slide-over cart. Opens automatically on add-to-cart so the customer stays on
 * the product page (never navigate away after adding).
 */
export function CartDrawer() {
  const {
    lines,
    subtotal,
    shipping,
    total,
    isOpen,
    closeCart,
    setQuantity,
    removeLine,
    count,
  } = useCart();
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape to close + lock background scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, closeCart]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <button
        className={styles.scrim}
        onClick={closeCart}
        aria-label="Warenkorb schliessen"
        tabIndex={-1}
      />
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Warenkorb"
        ref={panelRef}
        tabIndex={-1}
      >
        <header className={styles.head}>
          <h2 className={styles.title}>
            Warenkorb{" "}
            {/* "Artikel" is invariant in the German plural. */}
            <span className={styles.count}>{count} Artikel</span>
          </h2>
          <button
            className={styles.close}
            onClick={closeCart}
            aria-label="Schliessen"
          >
            &times;
          </button>
        </header>

        {lines.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Noch nix drin.</p>
            <p className={styles.emptyText}>
              Kein Bock auf 6.&ndash; für Papers und Filter? Eben.
            </p>
            <Link href="/shop" className={styles.emptyCta} onClick={closeCart}>
              Zum Shop
            </Link>
          </div>
        ) : (
          <>
            <ul className={styles.list}>
              {lines.map((l) => (
                <li key={l.variantId} className={styles.line}>
                  <div className={styles.lineMain}>
                    <Link
                      href={`/products/${l.productHandle}`}
                      className={styles.lineTitle}
                      onClick={closeCart}
                    >
                      {l.title}
                    </Link>
                    {l.variantTitle && (
                      <p className={styles.lineVariant}>{l.variantTitle}</p>
                    )}
                    <p className={`${styles.linePrice} tnum`}>
                      {formatPrice(l.price)}
                    </p>
                  </div>
                  <div className={styles.lineActions}>
                    <div className={styles.qty}>
                      <button
                        onClick={() => setQuantity(l.variantId, l.quantity - 1)}
                        aria-label={`Menge von ${l.title} verringern`}
                      >
                        &minus;
                      </button>
                      <span className="tnum" aria-live="polite">
                        {l.quantity}
                      </span>
                      <button
                        onClick={() => setQuantity(l.variantId, l.quantity + 1)}
                        aria-label={`Menge von ${l.title} erhöhen`}
                      >
                        +
                      </button>
                    </div>
                    <button
                      className={styles.remove}
                      onClick={() => removeLine(l.variantId)}
                    >
                      Entfernen
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <footer className={styles.foot}>
              <FreeShippingMeter />
              <dl className={styles.totals}>
                <div>
                  <dt>Zwischensumme</dt>
                  <dd className="tnum">{formatPrice(subtotal)}</dd>
                </div>
                <div>
                  <dt>Versand</dt>
                  <dd className="tnum">
                    {shipping === 0 ? "Gratis" : formatPrice(shipping)}
                  </dd>
                </div>
                <div className={styles.grand}>
                  <dt>Total</dt>
                  <dd className="tnum">{formatPrice(total)}</dd>
                </div>
              </dl>
              {/* Primary CTA — the one accent-coloured action in this view. */}
              <button className={styles.checkout} disabled>
                Zur Kasse
              </button>
              <p className={styles.soon}>
                Checkout kommt, sobald die Zahlungsanbindung (TWINT, Powerpay)
                live ist.
              </p>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
