"use client";

/**
 * THE KASSENSTRECKE — three steps on one page.
 *
 *   1. Kontakt + Lieferadresse
 *   2. Versandart
 *   3. Übersicht + Bestellabschluss
 *
 * One page rather than three routes: the basket, the price and the progress
 * stay visible the whole way, and a customer who wants to change the address
 * after seeing the shipping cost does not lose their place.
 *
 * ══ WHERE THE MONEY COMES FROM ════════════════════════════════════════════
 * Every number rendered here comes out of `useCart()`, which mirrors the Medusa
 * cart. Each step's Server Action returns the updated cart and pushes it in via
 * `applyCart`, so the summary here and the drawer can never disagree.
 *
 * ══ SHIPPING PRICE ════════════════════════════════════════════════════════
 * The Swiss shipping option is `price_type: "calculated"`, and Medusa's store
 * route does not compute prices for those — the option list carries no amount.
 * The price becomes knowable only once the method is ON the cart. Hence: the
 * single available option is selected automatically as soon as the step opens,
 * and from that moment the summary shows Medusa's binding `shipping_total`
 * rather than any estimate.
 *
 * ══ PAYMENT ═══════════════════════════════════════════════════════════════
 * There is no payment step in this UI yet, by design. `placeOrderAction` may
 * answer `{ kind: "redirect" }`, which is handled below — that is the whole
 * change a redirect PSP needs on this side. See lib/checkout/payment.ts.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import {
  listShippingOptionsAction,
  placeOrderAction,
  saveAddressAction,
  selectShippingOptionAction,
} from "@/app/actions/checkout";
import { EMPTY_ADDRESS, SUPPORTED_COUNTRIES, type AddressErrors } from "@/lib/checkout/address";
import type { CartState, CheckoutAddress, ShippingOptionView } from "@/lib/cart/types";
import { EMPTY_CART } from "@/lib/cart/types";
import { formatPrice } from "@/lib/format";
import styles from "./checkout.module.css";

type Step = "address" | "shipping";

const STEP_LABELS: Record<Step, string> = {
  address: "Adresse",
  shipping: "Versand & Kauf",
};

const STEP_ORDER: Step[] = ["address", "shipping"];

export function CheckoutFlow({
  initialCart,
  prefillEmail = null,
  prefillAddress = null,
}: {
  initialCart: CartState;
  /** Aus dem Kundenkonto, wenn angemeldet — siehe app/checkout/page.tsx. */
  prefillEmail?: string | null;
  prefillAddress?: CheckoutAddress | null;
}) {
  const cart = useCart();
  const router = useRouter();

  const [step, setStep] = useState<Step>("address");
  // Was der Cart schon trägt, gewinnt: eine halb ausgefüllte Kasse darf das
  // Konto-Vorausfüllen nicht überschreiben.
  const [email, setEmail] = useState(initialCart.email ?? prefillEmail ?? "");
  const [address, setAddress] = useState<CheckoutAddress>(
    initialCart.address ?? prefillAddress ?? EMPTY_ADDRESS,
  );
  const [errors, setErrors] = useState<AddressErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [options, setOptions] = useState<ShippingOptionView[] | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  /**
   * Adopt the server-rendered cart ONLY when the provider is holding nothing.
   *
   * Deliberately one-way. The provider is updated by every mutation, so its
   * state is normally the NEWER of the two; pushing a server snapshot over it
   * unconditionally would let a cached RSC payload move the cart backwards —
   * a customer adds an item, walks to the checkout, and it is gone again.
   * The only case worth covering is a provider that never saw a cart at all
   * (a cart started in another tab), and that is what the guard checks.
   */
  const seeded = useRef(false);
  const { applyCart, cartId } = cart;
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    if (!cartId) applyCart(initialCart);
  }, [applyCart, cartId, initialCart]);

  const loadOptions = useCallback(() => {
    startTransition(async () => {
      const list = await listShippingOptionsAction();
      setOptions(list);
      // Exactly one option is the normal case for a Swiss-only shop. Selecting
      // it right away is what makes the real shipping cost visible at all —
      // see the header.
      if (list.length === 1) {
        const result = await selectShippingOptionAction(list[0].id);
        if (result.ok) {
          setSelectedOption(list[0].id);
          cart.applyCart(result.cart);
        } else {
          setFormError(result.message);
        }
      }
    });
  }, [cart]);

  function submitAddress(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = await saveAddressAction(email, address);
      if (!result.ok) {
        setErrors(result.errors);
        setFormError(result.message ?? null);
        return;
      }
      setErrors({});
      cart.applyCart(result.cart);
      setStep("shipping");
      loadOptions();
    });
  }

  function chooseOption(optionId: string) {
    setFormError(null);
    startTransition(async () => {
      const result = await selectShippingOptionAction(optionId);
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      setSelectedOption(optionId);
      cart.applyCart(result.cart);
    });
  }

  function submitOrder() {
    setFormError(null);
    startTransition(async () => {
      const result = await placeOrderAction();

      if (result.kind === "redirect") {
        // ⚠️ PAYMENT SEAM: a PSP wants the customer on its own page. The cart
        // stays intact — the order is only created once they come back.
        window.location.href = result.url;
        return;
      }

      if (result.kind === "error") {
        setFormError(result.message);
        return;
      }

      // The cookie is gone server-side; clear the client mirror before leaving,
      // otherwise the header badge keeps showing a cart that no longer exists.
      cart.applyCart(EMPTY_CART);
      router.push(`/checkout/bestellung/${result.orderId}`);
    });
  }

  const addressComplete = cart.hasShippingAddress && Boolean(cart.email);
  const shippingComplete = cart.hasShippingMethod;

  function field(
    name: keyof CheckoutAddress,
    label: string,
    options: { required?: boolean; autoComplete?: string; type?: string } = {},
  ) {
    const value = address[name] ?? "";
    return (
      <label className={styles.field}>
        <span className={styles.label}>
          {label}
          {options.required && <span aria-hidden="true"> *</span>}
        </span>
        <input
          className={styles.input}
          type={options.type ?? "text"}
          value={typeof value === "string" ? value : ""}
          autoComplete={options.autoComplete}
          aria-invalid={errors[name] ? true : undefined}
          onChange={(e) =>
            setAddress((prev) => ({ ...prev, [name]: e.target.value }))
          }
        />
        {errors[name] && <span className={styles.fieldError}>{errors[name]}</span>}
      </label>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Kasse</h1>
        <ol className={styles.steps}>
          {STEP_ORDER.map((s, i) => (
            <li
              key={s}
              className={styles.stepChip}
              data-state={
                s === step ? "current" : STEP_ORDER.indexOf(step) > i ? "done" : "todo"
              }
            >
              <span className="tnum">{i + 1}</span> {STEP_LABELS[s]}
            </li>
          ))}
        </ol>
      </header>

      <div className={styles.columns}>
        <div className={styles.main}>
          {formError && (
            <p className={styles.error} role="alert">
              {formError}
            </p>
          )}

          {/* ── Schritt 1 — Kontakt + Lieferadresse ───────────────────── */}
          <section className={styles.card} aria-labelledby="step-address">
            <div className={styles.cardHead}>
              <h2 id="step-address" className={styles.cardTitle}>
                1 · Kontakt und Lieferadresse
              </h2>
              {step !== "address" && addressComplete && (
                <button
                  type="button"
                  className={styles.changeBtn}
                  onClick={() => setStep("address")}
                >
                  Ändern
                </button>
              )}
            </div>

            {step === "address" ? (
              <form onSubmit={submitAddress} noValidate>
                <label className={styles.field}>
                  <span className={styles.label}>E-Mail *</span>
                  <input
                    className={styles.input}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    aria-invalid={errors.email ? true : undefined}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <span className={styles.hint}>
                    Hierhin geht die Bestellbestätigung.
                  </span>
                  {errors.email && (
                    <span className={styles.fieldError}>{errors.email}</span>
                  )}
                </label>

                <div className={styles.row}>
                  {field("firstName", "Vorname", {
                    required: true,
                    autoComplete: "given-name",
                  })}
                  {field("lastName", "Nachname", {
                    required: true,
                    autoComplete: "family-name",
                  })}
                </div>

                {field("company", "Firma (optional)", {
                  autoComplete: "organization",
                })}
                {field("address1", "Strasse und Nummer", {
                  required: true,
                  autoComplete: "address-line1",
                })}
                {field("address2", "Adresszusatz (optional)", {
                  autoComplete: "address-line2",
                })}

                <div className={styles.row}>
                  {field("postalCode", "PLZ", {
                    required: true,
                    autoComplete: "postal-code",
                  })}
                  {field("city", "Ort", {
                    required: true,
                    autoComplete: "address-level2",
                  })}
                </div>

                <label className={styles.field}>
                  <span className={styles.label}>Land *</span>
                  <select
                    className={styles.input}
                    value={address.countryCode}
                    onChange={(e) =>
                      setAddress((prev) => ({
                        ...prev,
                        countryCode: e.target.value,
                      }))
                    }
                  >
                    {SUPPORTED_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {errors.countryCode && (
                    <span className={styles.fieldError}>{errors.countryCode}</span>
                  )}
                </label>

                {field("phone", "Telefon (optional)", {
                  type: "tel",
                  autoComplete: "tel",
                })}

                <button type="submit" className={styles.primaryCta} disabled={busy}>
                  {busy ? "Einen Moment …" : "Weiter zur Versandart"}
                </button>
              </form>
            ) : (
              addressComplete &&
              cart.lines.length > 0 && (
                <address className={styles.address}>
                  {cart.email}
                  <br />
                  {address.firstName} {address.lastName}
                  <br />
                  {address.address1}
                  <br />
                  {address.postalCode} {address.city}
                </address>
              )
            )}
          </section>

          {/* ── Schritt 2 — Versandart ────────────────────────────────── */}
          {step !== "address" && (
            <section className={styles.card} aria-labelledby="step-shipping">
              <div className={styles.cardHead}>
                <h2 id="step-shipping" className={styles.cardTitle}>
                  2 · Versandart
                </h2>
              </div>

              {options === null ? (
                <p className={styles.muted}>Versandarten werden geladen …</p>
              ) : options.length === 0 ? (
                <p className={styles.muted}>
                  Für diese Adresse ist derzeit keine Versandart verfügbar. Bitte
                  prüfe die Adresse oder melde dich bei uns.
                </p>
              ) : (
                <ul className={styles.options}>
                  {options.map((option) => (
                    <li key={option.id}>
                      <label className={styles.option}>
                        <input
                          type="radio"
                          name="shipping-option"
                          value={option.id}
                          checked={selectedOption === option.id}
                          disabled={busy}
                          onChange={() => chooseOption(option.id)}
                        />
                        <span className={styles.optionBody}>
                          <span className={styles.optionName}>{option.name}</span>
                          {option.description && (
                            <span className={styles.optionDesc}>
                              {option.description}
                            </span>
                          )}
                        </span>
                        <span className={`${styles.optionPrice} tnum`}>
                          {/*
                            The binding price is `cart.shipping_total`, available
                            only once this option is on the cart. `option.amount`
                            is filled in for flat-rate options; the Swiss one is
                            calculated, so it stays null until selected.
                          */}
                          {selectedOption === option.id
                            ? cart.shipping === 0
                              ? "Gratis"
                              : formatPrice(cart.shipping)
                            : option.amount !== null
                              ? formatPrice(option.amount)
                              : "—"}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}

              {step === "shipping" && (
                <>
                  <p className={styles.muted}>
                    Mit dem Klick auf &laquo;Jetzt kaufen&raquo; gibst du eine
                    verbindliche Bestellung ab. Es gelten unsere{" "}
                    <Link href="/agb">AGB</Link>; zur Rückgabe siehe{" "}
                    <Link href="/widerrufsrecht">Widerrufsrecht</Link>.
                  </p>
                  <button
                    type="button"
                    className={styles.primaryCta}
                    disabled={busy || !shippingComplete || cart.count === 0}
                    onClick={submitOrder}
                  >
                    {busy ? "Bestellung wird abgeschlossen …" : "Jetzt kaufen"}
                  </button>
                </>
              )}
            </section>
          )}

        </div>

        {/* ── Warenkorb-Übersicht ─────────────────────────────────────── */}
        <aside className={styles.summary} aria-label="Bestellübersicht">
          <h2 className={styles.cardTitle}>Deine Bestellung</h2>
          <ul className={styles.summaryList}>
            {cart.lines.map((line) => (
              <li key={line.id} className={styles.summaryLine}>
                <span>
                  {line.title}
                  {line.variantTitle && ` · ${line.variantTitle}`}
                  <span className={styles.summaryQty}> × {line.quantity}</span>
                </span>
                <span className="tnum">{formatPrice(line.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <dl className={styles.totals}>
            <div>
              <dt>Zwischensumme</dt>
              <dd className="tnum">{formatPrice(cart.subtotal)}</dd>
            </div>
            <div>
              <dt>
                Versand
                {cart.shippingIsEstimate && (
                  <span className={styles.estimate}> (geschätzt)</span>
                )}
              </dt>
              <dd className="tnum">
                {cart.shipping === 0 ? "Gratis" : formatPrice(cart.shipping)}
              </dd>
            </div>
            <div className={styles.grand}>
              <dt>Total</dt>
              <dd className="tnum">{formatPrice(cart.total)}</dd>
            </div>
          </dl>
          <p className={styles.vatNote}>Endpreise — keine Mehrwertsteuer (nicht steuerpflichtig)</p>
        </aside>
      </div>
    </div>
  );
}
