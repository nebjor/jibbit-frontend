/**
 * Kategorien, die thematisch zusammengehören.
 *
 * «Filter» (Zigarettenfilter) und «Filter & Tips» (Aktivkohlefilter, Tips)
 * sind zwei Kategorien und bleiben es — wer die eine öffnet, sucht aber oft
 * die andere. Die Kategorieansicht verweist deshalb gegenseitig auf sie.
 * Das hilft auch der Suche: beide Ansichten sind über einen Textlink
 * verbunden und nicht nur über die Navigation.
 *
 * Gruppen von Handles. Eine Gruppe wirkt nur, soweit es ihre Kategorien im
 * Backend gibt — ein umbenannter oder gelöschter Handle ergibt keinen toten
 * Link, sondern keinen.
 */

import type { CategoryView } from "./types";

const RELATED_GROUPS: readonly (readonly string[])[] = [["filter", "filter-tips"]];

/** Die verwandten Kategorien zu `handle`, in der Reihenfolge der Gruppe. */
export function relatedCategories(
  handle: string,
  categories: readonly CategoryView[],
): CategoryView[] {
  const byHandle = new Map(categories.map((c) => [c.handle, c]));
  const related = RELATED_GROUPS.filter((group) => group.includes(handle))
    .flat()
    .filter((other) => other !== handle);
  return [...new Set(related)]
    .map((other) => byHandle.get(other))
    .filter((c): c is CategoryView => c !== undefined);
}
