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
 *
 * PRICES COME FROM MEDUSA. `l.unitPrice` and `l.lineTotal` are the numbers the
 * backend will charge, already quantity-break aware; this component does no
 * arithmetic. It used to call `lineUnitPrice(l)` / `lineTotal(l)` from
 * lib/pricing.ts, which recomputed the price client-side from tier data copied
 * onto the line — a second source of truth, and the reason a basket could be
 * quoted at one price here and charged at another at checkout.
 *
 * Quantity controls are disabled while a mutation is in flight: the operations
 * are network calls now, and a customer who taps "+" five times must not see
 * the count jump around as the responses land.
 */
export function CartDrawer() {
  const {
    lines,
    subtotal,
    shipping,
    shippingIsEstimate,
    total,
    isOpen,
    closeCart,
    setQuantity,
    stepFor,
    removeLine,
    count,
    isPending,
    error,
    notice,
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

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}

        {lines.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Noch nix drin.</p>
            <p className={styles.emptyText}>
              Kein Bock auf 6.&ndash; für Papers und Filter? Eben.
            </p>
            <Link href="/" className={styles.emptyCta} onClick={closeCart}>
              Zum Shop
            </Link>
          </div>
        ) : (
          <>
            <ul className={styles.list} data-busy={isPending ? "true" : "false"}>
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
                      {formatPrice(l.unitPrice)}
                      {l.quantity > 1 && (
                        <span className={styles.lineTotal}>
                          {" "}
                          &times; {l.quantity} = {formatPrice(l.lineTotal)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className={styles.lineActions}>
                    <div className={styles.qty}>
                      <button
                        // In Stufengrösse (24er Display: 48 -> 24 -> weg),
                        // wie bisher beim Einzelstück (1 -> weg).
                        onClick={() =>
                          setQuantity(
                            l.variantId,
                            Math.max(0, l.quantity - stepFor(l.variantId)),
                          )
                        }
                        disabled={isPending}
                        aria-label={`Menge von ${l.title} verringern`}
                      >
                        &minus;
                      </button>
                      <span className="tnum" aria-live="polite">
                        {l.quantity}
                      </span>
                      <button
                        onClick={() =>
                          setQuantity(l.variantId, l.quantity + stepFor(l.variantId))
                        }
                        disabled={isPending}
                        aria-label={`Menge von ${l.title} erhöhen`}
                      >
                        +
                      </button>
                    </div>
                    <button
                      className={styles.remove}
                      onClick={() => removeLine(l.variantId)}
                      disabled={isPending}
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
                  <dt>
                    Versand
                    {shippingIsEstimate && (
                      <span className={styles.estimate}> (geschätzt)</span>
                    )}
                  </dt>
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
              <Link
                href="/checkout"
                className={styles.checkout}
                onClick={closeCart}
              >
                Zur Kasse
              </Link>
              {shippingIsEstimate && (
                <p className={styles.soon}>
                  Versandkosten werden an der Kasse definitiv berechnet.
                </p>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
