"use client";

/**
 * THE KASSENSTRECKE — two steps on one page.
 *
 *   1. Kontakt + Lieferadresse (the server also puts the delivery method on
 *      the cart — the customer never picks one, see lib/checkout/shipping-choice.ts)
 *   2. Übersicht + Bestellabschluss
 *
 * One page rather than routes: the basket, the price and the progress stay
 * visible the whole way. A cart that already carries address and delivery
 * method (returning customer, reload) opens straight on step 2.
 *
 * ══ WHERE THE MONEY COMES FROM ════════════════════════════════════════════
 * Every number rendered here comes out of `useCart()`, which mirrors the Medusa
 * cart. Each step's Server Action returns the updated cart and pushes it in via
 * `applyCart`, so the summary here and the drawer can never disagree. Until
 * the delivery method is on the cart, shipping is the storefront's estimate
 * and labelled as such; afterwards it is Medusa's binding `shipping_total`.
 *
 * ══ PAYMENT ═══════════════════════════════════════════════════════════════
 * `placeOrderAction` may answer `{ kind: "redirect" }` — that is the whole
 * change a redirect PSP needs on this side. See lib/checkout/payment.ts.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { FreeShippingMeter } from "@/components/FreeShippingMeter";
import {
  ensureShippingAction,
  placeOrderAction,
  saveAddressAction,
} from "@/app/actions/checkout";
import { EMPTY_ADDRESS, SUPPORTED_COUNTRIES, type AddressErrors } from "@/lib/checkout/address";
import type { CartState, CheckoutAddress } from "@/lib/cart/types";
import { EMPTY_CART } from "@/lib/cart/types";
import { formatPrice } from "@/lib/format";
import { ShippingSplitNote } from "@/components/ShippingSplitNote";
import styles from "./checkout.module.css";

type Step = "address" | "review";

const STEP_LABELS: Record<Step, string> = {
  address: "Adresse",
  review: "Kaufen",
};

const STEP_ORDER: Step[] = ["address", "review"];

function isReadyToBuy(
  cart: Pick<CartState, "count" | "email" | "hasShippingAddress" | "hasShippingMethod">,
): boolean {
  return cart.count > 0 && Boolean(cart.email) && cart.hasShippingAddress && cart.hasShippingMethod;
}

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

  const [step, setStep] = useState<Step>(isReadyToBuy(initialCart) ? "review" : "address");
  // Was der Cart schon trägt, gewinnt: eine halb ausgefüllte Kasse darf das
  // Konto-Vorausfüllen nicht überschreiben.
  const [email, setEmail] = useState(initialCart.email ?? prefillEmail ?? "");
  const [address, setAddress] = useState<CheckoutAddress>(
    initialCart.address ?? prefillAddress ?? EMPTY_ADDRESS,
  );
  const [errors, setErrors] = useState<AddressErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  const needsShipping =
    step === "review" &&
    cart.count > 0 &&
    Boolean(cart.email) &&
    cart.hasShippingAddress &&
    !cart.hasShippingMethod;
  const shippingAttemptFor = useRef<string | null>(null);
  useEffect(() => {
    if (!needsShipping || busy || cart.isPending) return;
    // One attempt per cart state, so a failure cannot loop.
    const key = `${cart.cartId}:${cart.count}:${cart.subtotal}`;
    if (shippingAttemptFor.current === key) return;
    shippingAttemptFor.current = key;
    startTransition(async () => {
      const result = await ensureShippingAction();
      cart.applyCart(result.cart);
      if (!result.ok) setFormError(result.message);
    });
  }, [needsShipping, busy, cart]);

  function submitAddress(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await saveAddressAction(email, address);
      if (!result.ok) {
        // A rebuilt cart (unavailable items dropped) replaces the stale summary.
        if (result.cart?.id) cart.applyCart(result.cart);
        setErrors(result.errors);
        setFormError(result.message ?? null);
        return;
      }
      setErrors({});
      cart.applyCart(result.cart);
      setNotice(result.notice ?? null);
      setStep("review");
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
              {cart.count === 0 && (
                <>
                  {" "}
                  <Link href="/" className={styles.errorLink}>
                    Zum Shop
                  </Link>
                </>
              )}
            </p>
          )}
          {notice && (
            <p className={styles.notice} role="status">
              {notice}
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
                  {busy ? "Einen Moment …" : "Weiter"}
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

          {/* ── Schritt 2 — Kaufen ─────────────────────────────────────── */}
          {step === "review" && (
            <section className={styles.card} aria-labelledby="step-review">
              <div className={styles.cardHead}>
                <h2 id="step-review" className={styles.cardTitle}>
                  2 · Kaufen
                </h2>
              </div>
              <p className={styles.muted}>
                Mit dem Klick auf &laquo;Jetzt kaufen&raquo; gibst du eine
                verbindliche Bestellung ab. Es gelten unsere{" "}
                <Link href="/agb">AGB</Link>; zur Rückgabe siehe{" "}
                <Link href="/widerrufsrecht">Widerrufsrecht</Link>.
              </p>
              <button
                type="button"
                className={styles.primaryCta}
                disabled={busy || !isReadyToBuy(cart)}
                onClick={submitOrder}
              >
                {busy
                  ? "Bestellung wird abgeschlossen …"
                  : `Jetzt kaufen · ${formatPrice(cart.total)}`}
              </button>
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

          <FreeShippingMeter />

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
                {cart.shipping !== 0 && (
                  <ShippingSplitNote className={styles.splitNote} />
                )}
              </dt>
              <dd className="tnum">
                {cart.shipping === 0 ? "gratis" : formatPrice(cart.shipping)}
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
