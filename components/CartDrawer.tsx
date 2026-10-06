"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { FreeShippingMeter } from "./FreeShippingMeter";
import { Price } from "./Price";
import { usePresence } from "./usePresence";
import { useScrollLock } from "./useScrollLock";
import { formatPrice } from "@/lib/format";
import styles from "./CartDrawer.module.css";

/**
 * Slide-over cart. Opens automatically on add-to-cart so the customer stays on
 * the product page (never navigate away after adding).
 *
 * BEWEGUNG: Das Panel schiebt sich von rechts herein, der Scrim blendet auf
 * (CartDrawer.module.css, gesteuert über `data-state`). Beim Schliessen
 * bleibt die Schublade im DOM, bis die Transition hinaus durch ist
 * (`usePresence`) — sonst gäbe es keine Austritts-Animation. Während des
 * Austritts ist sie `inert`: nicht fokussierbar, nicht klickbar.
 *
 * SCROLL-SPERRE ohne Layout-Shift: `useScrollLock` gleicht die Breite der
 * verschwindenden Scrollleiste aus (lib/scroll-lock.ts) — vorher sprang der
 * Seiteninhalt bei jedem Öffnen und Schliessen um die halbe Leistenbreite.
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
    pickup,
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
  const presence = usePresence(isOpen, panelRef);

  // Gesperrt, solange die Schublade IM DOM ist — also auch während der
  // Schliess-Animation. Käme die Scrollleiste schon bei isOpen=false zurück,
  // spränge das hinausfahrende Panel um ihre Breite nach links (gemessen).
  useScrollLock(presence.mounted);

  // Escape to close + focus the panel once it is in the DOM. `preventScroll`:
  // the panel starts translated off-screen, and a scrolling focus would yank
  // it into view before the transition can run.
  useEffect(() => {
    if (!isOpen || !presence.mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, presence.mounted, closeCart]);

  if (!presence.mounted) return null;

  return (
    <div
      className={styles.overlay}
      data-state={presence.state}
      // Während der Schliess-Animation weder klick- noch fokussierbar.
      inert={!isOpen || undefined}
    >
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
        onTransitionEnd={presence.onTransitionEnd}
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
                    <p className={styles.linePrice}>
                      <Price
                        price={l.unitPrice}
                        compareAt={l.compareAtUnitPrice}
                        size="sm"
                      />
                      {l.quantity > 1 && (
                        <span className={`${styles.lineTotal} tnum`}>
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
                    {pickup ? "Abholung" : "Versand"}
                    {shippingIsEstimate && !pickup && (
                      <span className={styles.estimate}> (geschätzt)</span>
                    )}
                  </dt>
                  <dd className="tnum">
                    {pickup
                      ? formatPrice(0)
                      : shipping === 0
                        ? "Gratis"
                        : formatPrice(shipping)}
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
              {shippingIsEstimate && !pickup && (
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
