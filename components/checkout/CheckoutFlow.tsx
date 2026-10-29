"use client";

/**
 * THE KASSENSTRECKE — two steps on one page.
 *
 *   1. Kontakt + Lieferung: the customer picks Lieferung or Abholung im Laden
 *      (lib/checkout/pickup.ts) and gives the address — or, for pickup, only
 *      name and phone. The server maps the choice onto a Medusa option
 *      (lib/checkout/shipping-choice.ts); the customer never sees option ids.
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
import {
  pickupAddressLines,
  pickupHoursText,
  type DeliveryChoice,
} from "@/lib/checkout/pickup";
import type { CartState, CheckoutAddress } from "@/lib/cart/types";
import { EMPTY_CART } from "@/lib/cart/types";
import { PICKUP, SHIPPING } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import { deliveryOptionViews } from "@/lib/checkout/shipping-display";
import { ShippingSplitNote } from "@/components/ShippingSplitNote";
import styles from "./checkout.module.css";

type Step = "address" | "review";

const STEP_LABELS: Record<Step, string> = {
  address: "Lieferung",
  review: "Kaufen",
};

const STEP_ORDER: Step[] = ["address", "review"];

const DELIVERY_ERROR =
  "Die Lieferart konnte nicht geändert werden. Bitte versuche es nochmals.";

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
  // Lieferung oder Abholung: was der Cart schon trägt (metadata.pickup),
  // sonst Lieferung. Ohne freigeschaltete Abholung gibt es keine Wahl.
  const [delivery, setDelivery] = useState<DeliveryChoice>(
    PICKUP.enabled && initialCart.pickup ? "pickup" : "shipping",
  );
  // Bei Abholung steht auf dem Cart die LADENADRESSE (lib/checkout/pickup.ts)
  // — die darf das Formular nicht als Adresse der Kundin übernehmen. Name
  // und Telefon stammen aber von ihr und bleiben.
  const [address, setAddress] = useState<CheckoutAddress>(() => {
    if (initialCart.pickup && initialCart.address) {
      const { firstName, lastName, company, phone } = initialCart.address;
      return { ...(prefillAddress ?? EMPTY_ADDRESS), firstName, lastName, company, phone };
    }
    return initialCart.address ?? prefillAddress ?? EMPTY_ADDRESS;
  });
  const [errors, setErrors] = useState<AddressErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  // Die Lieferart, die gerade auf den Cart geschrieben wird — die Radiogruppe
  // zeigt sie sofort als gewählt (optimistisch), bis der Server geantwortet hat.
  const [pendingChoice, setPendingChoice] = useState<DeliveryChoice | null>(null);

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
      const result = await saveAddressAction(email, address, delivery);
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

  /**
   * Lieferart in der eingeklappten Kasse wechseln: dieselbe Server Action wie
   * das Formular, mit der Adresse, die die Kasse schon kennt — der Server setzt
   * die Medusa-Methode neu und liefert den Cart mit den neuen Summen zurück.
   * Fehlen für die neue Art Angaben (Telefon für die Abholung, Strasse für die
   * Lieferung), geht das Formular mit dieser Wahl auf, statt still zu scheitern.
   */
  function changeDelivery(choice: DeliveryChoice) {
    if (busy || choice === currentChoice) return;
    setFormError(null);
    setNotice(null);
    setPendingChoice(choice);
    startTransition(async () => {
      try {
        const result = await saveAddressAction(cart.email ?? email, address, choice);
        if (!result.ok) {
          if (result.cart?.id) cart.applyCart(result.cart);
          if (Object.keys(result.errors).length > 0) {
            setDelivery(choice);
            setErrors(result.errors);
            setStep("address");
            setNotice(
              choice === "pickup"
                ? "Für die Abholung fehlen noch Angaben."
                : "Für die Lieferung fehlt noch deine Adresse.",
            );
            return;
          }
          setFormError(result.message ?? DELIVERY_ERROR);
          return;
        }
        setErrors({});
        setDelivery(choice);
        cart.applyCart(result.cart);
        setNotice(result.notice ?? null);
      } catch {
        setFormError(DELIVERY_ERROR);
      } finally {
        setPendingChoice(null);
      }
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
  // Lieferarten der eingeklappten Kasse. Beträge: Medusas für die gewählte Art,
  // vor der Methode ist `cart.shipping` die Schätzung.
  const currentChoice: DeliveryChoice = cart.pickup ? "pickup" : "shipping";
  const shownChoice = pendingChoice ?? currentChoice;
  const deliveryViews = deliveryOptionViews({
    pickup: cart.pickup,
    shipping: cart.shipping,
    subtotal: cart.subtotal,
    estimate: cart.shippingIsEstimate,
  });
  const isPickup = delivery === "pickup";

  function deliveryOption(
    value: DeliveryChoice,
    title: string,
    price: string,
    detail: React.ReactNode,
  ) {
    return (
      <label className={styles.choice} data-checked={delivery === value ? "true" : "false"}>
        <input
          type="radio"
          name="delivery"
          value={value}
          className={styles.choiceInput}
          checked={delivery === value}
          onChange={() => {
            setDelivery(value);
            setErrors({});
          }}
        />
        <span className={styles.choiceBody}>
          <span className={styles.choiceHead}>
            <span className={styles.choiceTitle}>{title}</span>
            <span className={`${styles.choicePrice} tnum`}>{price}</span>
          </span>
          <span className={styles.choiceDetail}>{detail}</span>
        </span>
      </label>
    );
  }

  function field(
    name: keyof CheckoutAddress,
    label: string,
    options: { required?: boolean; autoComplete?: string; type?: string; hint?: string } = {},
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
        {options.hint && <span className={styles.hint}>{options.hint}</span>}
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

          {/* ── Schritt 1 — Kontakt + Lieferung ───────────────────────── */}
          <section className={styles.card} aria-labelledby="step-address">
            <div className={styles.cardHead}>
              <h2 id="step-address" className={styles.cardTitle}>
                1 · Kontakt und Lieferung
              </h2>
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

                {/* Lieferung oder Abholung — die Kundin wählt die ART, die
                    Medusa-Option dahinter wählt der Server. Ohne
                    freigeschaltete Abholung gibt es nur die Lieferung, und
                    die wird dann nicht als Wahl inszeniert. */}
                {PICKUP.enabled && (
                  <fieldset className={styles.choices}>
                    <legend className={styles.label}>Lieferung oder Abholung *</legend>
                    {deliveryOption(
                      "shipping",
                      "Lieferung",
                      `${formatPrice(SHIPPING.rate)}`,
                      <>
                        Schweizerische Post, gratis ab {formatPrice(SHIPPING.freeThreshold)}{" "}
                        Bestellwert.
                      </>,
                    )}
                    {deliveryOption(
                      "pickup",
                      PICKUP.label,
                      "gratis",
                      <>
                        {pickupAddressLines().slice(1).join(", ")} · {pickupHoursText()}.{" "}
                        {PICKUP.note}
                      </>,
                    )}
                  </fieldset>
                )}

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

                {isPickup ? (
                  <>
                    {field("phone", "Telefon", {
                      required: true,
                      type: "tel",
                      autoComplete: "tel",
                      hint: "Für Rückfragen zur Abholung.",
                    })}
                    <div className={styles.pickupBox} data-testid="pickup-address">
                      <span className={styles.label}>Abholort</span>
                      <address className={styles.address}>
                        {pickupAddressLines().map((line) => (
                          <span key={line}>
                            {line}
                            <br />
                          </span>
                        ))}
                        {pickupHoursText()}
                      </address>
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}

                <button type="submit" className={styles.primaryCta} disabled={busy}>
                  {busy ? "Einen Moment …" : "Weiter"}
                </button>
              </form>
            ) : (
              addressComplete &&
              cart.lines.length > 0 && (
                <div className={styles.tiles}>
                  <section className={styles.tile} aria-labelledby="tile-contact" data-testid="tile-contact">
                    <div className={styles.tileHead}>
                      <h3 id="tile-contact" className={styles.tileTitle}>
                        Kontakt &amp; Adresse
                      </h3>
                      <button
                        type="button"
                        className={styles.changeBtn}
                        onClick={() => {
                          setDelivery(currentChoice);
                          setStep("address");
                        }}
                      >
                        Ändern
                      </button>
                    </div>
                    <address className={styles.address}>
                      {cart.email}
                      <br />
                      {address.firstName} {address.lastName}
                      {address.company && (
                        <>
                          <br />
                          {address.company}
                        </>
                      )}
                      {cart.pickup ? (
                        address.phone && (
                          <>
                            <br />
                            {address.phone}
                          </>
                        )
                      ) : (
                        <>
                          <br />
                          {address.address1}
                          {address.address2 && (
                            <>
                              <br />
                              {address.address2}
                            </>
                          )}
                          <br />
                          {address.postalCode} {address.city}
                        </>
                      )}
                    </address>
                  </section>

                  <fieldset
                    className={styles.tile}
                    data-testid="tile-delivery"
                    aria-busy={pendingChoice ? true : undefined}
                  >
                    <legend className={styles.tileTitle}>Lieferung</legend>
                    <div className={styles.choices}>
                      {deliveryViews.map((view) => (
                        <label
                          key={view.value}
                          className={styles.choice}
                          data-checked={shownChoice === view.value ? "true" : "false"}
                        >
                          <input
                            type="radio"
                            name="delivery-method"
                            value={view.value}
                            className={styles.choiceInput}
                            checked={shownChoice === view.value}
                            onChange={() => changeDelivery(view.value)}
                          />
                          <span className={styles.choiceBody}>
                            <span className={styles.choiceHead}>
                              <span className={styles.choiceTitle}>{view.title}</span>
                              <span className={`${styles.choicePrice} tnum`}>
                                {view.cost}
                                {view.estimate && (
                                  <span className={styles.estimate}> (geschätzt)</span>
                                )}
                              </span>
                            </span>
                            <span className={styles.choiceDetail}>{view.detail}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className={styles.tileStatus} role="status">
                      {pendingChoice ? "Lieferart wird aktualisiert …" : ""}
                    </p>
                  </fieldset>
                </div>
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
            {cart.discount > 0 && (
              <div className={styles.discount}>
                <dt>Aktionsrabatt (bereits abgezogen)</dt>
                <dd className="tnum">&minus;{formatPrice(cart.discount)}</dd>
              </div>
            )}
            <div>
              <dt>
                {cart.pickup ? "Abholung" : "Versand"}
                {cart.shippingIsEstimate && !cart.pickup && (
                  <span className={styles.estimate}> (geschätzt)</span>
                )}
                {cart.shipping !== 0 && (
                  <ShippingSplitNote className={styles.splitNote} />
                )}
              </dt>
              <dd className="tnum">
                {cart.pickup
                  ? formatPrice(0)
                  : cart.shipping === 0
                    ? "gratis"
                    : formatPrice(cart.shipping)}
              </dd>
            </div>
            <div className={styles.grand}>
              <dt>Total</dt>
              <dd className="tnum">{formatPrice(cart.total)}</dd>
            </div>
          </dl>
          {cart.taxTotal > 0 ? (
            <p className={styles.vatNote}>
              Alle Preise inkl. MwSt. (enthalten: {formatPrice(cart.taxTotal)})
            </p>
          ) : (
            <p className={styles.vatNote}>Endpreise — keine Mehrwertsteuer (nicht steuerpflichtig)</p>
          )}
        </aside>
      </div>
    </div>
  );
}
