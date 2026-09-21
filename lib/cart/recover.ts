/**
 * WARENKORB MIT TOTEN ARTIKELN — erkennen, ehrlich melden, neu aufbauen.
 *
 * ══ DER FEHLER, DEN DAS HIER BEHEBT ═══════════════════════════════════════
 * Ein Medusa-Cart speichert seine Positionen als Schnappschuss (Titel, Preis,
 * Variante). `GET /store/carts/:id` liest nur diesen Schnappschuss — der
 * Warenkorb wird also tadellos angezeigt, auch wenn das Produkt dahinter
 * längst gelöscht oder nicht mehr veröffentlicht ist.
 *
 * JEDE schreibende Cart-Route dagegen (Adresse setzen, Artikel hinzufügen,
 * Menge ändern, Position löschen, Versandart wählen) läuft durch
 * `refreshCartItemsWorkflow`, und der prüft jede Position gegen den Katalog.
 * Eine einzige tote Variante reicht, und Medusa antwortet mit 400:
 *
 *   «Variants variant_… do not exist or belong to a product that is not
 *    published»  bzw.  «Variants with IDs variant_… do not have a price»
 *
 * Der Cart ist dann dauerhaft blockiert. Auch Löschen hilft nicht: das
 * Löschen EINER Position frischt die übrigen auf und scheitert an der
 * nächsten toten. So ist es auf test.jibbit.ch passiert — ein Cart mit den
 * Demo-Artikeln aus dem Seed, die der echte Katalog abgelöst hat. Die Kasse
 * meldete «nicht erreichbar, bitte nochmals versuchen», was falsch war und
 * beim nächsten Versuch genauso scheiterte.
 *
 * ══ DIE AUFLÖSUNG ═════════════════════════════════════════════════════════
 * Ein neuer Cart, in den nur die noch bestellbaren Positionen einzeln
 * übernommen werden (E-Mail und Adressen gleich mit). Was sich nicht mehr
 * übernehmen lässt, wird der Kundin mit Namen genannt. Einzeln statt in einem
 * Rutsch, weil ein einziger toter Artikel in `items: [...]` den ganzen
 * Aufbau scheitern liesse und Medusa nicht immer alle IDs nennt.
 *
 * Rein bis auf das übergebene SDK — testbar ohne Next.
 */

import type Medusa from "@medusajs/js-sdk";
import type { HttpTypes } from "@medusajs/types";
import { toCartLineView } from "./adapter";
import type { CartLineView } from "./types";

const STALE_PATTERNS = [
  /do not exist or belong to a product that is not published/i,
  /do not have a price/i,
];

function statusOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const e = error as { status?: unknown; statusCode?: unknown };
  const s = e.status ?? e.statusCode;
  return typeof s === "number" ? s : undefined;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "";
}

/**
 * Die Varianten, an denen Medusa den Cart abgelehnt hat — oder `null`, wenn
 * der Fehler NICHT von toten Artikeln kommt. Ein leeres Array heisst:
 * «tote Artikel, aber Medusa hat nicht gesagt welche».
 */
export function staleVariantIds(error: unknown): string[] | null {
  const status = statusOf(error);
  if (status !== undefined && status !== 400) return null;
  const message = messageOf(error);
  if (!STALE_PATTERNS.some((p) => p.test(message))) return null;
  return Array.from(new Set(message.match(/variant_[0-9A-Za-z]+/g) ?? []));
}

export const NETWORK_ERROR =
  "Der Warenkorb ist gerade nicht erreichbar. Bitte in einem Moment nochmals versuchen.";

export const REJECTED_ERROR =
  "Der Warenkorb liess sich nicht aktualisieren. Bitte lade die Seite neu. " +
  "Klappt es dann immer noch nicht, schreib uns kurz — wir helfen sofort weiter.";

/**
 * Eine Meldung, die stimmt. «Nicht erreichbar, gleich nochmals versuchen» nur,
 * wenn das Backend wirklich nicht antwortet (kein Status, 5xx, 429). Eine
 * 4xx-Ablehnung wird durch Warten nicht besser — dort braucht die Kundin einen
 * anderen Ausweg.
 */
export function describeCartFailure(error: unknown): string {
  const status = statusOf(error);
  if (status === undefined || status >= 500 || status === 429) {
    return NETWORK_ERROR;
  }
  return REJECTED_ERROR;
}

function lineLabel(line: CartLineView): string {
  return line.variantTitle ? `${line.title} (${line.variantTitle})` : line.title;
}

/** Die Meldung an die Kundin, nachdem tote Artikel entfernt wurden. */
export function droppedNotice(
  dropped: readonly CartLineView[],
  remainingCount: number,
): string {
  if (dropped.length === 0) {
    return "Dein Warenkorb wurde aktualisiert, weil sich das Sortiment geändert hat.";
  }
  const names = dropped.map((l) => `«${lineLabel(l)}»`).join(", ");
  const head =
    dropped.length === 1
      ? `${names} ist nicht mehr erhältlich und wurde aus dem Warenkorb entfernt.`
      : `Diese Artikel sind nicht mehr erhältlich und wurden aus dem Warenkorb entfernt: ${names}.`;
  return remainingCount > 0
    ? `${head} Der Rest deiner Bestellung ist unverändert.`
    : `${head} Dein Warenkorb ist jetzt leer — im Shop findest du das aktuelle Sortiment.`;
}

type AddressLike = HttpTypes.StoreCartAddress | null | undefined;

/**
 * Nur die Felder, die `POST /store/carts` annimmt — der Validator ist
 * `.strict()`, eine mitgeschleppte `id` oder `created_at` liesse den ganzen
 * Neuaufbau scheitern.
 */
function toAddressPayload(address: AddressLike) {
  if (!address?.country_code) return undefined;
  const pick = (v: string | null | undefined) => v ?? undefined;
  return {
    first_name: pick(address.first_name),
    last_name: pick(address.last_name),
    company: pick(address.company),
    address_1: pick(address.address_1),
    address_2: pick(address.address_2),
    postal_code: pick(address.postal_code),
    city: pick(address.city),
    country_code: address.country_code,
    province: pick(address.province),
    phone: pick(address.phone),
  };
}

export interface RebuildResult {
  cart: HttpTypes.StoreCart;
  dropped: CartLineView[];
}

/**
 * Baut aus einem blockierten Cart einen neuen, bestellbaren.
 *
 * `knownDead` sind die Varianten, die Medusa im Fehler schon genannt hat —
 * die werden gar nicht erst versucht. Jede weitere Position wird einzeln
 * übernommen; scheitert sie wieder an «tot», fällt sie weg, jeder ANDERE
 * Fehler bricht ab (dann ist das Backend das Problem, nicht der Katalog).
 */
export async function rebuildCart(
  sdk: Pick<Medusa, "store">,
  stale: HttpTypes.StoreCart,
  options: { regionId?: string; knownDead: readonly string[]; fields: string },
): Promise<RebuildResult> {
  const dead = new Set(options.knownDead);
  const regionId = options.regionId ?? stale.region_id ?? undefined;

  const createBody: HttpTypes.StoreCreateCart = {};
  if (regionId) createBody.region_id = regionId;
  if (stale.email) createBody.email = stale.email;
  const shipping = toAddressPayload(stale.shipping_address);
  if (shipping) createBody.shipping_address = shipping;
  const billing = toAddressPayload(stale.billing_address);
  if (billing) createBody.billing_address = billing;

  let { cart } = await sdk.store.cart.create(createBody, {
    fields: options.fields,
  });

  const dropped: CartLineView[] = [];
  for (const item of stale.items ?? []) {
    const line = toCartLineView(item);
    if (!item.variant_id || dead.has(item.variant_id) || !(item.quantity > 0)) {
      dropped.push(line);
      continue;
    }
    try {
      ({ cart } = await sdk.store.cart.createLineItem(
        cart.id,
        { variant_id: item.variant_id, quantity: item.quantity },
        { fields: options.fields },
      ));
    } catch (error) {
      if (staleVariantIds(error) === null) throw error;
      dropped.push(line);
    }
  }

  return { cart, dropped };
}
