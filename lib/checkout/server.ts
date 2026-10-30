/**
 * CHECKOUT STEPS AGAINST MEDUSA — server-only.
 *
 * The order Medusa requires, and the order the UI follows:
 *
 *   1. e-mail + delivery address   -> POST /store/carts/:id
 *      + delivery method            -> GET  /store/shipping-options
 *        (Lieferung oder Abholung      POST /store/carts/:id/shipping-methods
 *        im Laden — the customer
 *        picks the KIND, we pick the
 *        Medusa option, ./shipping-choice.ts; pickup: ./pickup.ts)
 *   2. payment                     -> lib/checkout/payment.ts   (SEAM)
 *   3. place order                 -> POST /store/carts/:id/complete
 *
 * KONTO: Ob die Kasse eine Anmeldung VERLANGT, entscheidet allein
 * `lib/checkout/account-requirement.ts` — geprüft wird das in
 * `app/checkout/page.tsx`, nicht hier. Die Schritte selbst funktionieren mit
 * und ohne Sitzung: Schritt 1 setzt `email` auf den Cart, und WENN eine
 * Sitzung da ist, ordnet er den Cart zusätzlich dem Konto zu und sichert die
 * Adresse im Adressbuch (lib/checkout/customer.ts). So bleibt eine
 * Gastbestellung technisch möglich, sobald der Schalter umgelegt wird.
 */

import "server-only";

import type Medusa from "@medusajs/js-sdk";
import type { HttpTypes } from "@medusajs/types";
import { toCartState } from "@/lib/cart/adapter";
import { refreshAktionIfNeeded } from "@/lib/cart/aktion-refresh";
import {
  describeInsufficientInventory,
  isInsufficientInventory,
} from "@/lib/cart/stock-error";
import {
  CART_FIELDS,
  cartContext,
  clearCartId,
  currentCartId,
  describeCartFailure,
  logCartError,
  recoverStaleCart,
  withStock,
  type CartContext,
} from "@/lib/cart/server";
import {
  EMPTY_CART,
  type CartActionResult,
  type CartState,
  type CheckoutAddress,
} from "@/lib/cart/types";
import { readSessionToken } from "@/lib/auth/session";
import {
  hasErrors,
  normalizeAddress,
  validateAddress,
  validatePickupContact,
  type AddressErrors,
} from "./address";
import { attachCartToCustomer, saveAddressToAccount } from "./customer";
import { PaymentSetupError, preparePayment } from "./payment";
import {
  deliveryChoiceOf,
  pickupMedusaAddress,
  type DeliveryChoice,
} from "./pickup";
import { pickShippingOption } from "./shipping-choice";

const NO_CART =
  "Dein Warenkorb ist leer oder abgelaufen. Bitte lege die Artikel neu in den Warenkorb.";

const NO_SHIPPING =
  "An diese Adresse können wir gerade nicht liefern. Bitte prüfe die Adresse oder schreib uns — wir helfen weiter.";

const NO_PICKUP =
  "Die Abholung im Laden ist gerade nicht verfügbar. Bitte wähle die Lieferung oder schreib uns.";

class NoShippingOptionError extends Error {
  constructor(readonly choice: DeliveryChoice) {
    super(`no ${choice} option`);
  }
}

/** What placing an order can end in. */
export type PlaceOrderResult =
  | { kind: "order"; orderId: string }
  /** The payment provider wants the customer on its own page first. */
  | { kind: "redirect"; url: string }
  | { kind: "error"; message: string };

interface LiveCart {
  cart: HttpTypes.StoreCart;
  sdk: Medusa;
  ctx: CartContext;
}

/**
 * Deutsche Meldung zu einem Bestandsfehler (Artikel + verfügbare Menge), sonst
 * null. `error` ist eine Exception oder der Text von `complete`s Cart-Antwort.
 */
async function stockMessage(live: LiveCart, error: unknown): Promise<string | null> {
  if (!isInsufficientInventory(error)) return null;
  const state = await withStock(live.sdk, toCartState(live.cart));
  return describeInsufficientInventory(error, state.lines);
}

/** The live Medusa cart, or null when there is none to check out. */
async function loadCart(): Promise<LiveCart | null> {
  const ctx = await cartContext();
  const cartId = await currentCartId();
  if (!ctx || !cartId) return null;

  try {
    const { cart: geladen } = await ctx.sdk.store.cart.retrieve(cartId, {
      fields: CART_FIELDS,
    });
    if (geladen.completed_at) return null;
    // Vor Zahlung und Abschluss: der bezahlte Betrag muss dem entsprechen, was
    // angezeigt wurde — also die Aktion hier ebenfalls nachziehen.
    const cart = await refreshAktionIfNeeded(ctx.sdk, geladen, CART_FIELDS);
    return { cart, sdk: ctx.sdk, ctx };
  } catch (error) {
    logCartError("checkout:retrieve", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 1 — contact + delivery address
// ---------------------------------------------------------------------------

export type SaveAddressResult =
  | { ok: true; cart: CartState; notice?: string }
  /** `cart`: set when the cart was rebuilt while failing — show that one. */
  | { ok: false; message?: string; errors: AddressErrors; cart?: CartState };

export async function saveContactAndAddress(
  email: string,
  address: CheckoutAddress,
  delivery: DeliveryChoice = "shipping",
): Promise<SaveAddressResult> {
  const pickup = delivery === "pickup";
  const normalized = normalizeAddress(address);
  const errors = pickup
    ? validatePickupContact(normalized, email)
    : validateAddress(normalized, email);
  if (hasErrors(errors)) return { ok: false, errors };

  const live = await loadCart();
  if (!live) return { ok: false, message: NO_CART, errors: {} };

  // Angemeldet? Dann gehört der Cart dem Konto — VOR dem Adress-Update, damit
  // auch eine Bestellung, die gleich danach abbricht und später abgeschlossen
  // wird, schon zugeordnet ist. Beides ist Komfort und hält die Kasse nie an
  // (siehe lib/checkout/customer.ts).
  const sessionToken = await readSessionToken();
  if (sessionToken) {
    await attachCartToCustomer(live.sdk, live.cart, sessionToken);
  }

  // Abholung: Medusa verlangt trotzdem eine Lieferadresse im Liefergebiet —
  // sie wird mit dem Laden gefüllt (Begründung: ./pickup.ts).
  const medusaAddress = pickup
    ? pickupMedusaAddress(normalized)
    : {
        first_name: normalized.firstName,
        last_name: normalized.lastName,
        company: normalized.company,
        address_1: normalized.address1,
        address_2: normalized.address2,
        postal_code: normalized.postalCode,
        city: normalized.city,
        country_code: normalized.countryCode,
        phone: normalized.phone,
      };

  const writeAddressAndShipping = async (cartId: string) => {
    await live.sdk.store.cart.update(
      cartId,
      {
        email: email.trim(),
        shipping_address: medusaAddress,
        // Same address for billing. A separate billing address is a later
        // refinement; asking for two addresses up front costs more orders than
        // it saves support tickets.
        billing_address: medusaAddress,
        // Die Wahl auf dem Cart festhalten: `ensureShippingMethod` liest sie,
        // und Medusa kopiert sie auf die Bestellung (order.metadata.pickup).
        metadata: { pickup },
      },
      { fields: "id" },
    );
    // Die Adresse ins Adressbuch, damit die nächste Bestellung sie kennt —
    // der eigentliche Zweck der Kontopflicht. Fehler dort bleiben dort.
    // Bei Abholung nicht: die Ladenadresse gehört nicht ins Adressbuch der Kundin.
    if (sessionToken && !pickup) {
      await saveAddressToAccount(live.sdk, sessionToken, normalized);
    }
    return applyShippingMethod(live.sdk, cartId, delivery);
  };

  try {
    return { ok: true, cart: await writeAddressAndShipping(live.cart.id) };
  } catch (error) {
    logCartError("checkout:address", error);
    const recovered = await recoverStaleCart(live.ctx, error);
    if (!recovered) {
      return { ok: false, message: failureReason(error), errors: {} };
    }
    if (recovered.state.count === 0) {
      return { ok: false, message: recovered.notice, errors: {}, cart: recovered.state };
    }

    try {
      if (sessionToken) {
        await attachCartToCustomer(live.sdk, { id: recovered.id }, sessionToken);
      }
      const cart = await writeAddressAndShipping(recovered.id);
      return { ok: true, cart, notice: recovered.notice };
    } catch (retryError) {
      logCartError("checkout:address:after-recover", retryError);
      return {
        ok: false,
        message: `${recovered.notice} ${failureReason(retryError)}`,
        errors: {},
        cart: recovered.state,
      };
    }
  }
}

/**
 * Re-applies the automatic delivery method when it went missing after step 1
 * (a drawer change can drop it), so "Kaufen" never dead-ends.
 */
export async function ensureShippingMethod(): Promise<CartActionResult> {
  const live = await loadCart();
  if (!live) return { ok: false, message: NO_CART, cart: EMPTY_CART };
  if (live.cart.shipping_methods?.length || !live.cart.shipping_address?.country_code) {
    return { ok: true, cart: toCartState(live.cart) };
  }
  try {
    // Die Wahl steht auf dem Cart (metadata.pickup) — die Kundin soll sie
    // nicht noch einmal treffen müssen.
    return {
      ok: true,
      cart: await applyShippingMethod(live.sdk, live.cart.id, deliveryChoiceOf(live.cart)),
    };
  } catch (error) {
    logCartError("checkout:ensure-shipping", error);
    return { ok: false, message: failureReason(error), cart: toCartState(live.cart) };
  }
}

function failureReason(error: unknown): string {
  if (error instanceof NoShippingOptionError) {
    return error.choice === "pickup" ? NO_PICKUP : NO_SHIPPING;
  }
  return describeCartFailure(error);
}

/** Puts the delivery method on the cart — see ./shipping-choice.ts. */
async function applyShippingMethod(
  sdk: Medusa,
  cartId: string,
  choice: DeliveryChoice,
): Promise<CartState> {
  const { shipping_options } = await sdk.store.fulfillment.listCartOptions({
    cart_id: cartId,
  });
  const optionId = await pickShippingOption(
    (shipping_options ?? []).map((o) => ({
      id: o.id,
      providerId: o.provider_id,
      amount: o.amount,
      insufficientInventory: o.insufficient_inventory,
      // Die Store-API liefert `metadata` (query-config der Route), der
      // SDK-Typ 2.18 kennt das Feld nur nicht.
      metadata: (o as { metadata?: Record<string, unknown> | null }).metadata,
      data: o.data,
      type: o.type,
    })),
    async (id) => {
      const { shipping_option } = await sdk.store.fulfillment.calculate(id, {
        cart_id: cartId,
      });
      return shipping_option.amount ?? null;
    },
    choice,
  );
  if (!optionId) throw new NoShippingOptionError(choice);

  const { cart } = await sdk.store.cart.addShippingMethod(
    cartId,
    {
      option_id: optionId,
      // Der Marker auf der Methode — der Provider setzt ihn ebenfalls
      // (validateFulfillmentData); doppelt hält, falls das Backend älter ist.
      ...(choice === "pickup" ? { data: { pickup: true } } : {}),
    },
    { fields: CART_FIELDS },
  );
  return toCartState(cart);
}

// ---------------------------------------------------------------------------
// Steps 2 + 3 — payment, then place the order
// ---------------------------------------------------------------------------

export async function placeOrder(): Promise<PlaceOrderResult> {
  const live = await loadCart();
  if (!live) return { kind: "error", message: NO_CART };

  const cart = live.cart;

  if (!cart.items?.length) {
    return { kind: "error", message: "Der Warenkorb ist leer." };
  }
  if (!cart.email) {
    return { kind: "error", message: "Bitte zuerst die E-Mail-Adresse angeben." };
  }
  if (!cart.shipping_address?.country_code) {
    return { kind: "error", message: "Bitte zuerst Kontakt und Lieferung angeben." };
  }
  if (!cart.shipping_methods?.length) {
    return { kind: "error", message: "Bitte Kontakt und Lieferung nochmals bestätigen." };
  }

  let handoff;
  try {
    handoff = await preparePayment(live.sdk, cart);
  } catch (error) {
    logCartError("checkout:payment", error);
    const stock = await stockMessage(live, error);
    if (stock) return { kind: "error", message: stock };
    return {
      kind: "error",
      message:
        error instanceof PaymentSetupError
          ? error.message
          : "Die Zahlung liess sich nicht vorbereiten. Bitte nochmals versuchen.",
    };
  }

  // ⚠️ SEAM: a redirect provider takes over here. The order is NOT completed
  // yet — the customer comes back from the PSP and the return route calls this
  // function's tail (or `completeCart`) again. See lib/checkout/payment.ts.
  if (handoff.kind === "redirect") {
    return { kind: "redirect", url: handoff.url };
  }

  return completeCart();
}

/**
 * Turn the cart into an order.
 *
 * Exported separately because the payment strand's return route needs exactly
 * this and nothing else, once the customer comes back from the PSP.
 *
 * `complete` answers with `{ type: "order" }` OR `{ type: "cart", error }` —
 * a failed completion is a 200 response, not an exception, so both are handled.
 */
export async function completeCart(): Promise<PlaceOrderResult> {
  const live = await loadCart();
  if (!live) return { kind: "error", message: NO_CART };

  try {
    const result = await live.sdk.store.cart.complete(live.cart.id);

    if (result.type === "order") {
      // The cart is gone the moment it becomes an order. Keeping the cookie
      // would leave the customer holding a cart that rejects every mutation.
      await clearCartId();
      return { kind: "order", orderId: result.order.id };
    }

    const message =
      typeof result.error?.message === "string"
        ? result.error.message
        : "Die Bestellung konnte nicht abgeschlossen werden.";
    console.warn(`[checkout] complete returned a cart: ${message}`);
    // Bestand reicht nicht mehr: Artikel und Menge nennen statt Medusas Text.
    const stock = await stockMessage(live, message);
    return { kind: "error", message: stock ?? message };
  } catch (error) {
    logCartError("checkout:complete", error);
    const stock = await stockMessage(live, error);
    if (stock) return { kind: "error", message: stock };
    return {
      kind: "error",
      message:
        "Die Bestellung konnte nicht abgeschlossen werden. Es wurde nichts belastet.",
    };
  }
}
