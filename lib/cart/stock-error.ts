/**
 * Medusa lehnt Warenkorb-Änderung, Zahlungsvorbereitung und Abschluss ab, wenn
 * der Bestand nicht reicht («Variant with id: … does not have the required
 * inventory», «insufficient inventory»). Hier wird daraus eine deutsche
 * Meldung, die Artikel und verfügbare Menge nennt.
 */

import type { CartLineView } from "./types";

const INSUFFICIENT = [
  /required inventory/i,
  /insufficient inventory/i,
  /out of stock/i,
  /not enough (stock|inventory)/i,
];

export function messageOfError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "";
}

export function isInsufficientInventory(error: unknown): boolean {
  const message = messageOfError(error);
  return INSUFFICIENT.some((p) => p.test(message));
}

type StockLine = Pick<
  CartLineView,
  "variantId" | "title" | "variantTitle" | "quantity" | "availableQuantity"
>;

function label(line: StockLine): string {
  return line.variantTitle ? `${line.title} (${line.variantTitle})` : line.title;
}

/** Ein vollständiger Satz je Position. */
function lineSentence(line: StockLine): string {
  const avail = line.availableQuantity;
  if (typeof avail !== "number") {
    return `Von «${label(line)}» ist nicht mehr genug an Lager.`;
  }
  return avail <= 0
    ? `«${label(line)}» ist ausverkauft.`
    : `Von «${label(line)}» sind nur noch ${avail} Stück verfügbar.`;
}

/**
 * Die Meldung zu einem Bestandsfehler, sonst null. Nennt Medusa die Variante,
 * wird genau diese Position beschrieben; sonst alle, die über dem Bestand
 * liegen.
 */
export function describeInsufficientInventory(
  error: unknown,
  lines: readonly StockLine[],
): string | null {
  if (!isInsufficientInventory(error)) return null;

  const named = new Set(messageOfError(error).match(/variant_[0-9A-Za-z]+/g) ?? []);
  let culprits = lines.filter((l) => named.has(l.variantId));
  if (!culprits.length) {
    culprits = lines.filter(
      (l) => typeof l.availableQuantity === "number" && l.quantity > l.availableQuantity,
    );
  }

  const tail = "Bitte passe die Menge im Warenkorb an.";
  if (!culprits.length) {
    return `Von mindestens einem Artikel ist nicht mehr genug an Lager. ${tail}`;
  }
  return `${culprits.map(lineSentence).join(" ")} ${tail}`;
}
