/**
 * Meta-Description: Whitespace zusammenziehen (Beschreibungen haben
 * Aufzählungen mit Zeilenumbrüchen) und bei 160 Zeichen an einer
 * Wortgrenze kürzen statt mitten im Wort.
 */
export function metaDescription(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[,;:.\s-]+$/, "")}…`;
}

