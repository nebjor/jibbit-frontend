/**
 * Beschriftung für die Kachel, die ein Produkt OHNE Foto bekommt.
 *
 * WARUM DAS ÜBERHAUPT NÖTIG IST
 * Von 25 Artikeln haben 8 ein Foto. Eine Liste, in der zwei Drittel der
 * Kacheln leer bleiben, wirkt kaputter als eine ganz ohne Bilder — und ein
 * „Bild fehlt"-Symbol macht es schlimmer, weil es den Mangel zum Bildmotiv
 * erklärt. Stattdessen bekommt jede bildlose Kachel eine ruhige typografische
 * Fläche aus Markenname und Warenart in den Shopfarben. Sie steht in derselben
 * quadratischen Fassung wie ein Foto, das Raster bleibt also geschlossen,
 * egal wie viele Artikel fotografiert sind.
 *
 * Beide Angaben werden aus dem Produktnamen abgeleitet und nicht gepflegt:
 * `metadata.brand` setzt der Katalogimport nicht, und eine zweite Datenquelle,
 * die jemand pflegen müsste, wäre binnen eines Monats halb leer.
 */

import type { CategoryHandle } from "./types";

/**
 * Marken im Sortiment, absteigend nach Länge geprüft: „Zig Zag" muss vor
 * „Zig" greifen, und ohne feste Liste würde aus „dubi Aktivkohlefilter"
 * korrekt „dubi", aus „Elements King Slim Size" aber auch „Elements" — nur
 * eben zufällig, weil beide mit der Marke beginnen. Sobald ein Artikel
 * „Bio Slim von OCB" hiesse, wäre das erste Wort falsch.
 */
const BRANDS = [
  "Zig Zag",
  "Greengo",
  "Elements",
  "Smoking",
  "PURIZE",
  "Kailar",
  "Gizeh",
  "Angel",
  "dubi",
  "OCB",
  "RAW",
];

/**
 * Warenart, Reihenfolge entscheidend — dieselbe Falle wie in
 * backend/src/scripts/import-catalog.ts: „OCB Premium KSS Papers mit Filter"
 * enthält beide Stichwörter und ist ein Blättchen. Deshalb greifen die
 * Papers-Begriffe vor den Filter-Begriffen. „Aktivkohlefilter" steht ganz
 * oben, weil es sonst von der Filter-Regel zu „Filter" verkürzt würde und die
 * Kachel weniger sagt als sie könnte.
 */
const KINDS: [RegExp, string][] = [
  [/aschenbecher|ashtray/i, "Aschenbecher"],
  [/aktivkohlefilter/i, "Aktivkohlefilter"],
  [/\brolls?\b/i, "Rolls"],
  [/\bpapers?\b|\bkurz\b|gizeh|heftchen|blättchen/i, "Papers"],
  [/filter|\btips?\b/i, "Filter"],
];

/** Rückfall, wenn der Name nichts hergibt. */
const CATEGORY_LABELS: Record<CategoryHandle, string> = {
  papers: "Papers",
  filter: "Filter",
  zubehoer: "Zubehör",
};

/**
 * Markenname für die Platzhalterkachel.
 *
 * `brand` aus den Produktmetadaten hat Vorrang, sobald es jemand im Admin
 * pflegt — der abgeleitete Wert ist nur der Notnagel, nicht die Wahrheit.
 */
export function brandLabel(title: string, brand?: string): string {
  if (brand?.trim()) return brand.trim();

  const found = BRANDS.find((b) =>
    new RegExp(`(^|\\W)${b.replace(/\s+/g, "\\s+")}(\\W|$)`, "i").test(title),
  );
  if (found) return found;

  // Kein bekannter Hersteller: das erste Wort ist die beste verbleibende
  // Vermutung und im Zweifel immer noch besser als eine leere Fläche.
  return title.trim().split(/\s+/)[0] ?? "";
}

/** Warenart für die Platzhalterkachel, z.B. „Aktivkohlefilter". */
export function kindLabel(title: string, categoryHandle: CategoryHandle): string {
  const match = KINDS.find(([pattern]) => pattern.test(title));
  return match ? match[1] : CATEGORY_LABELS[categoryHandle];
}
