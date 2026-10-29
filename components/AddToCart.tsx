"use client";

import { useMemo, useState } from "react";
import { useCart } from "./CartProvider";
import { useVariantSelection } from "./VariantSelection";
import { useTierSelection } from "./TierSelection";
import { trackAddToCart } from "@/lib/analytics/client";
import { Price, SaveBadge } from "./Price";
import { variantControl, variantLabel, variantOptionText } from "@/lib/variant-control";
import { PriceTable } from "./PriceTable";
import { formatAmount, formatPrice } from "@/lib/format";
import {
  activeTier,
  MAX_QUANTITY,
  defaultVariant,
  normalizeQuantity,
  packAdvantagePercent,
  pricePerUnit,
  sanitizeQuantityInput,
  savingAt,
  tierChips,
  tierForQuantity,
  unitPriceFor,
} from "@/lib/pricing";
import {
  clampToStock,
  isTierDisabled,
  stockNote,
  tierDisabledLabel,
} from "@/lib/stock";
import type { ProductView } from "@/lib/types";
import styles from "./AddToCart.module.css";

/**
 * Variant selection + quantity + add to cart. On mobile the CTA renders as a
 * sticky bar pinned to the bottom of the viewport so it is always in thumb
 * reach, with safe-area padding so iOS's home indicator doesn't clip it.
 *
 * PREISSTUFEN (ein Produkt = eine Variante, Preistabelle im Admin): statt
 * Variantenwahl gibt es grosse Chips je Stufe — «1 Stück», «10 Stück»,
 * «24er Display» — mit Stückpreis und Ersparnis. Tippen setzt die Menge auf
 * die Stufe. Die Menge ist trotzdem jederzeit frei eintippbar (49, 7, …);
 * +/− ändern um 1, und der Chip folgt der Stufe, in die die Menge fällt.
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
  const control = variantControl(product.variants, product.optionTitle);

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
  const [, setLocalTier] = useState(1);
  const setTier = tierSelection ? tierSelection.setTier : setLocalTier;

  // Das Mengenfeld hält den getippten Text (leer ist beim Tippen erlaubt);
  // die gültige Menge (>= 1, <= MAX_QUANTITY) wird daraus abgeleitet.
  const [qtyText, setQtyText] = useState("1");
  const selected = product.variants.find((v) => v.id === variantId);
  const canAdd = Boolean(selected?.inStock);

  // Bestand: null = unbegrenzt. Menge, Eingabe und «+» enden hier; fällt die
  // Vorauswahl über den Bestand, gilt die grösste erlaubte Menge (lib/stock.ts).
  const available = selected?.availableQuantity ?? null;
  const maxQuantity =
    typeof available === "number" ? Math.min(MAX_QUANTITY, Math.max(1, available)) : MAX_QUANTITY;
  const quantity = clampToStock(normalizeQuantity(qtyText), available);

  const single = useMemo(
    () => product.variants.find((v) => v.packType === "single"),
    [product.variants],
  );

  // Ohne useMemo: der React Compiler memoisiert selbst (und lehnte die
  // manuelle Memoisierung ab, seit der Bestand aus der Variante abgeleitet wird).
  const chips =
    (!multi || control === "select") && selected ? tierChips(selected.tiers, product.tierExtras) : [];
  const chipMode = chips.length > 1;
  // Der hervorgehobene Chip folgt der Menge, nicht umgekehrt.
  const activeChip = tierForQuantity(chips, quantity);

  const unitPrice = selected
    ? unitPriceFor(selected.tiers, quantity, selected.price)
    : product.price;

  const perUnit = selected ? pricePerUnit(selected, quantity) : null;
  const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
  const saving = selected && chipMode ? savingAt(selected.tiers, quantity) : null;

  const note = canAdd ? stockNote(available, selected?.tiers.at(-1)?.minQuantity ?? 0) : null;
  const hasHint = Boolean((saving && saving.amount > 0) || perUnit !== null);
  const describedBy =
    [note ? "qty-note" : "", hasHint ? "qty-hint" : ""].filter(Boolean).join(" ") ||
    undefined;

  // Galerie (Stufenfoto) nachziehen, wenn sich die Menge ändert — egal ob
  // per Chip, +/− oder Tastatur.
  const syncTier = (q: number) => {
    if (chipMode) setTier(tierForQuantity(chips, q));
  };

  const setQuantitySafely = (next: number) => {
    const q = clampToStock(normalizeQuantity(next), available);
    setQtyText(String(q));
    syncTier(q);
  };

  const pickTier = (minQuantity: number) => setQuantitySafely(minQuantity);

  const onQtyInput = (raw: string) => {
    const typed = sanitizeQuantityInput(raw);
    // Über dem Bestand sofort auf den Bestand kappen.
    const text =
      typed !== "" && Number(typed) > maxQuantity ? String(maxQuantity) : typed;
    setQtyText(text);
    syncTier(clampToStock(normalizeQuantity(text), available));
  };

  return (
    <div className={styles.wrap}>
      {control === "select" && (
        <div className={styles.variants}>
          <label className="eyebrow" htmlFor="variant-select">
            {variantLabel(product.optionTitle)}
          </label>
          <select
            id="variant-select"
            className={styles.select}
            value={variantId ?? ""}
            onChange={(e) => {
              setVariantId(e.target.value);
              // Die Menge der alten Grösse passt selten zur neuen.
              setQuantitySafely(1);
            }}
          >
            {product.variants.map((v) => (
              <option key={v.id} value={v.id} disabled={!v.inStock}>
                {variantOptionText(v, formatPrice)}
              </option>
            ))}
          </select>
        </div>
      )}

      {control === "buttons" && (
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
                    setQuantitySafely(1);
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
            {chips.map((c) => {
              const tooMany = isTierDisabled(c.minQuantity, available);
              return (
              <button
                key={c.minQuantity}
                type="button"
                className={styles.chip}
                aria-pressed={c.minQuantity === activeChip}
                disabled={tooMany}
                title={tooMany ? tierDisabledLabel(available ?? 0) : undefined}
                aria-label={
                  tooMany
                    ? `${c.label}: ${tierDisabledLabel(available ?? 0)}`
                    : undefined
                }
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
              );
            })}
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
        <label className="eyebrow" htmlFor="qty-input">
          Menge
        </label>
        <div className={styles.stepper} role="group" aria-label="Menge ändern">
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
            id="qty-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            className={`${styles.qtyValue} tnum`}
            value={qtyText}
            aria-describedby={describedBy}
            onChange={(e) => onQtyInput(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={() => setQuantitySafely(quantity)}
          />
          <button
            type="button"
            className={styles.step}
            aria-label="Menge erhöhen"
            disabled={quantity >= maxQuantity}
            onClick={() => setQuantitySafely(quantity + 1)}
          >
            +
          </button>
        </div>

        {note && (
          <span id="qty-note" className={styles.stockNote} role="status">
            {note}
          </span>
        )}

        {saving && saving.amount > 0 ? (
          <span id="qty-hint" className={styles.perUnit} aria-live="polite">
            {product.currency} {formatAmount(unitPrice)} / Stk. ·{" "}
            <span className={styles.saving}>
              du sparst {formatPrice(saving.amount)}
            </span>{" "}
            <SaveBadge percent={saving.percent} />
          </span>
        ) : (
          perUnit !== null && (
            <span id="qty-hint" className={styles.perUnit} aria-live="polite">
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
