/**
 * GTIN (EAN/UPC) — Prüfung und Normalisierung. Reine Funktionen.
 *
 * WARUM DIE STOREFRONT NOCHMAL PRÜFT
 * Der Katalog-Import im Backend prüft die Nummern bereits. Die drei Felder,
 * aus denen sie hier ankommt (`ean`, `upc`, `barcode` an der Medusa-Variante),
 * sind aber freie Textfelder, die jeder im Admin überschreiben kann — und
 * `barcode` darf dort auch ein hauseigener Lagercode sein. Eine GTIN mit
 * falscher Prüfziffer im Produkt-Schema ist schlimmer als keine: Google
 * ordnet das Angebot dann einem fremden Artikel zu oder verwirft es. Deshalb
 * gilt überall: ungültig oder fehlend -> es wird NICHTS ausgegeben.
 */

const GTIN_LENGTHS = [8, 12, 13, 14];

/**
 * GS1-Prüfziffer: von rechts, ohne die Prüfziffer selbst, abwechselnd mit 3
 * und 1 gewichten; die Prüfziffer ergänzt die Summe auf das nächste Vielfache
 * von 10. Gilt unverändert für GTIN-8, -12, -13 und -14.
 */
export function isValidGtin(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return false;
  if (!GTIN_LENGTHS.includes(value.length)) return false;
  // Lauter Nullen bestehen die Prüfziffer, sind aber ein Platzhalter.
  if (/^0+$/.test(value)) return false;

  const digits = [...value].map(Number);
  const check = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Rohwert aus dem Backend -> gültige GTIN oder `undefined`.
 *
 * Leerzeichen und Bindestriche fallen weg («8 595134 501285», so steht es
 * auf der Packung und so tippt man es ab). Alles andere wird nicht repariert,
 * sondern verworfen.
 */
export function normalizeGtin(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const cleaned = raw.replace(/[\s-]/g, "");
  return isValidGtin(cleaned) ? cleaned : undefined;
}

export type GtinProperty = "gtin8" | "gtin12" | "gtin13" | "gtin14";

/**
 * Die genaueste schema.org-Eigenschaft zur Länge. Google nimmt auch das
 * allgemeine `gtin`, empfiehlt aber ausdrücklich die spezifische.
 */
export function gtinProperty(gtin: string): GtinProperty {
  return `gtin${gtin.length}` as GtinProperty;
}
