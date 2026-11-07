"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { activeCategory } from "@/lib/nav";
import { categoryPath } from "@/lib/seo/category-url";
import type { CategoryView } from "@/lib/types";
import styles from "./CategoryNav.module.css";

/**
 * DIE Kategorienavigation — es gibt sie genau EINMAL im Dokument.
 *
 * Vorher standen dieselben Kategorielinks viermal im HTML (Desktop-Nav,
 * Mobile-Strip, Filterreihe der Shop-Seite, Footer). Jetzt rendert nur noch
 * diese Komponente sie; Desktop und Mobile teilen sich EIN DOM-Element,
 * das per CSS-Grid im Header umpositioniert wird (unter 900px eigene Zeile,
 * darüber in der Kopfleiste).
 *
 * Beliebig viele Kategorien: die Leiste bricht nie um, sondern scrollt
 * waagrecht (Scroll-Snap, Scrollbalken versteckt). Ein Auswahlmenü wäre die
 * Alternative, versteckt aber die Einträge hinter einem Tap und bringt bei
 * einer Handvoll Kategorien nur Reibung — der Streifen zeigt alles und
 * degradiert bei vielen Einträgen sauber zum Scrollen.
 *
 * Client-Komponente, weil die Aktiv-Markierung die aktuelle URL braucht;
 * die Kategorien selbst kommen als Props vom Server (nie hartkodiert).
 */
export function CategoryNav({ categories }: { categories: CategoryView[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ref = useRef<HTMLElement>(null);

  const active = activeCategory(
    pathname,
    searchParams.get("kategorie"),
    categories.map((c) => c.handle),
  );

  // Auf schmalen Screens kann der aktive Eintrag rechts aus dem Streifen
  // ragen — nach Navigation sichtbar scrollen. `nearest` verhindert, dass
  // die Seite dabei vertikal springt.
  useEffect(() => {
    ref.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <nav ref={ref} className={styles.nav} aria-label="Kategorien">
      <Link href="/" aria-current={active === "" ? "page" : undefined}>
        Alles
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          href={categoryPath(c.handle)}
          aria-current={active === c.handle ? "page" : undefined}
        >
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
