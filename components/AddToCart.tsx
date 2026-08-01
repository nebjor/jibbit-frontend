"use client";

import { useState } from "react";
import { useCart } from "./CartProvider";
import { Price } from "./Price";
import type { ProductView } from "@/lib/types";
import styles from "./AddToCart.module.css";

/**
 * Variant selection + add to cart. On mobile this renders as a sticky bar
 * pinned to the bottom of the viewport so the CTA is always in thumb reach,
 * with safe-area padding so iOS's home indicator doesn't clip it.
 */
export function AddToCart({ product }: { product: ProductView }) {
  const { addLine } = useCart();
  const multi = product.variants.length > 1;
  // With a single variant there is nothing to choose, so preselect it.
  const [variantId, setVariantId] = useState<string | null>(
    multi ? null : (product.variants[0]?.id ?? null),
  );

  const selected = product.variants.find((v) => v.id === variantId);
  const canAdd = Boolean(selected?.inStock);

  return (
    <div className={styles.wrap}>
      {multi && (
        <fieldset className={styles.variants}>
          <legend className="eyebrow">Variante wählen</legend>
          <div className={styles.options}>
            {product.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                className={styles.option}
                aria-pressed={v.id === variantId}
                disabled={!v.inStock}
                onClick={() => setVariantId(v.id)}
              >
                {v.title}
                {!v.inStock && <span className={styles.oos}> · ausverkauft</span>}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className={styles.bar}>
        <div className={styles.barPrice}>
          <Price
            price={selected?.price ?? product.price}
            compareAt={selected?.compareAt ?? product.compareAt}
            currency={product.currency}
            size="md"
          />
        </div>
        <button
          type="button"
          className={styles.cta}
          disabled={!canAdd}
          onClick={() => {
            if (!selected) return;
            addLine({
              variantId: selected.id,
              productHandle: product.handle,
              title: product.title,
              variantTitle: multi ? selected.title : "",
              price: selected.price,
              compareAt: selected.compareAt,
            });
          }}
        >
          {!variantId
            ? "Variante wählen"
            : canAdd
              ? "In den Warenkorb"
              : "Ausverkauft"}
        </button>
      </div>
    </div>
  );
}
