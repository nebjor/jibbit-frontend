"use client";

import { useMemo, useState } from "react";
import { useCart } from "./CartProvider";
import { trackAddToCart } from "@/lib/analytics/client";
import { Price } from "./Price";
import { PriceTable } from "./PriceTable";
import { formatAmount, formatPrice } from "@/lib/format";
import {
  defaultVariant,
  packAdvantagePercent,
  pricePerUnit,
  unitPriceFor,
} from "@/lib/pricing";
import type { ProductView } from "@/lib/types";
import styles from "./AddToCart.module.css";

const MAX_QUANTITY = 999;

/**
 * Variant selection + quantity + add to cart. On mobile the CTA renders as a
 * sticky bar pinned to the bottom of the viewport so it is always in thumb
 * reach, with safe-area padding so iOS's home indicator doesn't clip it.
 *
 * The cheapest variant is PRESELECTED, deliberately. Leaving the choice empty
 * costs a click and dead-ends the CTA; preselecting a display would mean a
 * customer who misses the selector adds CHF 33.60 instead of CHF 1.95. The
 * upsell lives in the price table, where it is transparent and reversible —
 * not in a default nobody chose.
 */
export function AddToCart({ product }: { product: ProductView }) {
  // `isPending` is new: adding to the cart is a network round trip now, so the
  // CTA has to stop accepting clicks until it lands. Everything else about this
  // component — including the shape of the object handed to `addLine` — is
  // unchanged; the cart layer reads `variantId` and ignores the rest.
  const { addLine, isPending } = useCart();
  const multi = product.variants.length > 1;

  const [variantId, setVariantId] = useState<string | null>(
    () => defaultVariant(product.variants)?.id ?? null,
  );
  const [quantity, setQuantity] = useState(1);

  const selected = product.variants.find((v) => v.id === variantId);
  const canAdd = Boolean(selected?.inStock);

  const single = useMemo(
    () => product.variants.find((v) => v.packType === "single"),
    [product.variants],
  );

  const unitPrice = selected
    ? unitPriceFor(selected.tiers, quantity, selected.price)
    : product.price;

  const perUnit = selected ? pricePerUnit(selected, quantity) : null;
  const lineTotal = unitPrice * quantity;

  const setQuantitySafely = (next: number) =>
    setQuantity(Math.min(MAX_QUANTITY, Math.max(1, Math.floor(next) || 1)));

  return (
    <div className={styles.wrap}>
      {multi && (
        <fieldset className={styles.variants}>
          <legend className="eyebrow">Verpackungseinheit</legend>
          <div className={styles.options}>
            {product.variants.map((v) => {
              const advantage = packAdvantagePercent(v, single);
              return (
                <button
                  key={v.id}
                  type="button"
                  className={styles.option}
                  aria-pressed={v.id === variantId}
                  disabled={!v.inStock}
                  onClick={() => {
                    setVariantId(v.id);
                    // A quantity that made sense for singles rarely does for a
                    // display — 24 displays is not what anyone meant to click.
                    setQuantity(1);
                  }}
                >
                  {v.title}
                  {advantage !== null && (
                    <span className={styles.deal}>Bestes Angebot −{advantage}%</span>
                  )}
                  {!v.inStock && <span className={styles.oos}> · ausverkauft</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {selected && (
        <PriceTable
          tiers={selected.tiers}
          quantity={quantity}
          currency={product.currency}
          onPick={setQuantitySafely}
        />
      )}

      <div className={styles.quantity}>
        <label htmlFor="qty" className="eyebrow">
          Menge
        </label>
        <div className={styles.stepper}>
          <button
            type="button"
            className={styles.step}
            aria-label="Menge verringern"
            disabled={quantity <= 1}
            onClick={() => setQuantitySafely(quantity - 1)}
          >
            &minus;
          </button>
          <input
            id="qty"
            className={`${styles.qtyInput} tnum`}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_QUANTITY}
            value={quantity}
            onChange={(e) => setQuantitySafely(Number(e.target.value))}
          />
          <button
            type="button"
            className={styles.step}
            aria-label="Menge erhöhen"
            disabled={quantity >= MAX_QUANTITY}
            onClick={() => setQuantitySafely(quantity + 1)}
          >
            +
          </button>
        </div>

        {perUnit !== null && (
          <span className={styles.perUnit}>
            {product.currency} {formatAmount(perUnit)} / Stk.
          </span>
        )}
      </div>

      <div className={styles.bar}>
        <div className={styles.barPrice}>
          <Price
            price={unitPrice}
            compareAt={selected?.compareAt ?? product.compareAt}
            currency={product.currency}
            size="md"
          />
          {quantity > 1 && (
            <span className={styles.total}>
              Total {formatPrice(lineTotal)}
            </span>
          )}
        </div>
        <button
          type="button"
          className={styles.cta}
          disabled={!canAdd || isPending}
          onClick={() => {
            if (!selected) return;
            // Analyse: Katalogdaten und Menge — keine Personendaten. Stilles
            // No-op ohne Einwilligung oder ohne PostHog-Schlüssel.
            trackAddToCart(product, selected, quantity, unitPrice);
            addLine(
              {
                variantId: selected.id,
                productHandle: product.handle,
                title: product.title,
                variantTitle: multi ? selected.title : "",
                price: selected.price,
                compareAt: selected.compareAt,
                // Carried along so the cart can reprice itself when the
                // customer changes the quantity there.
                tiers: selected.tiers,
                unitsPerPack: selected.unitsPerPack,
              },
              quantity,
            );
          }}
        >
          {!canAdd
            ? "Ausverkauft"
            : isPending
              ? "Wird hinzugefügt …"
              : "In den Warenkorb"}
        </button>
      </div>
    </div>
  );
}
