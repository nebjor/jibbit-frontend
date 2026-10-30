/**
 * Aktion im Warenkorb nachziehen — Server-Teil (Entscheidung: ./aktion.ts).
 *
 * Der Eingriff ist ein Update ohne fachliche Wirkung: nur `metadata` bekommt
 * den Prüfmarker. Medusa 2.13.6 führt dabei trotzdem `updateCartWorkflow` →
 * `refreshCartItemsWorkflow` → `updateCartPromotionsWorkflow` (REPLACE) aus;
 * das nimmt alle laufenden automatischen Promotionen neu auf und entfernt
 * abgelaufene. `metadata` ist im Store-Update erlaubt.
 *
 * Fällt NIE aus: jeder Fehler ergibt den unveränderten Warenkorb — die
 * Anzeige darf nicht an der Aktion hängen, Medusa rechnet bei `complete` ohnehin.
 */

import "server-only";

import type Medusa from "@medusajs/js-sdk";
import type { HttpTypes } from "@medusajs/types";
import { getAktionen } from "@/lib/data";
import { AKTION_MARKER, AKTION_MARKER_ZEIT, pruefeAktion } from "./aktion";

/**
 * Höchstens ein Update pro Aufruf; nur wenn nötig (leerer Warenkorb: gar nichts,
 * auch kein `getAktionen`). `fields` = dieselbe Feldliste wie beim Lesen.
 */
export async function refreshAktionIfNeeded(
  sdk: Medusa,
  cart: HttpTypes.StoreCart,
  fields: string,
): Promise<HttpTypes.StoreCart> {
  if (!cart.items?.length || cart.completed_at) return cart;

  try {
    const jetzt = Date.now();
    const entscheid = pruefeAktion(cart, await getAktionen(), jetzt);
    if (!entscheid.nachziehen) return cart;

    const { cart: neu } = await sdk.store.cart.update(
      cart.id,
      {
        metadata: {
          ...(cart.metadata ?? {}),
          [AKTION_MARKER]: entscheid.stand,
          [AKTION_MARKER_ZEIT]: new Date(jetzt).toISOString(),
        },
      },
      { fields },
    );
    return neu;
  } catch (error) {
    console.error(
      `[cart] aktion-refresh: ${error instanceof Error ? error.message : String(error)}`,
    );
    return cart;
  }
}
