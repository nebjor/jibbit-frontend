"use client";

import { formatAmount, formatPrice } from "@/lib/format";
import { activeTier, upgradeHint } from "@/lib/pricing";
import type { PriceTier } from "@/lib/types";
import { Price, SaveBadge } from "./Price";
import styles from "./PriceTable.module.css";

/**
 * Quantity-discount table for the selected variant.
 *
 * Two jobs, in this order:
 *   1. Show the customer where they currently stand.
 *   2. Make the next step one click away, not a mental arithmetic exercise.
 *
 * Every row is a button: clicking "ab 24 Stk." sets the quantity to 24. That
 * is the whole point — a table you can only read makes the customer do the
 * work of translating a rate into a basket.
 *
 * Renders nothing for a single flat price. That is what makes the "Kontaktiere
 * uns für Händlerpreise" fallback work without any special casing: a variant
 * with one price simply has no table.
 */
export function PriceTable({
  tiers,
  quantity,
  currency = "CHF",
  onPick,
}: {
  tiers: PriceTier[];
  quantity: number;
  currency?: string;
  onPick?: (quantity: number) => void;
}) {
  if (tiers.length < 2) return null;

  const current = activeTier(tiers, quantity);
  const hint = upgradeHint(tiers, quantity);
  const base = tiers[0].price;

  return (
    <section className={styles.wrap} aria-labelledby="pricetable-title">
      <h2 id="pricetable-title" className="eyebrow">
        Mengenrabatt
      </h2>

      <ul className={styles.rows}>
        {tiers.map((tier) => {
          const isActive = tier.minQuantity === current?.minQuantity;
          const off = Math.floor(((base - tier.price) / base) * 100);

          return (
            <li key={tier.minQuantity}>
              <button
                type="button"
                className={styles.row}
                aria-current={isActive ? "true" : undefined}
                onClick={() => onPick?.(tier.minQuantity)}
              >
                <span className={styles.range}>{rangeLabel(tier)}</span>
                <Price
                  price={tier.price}
                  compareAt={tier.compareAt}
                  currency={currency}
                  size="xs"
                  unit="Stk."
                />
                <span className={styles.off}>
                  {off > 0 && <SaveBadge percent={off} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {hint && (
        <button
          type="button"
          className={styles.hint}
          onClick={() => onPick?.(hint.atQuantity)}
        >
          Noch <strong>{hint.missing} Stk.</strong> bis {currency}{" "}
          {formatAmount(hint.nextPrice)} pro Stück — spare{" "}
          <strong>{formatPrice(hint.saves)}</strong>
        </button>
      )}
    </section>
  );
}

function rangeLabel(tier: PriceTier): string {
  if (tier.maxQuantity === null) return `ab ${tier.minQuantity} Stk.`;
  if (tier.maxQuantity === tier.minQuantity) return `${tier.minQuantity} Stk.`;
  return `${tier.minQuantity} – ${tier.maxQuantity} Stk.`;
}
