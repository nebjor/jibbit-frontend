"use client";

import { useMemo, useState } from "react";
import { useCart } from "./CartProvider";
import { useVariantSelection } from "./VariantSelection";
import { useTierSelection } from "./TierSelection";
import { trackAddToCart } from "@/lib/analytics/client";
import { Price, SaveBadge } from "./Price";
import { PriceTable } from "./PriceTable";
import { formatAmount, formatPrice } from "@/lib/format";
import {
  activeTier,
  defaultVariant,
  packAdvantagePercent,
  pricePerUnit,
  savingAt,
  tierChips,
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
 * PREISSTUFEN (ein Produkt = eine Variante, Preistabelle im Admin): statt
 * Variantenwahl gibt es grosse Chips je Stufe — «1 Stück», «10 Stück»,
 * «24er Display» — mit Stückpreis und Ersparnis. Tippen setzt die Menge auf
 * die Stufe; +/− springen in Stufengrösse (24 → 48). Chip antippen, dann
 * den Warenkorb-Knopf — eine Tastatur braucht es nie.
 *
 * The cheapest variant is PRESELECTED, deliberately. Leaving the choice empty
 * costs a click and dead-ends the CTA; preselecting a display would mean a
 * customer who misses the selector adds CHF 33.60 instead of CHF 1.95. The
 * upsell lives in the price table, where it is transparent and reversible —
 * not in a default nobody chose.
 */
export function AddToCart({ product }: { product: ProductView }) {
  const { addLine, isPending } = useCart();
  const multi = product.variants.length > 1;

  // Die Auswahl lebt — wenn vorhanden — im VariantSelectionProvider der
  // Produktseite, damit die Galerie das Bild zur gewählten Variante zeigen
  // kann. Ohne Provider (Tests, andere Aufrufstellen) fällt der Baustein auf
  // seinen bisherigen lokalen State zurück; Verhalten unverändert.
  const selection = useVariantSelection();
  const [localVariantId, setLocalVariantId] = useState<string | null>(
    () => defaultVariant(product.variants)?.id ?? null,
  );
  const variantId = selection ? selection.selectedId : localVariantId;
  const setVariantId = selection ? selection.select : setLocalVariantId;

  // Gewählte Preisstufe — geteilt mit der Galerie (Stufenfoto nach vorn).
  const tierSelection = useTierSelection();
  const [localTier, setLocalTier] = useState(1);
  const tier = tierSelection ? tierSelection.tier : localTier;
  const setTier = tierSelection ? tierSelection.setTier : setLocalTier;

  const [quantity, setQuantity] = useState(1);

  const selected = product.variants.find((v) => v.id === variantId);
  const canAdd = Boolean(selected?.inStock);

  const single = useMemo(
    () => product.variants.find((v) => v.packType === "single"),
    [product.variants],
  );

  const chips = useMemo(
    () => (!multi && selected ? tierChips(selected.tiers, product.tierExtras) : []),
    [multi, selected, product.tierExtras],
  );
  const chipMode = chips.length > 1;
  // +/− springen in Stufengrösse; ohne Stufen in Einerschritten.
  const step = chipMode ? Math.max(1, tier) : 1;

  const unitPrice = selected
    ? unitPriceFor(selected.tiers, quantity, selected.price)
    : product.price;

  const perUnit = selected ? pricePerUnit(selected, quantity) : null;
  const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
  const saving = selected && chipMode ? savingAt(selected.tiers, quantity) : null;

  const setQuantitySafely = (next: number) =>
    setQuantity(Math.min(MAX_QUANTITY, Math.max(1, Math.floor(next) || 1)));

  const pickTier = (minQuantity: number) => {
    setTier(minQuantity);
    setQuantitySafely(minQuantity);
  };

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

      {chipMode ? (
        <fieldset className={styles.variants}>
          <legend className="eyebrow">Menge wählen</legend>
          <div className={styles.chips}>
            {chips.map((c) => (
              <button
                key={c.minQuantity}
                type="button"
                className={styles.chip}
                aria-pressed={c.minQuantity === tier}
                onClick={() => pickTier(c.minQuantity)}
              >
                <span className={styles.chipLabel}>{c.label}</span>
                <Price
                  price={c.price}
                  compareAt={c.compareAt}
                  currency={product.currency}
                  size="xs"
                  unit="Stk."
                />
                {c.savePercent > 0 ? (
                  <SaveBadge percent={c.savePercent} />
                ) : (
                  <span className={styles.chipBase}>Einzelpreis</span>
                )}
              </button>
            ))}
          </div>
        </fieldset>
      ) : (
        selected && (
          <PriceTable
            tiers={selected.tiers}
            quantity={quantity}
            currency={product.currency}
            onPick={setQuantitySafely}
          />
        )
      )}

      <div className={styles.quantity}>
        <span className="eyebrow" id="qty-label">
          Menge
        </span>
        <div className={styles.stepper} role="group" aria-labelledby="qty-label">
          <button
            type="button"
            className={styles.step}
            aria-label={step > 1 ? `${step} weniger` : "Menge verringern"}
            disabled={quantity - step < 1}
            onClick={() => setQuantitySafely(quantity - step)}
          >
            &minus;
          </button>
          <output className={`${styles.qtyValue} tnum`} aria-live="polite">
            {quantity}
          </output>
          <button
            type="button"
            className={styles.step}
            aria-label={step > 1 ? `${step} mehr` : "Menge erhöhen"}
            disabled={quantity + step > MAX_QUANTITY}
            onClick={() => setQuantitySafely(quantity + step)}
          >
            +
          </button>
        </div>

        {saving && saving.amount > 0 ? (
          <span className={styles.perUnit}>
            {product.currency} {formatAmount(unitPrice)} / Stk. ·{" "}
            <span className={styles.saving}>
              du sparst {formatPrice(saving.amount)}
            </span>{" "}
            <SaveBadge percent={saving.percent} />
          </span>
        ) : (
          perUnit !== null && (
            <span className={styles.perUnit}>
              {product.currency} {formatAmount(perUnit)} / Stk.
            </span>
          )
        )}
      </div>

      <div className={styles.bar}>
        <div className={styles.barPrice}>
          <Price
            price={unitPrice}
            compareAt={
              selected?.tiers.length
                ? activeTier(selected.tiers, quantity)?.compareAt
                : (selected?.compareAt ?? product.compareAt)
            }
            currency={product.currency}
            size="md"
          />
          {!chipMode && quantity > 1 && (
            <span className={styles.total}>Total {formatPrice(lineTotal)}</span>
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
                // Schrittweite der +/−-Knöpfe im Warenkorb.
                step,
              },
              quantity,
            );
          }}
        >
          {!canAdd ? (
            "Ausverkauft"
          ) : isPending ? (
            "Wird hinzugefügt …"
          ) : chipMode ? (
            <>
              <span className={`${styles.ctaSum} tnum`}>
                {quantity} × {formatAmount(unitPrice)} = {formatPrice(lineTotal)}
              </span>
              <span>In den Warenkorb</span>
            </>
          ) : (
            "In den Warenkorb"
          )}
        </button>
      </div>
    </div>
  );
}
