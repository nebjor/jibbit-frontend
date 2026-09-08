import type { Metadata } from "next";
import Link from "next/link";
import { getProducts, getCategories } from "@/lib/data";
import { ProductCard } from "@/components/ProductCard";
import { CategoryComingSoon } from "./CategoryComingSoon";
import styles from "./shop.module.css";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Papers, Filter und Zubehör für die Schweiz. Faire Preise, Versand ab Lager, Gratisversand ab CHF 69.",
};

/**
 * Die Kategorienavigation lebt im Header (`CategoryNav`) — diese Seite
 * rendert bewusst KEINE eigene Filterreihe mehr. Vorher standen dieselben
 * Kategorielinks doppelt übereinander (Header-Leiste + Filterknöpfe) und
 * zusammen mit dem grossen Seitenkopf war auf einem Notebook die halbe
 * Bildschirmhöhe belegt, bevor das erste Produkt kam.
 *
 * Der `kategorie`-Parameter wird gegen die GELADENEN Kategorien geprüft
 * (exakter Handle-Vergleich), nicht gegen eine fest verdrahtete Liste —
 * der Betreiber legt Kategorien im Admin an, und jede davon muss hier
 * ohne Code-Änderung funktionieren. Unbekannte Werte fallen auf „Alles“
 * zurück statt auf eine leere Seite.
 */
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.kategorie)
    ? params.kategorie[0]
    : params.kategorie;

  const categories = await getCategories();
  const activeCat = categories.find((c) => c.handle === raw);
  const products = await getProducts({ category: activeCat?.handle });

  /**
   * Eine LEERE KATEGORIE ist kein Fehlschlag: der Betreiber hat sie angelegt,
   * die Ware kommt. Sie sagt deshalb «bald verfügbar» (CategoryComingSoon) —
   * als Standard für jede produktlose Kategorie, ohne Sonderfall je Handle.
   * Der «0 Produkte»-Zähler entfällt dann; neben einer Ankündigung läse er
   * sich wie ein Fehler. Das nüchterne «Nichts gefunden» bleibt dem
   * ungefilterten Sortiment vorbehalten (Backend liefert gar nichts).
   */
  const comingSoon = products.length === 0 && activeCat !== undefined;

  const description = activeCat
    ? activeCat.description
    : "Das ganze Sortiment: Papers, Filter und Zubehör. Boxen und Displays sind pro Stück günstiger — es lohnt sich, kurz nachzurechnen.";

  return (
    <div className={`page ${styles.wrap}`}>
      <header className={styles.head}>
        <div className={styles.headRow}>
          <h1 className={styles.title}>
            {activeCat ? activeCat.name : "Shop"}
          </h1>
          {!comingSoon && (
            <p className={styles.count} aria-live="polite">
              <span className="tnum">{products.length}</span>{" "}
              {products.length === 1 ? "Produkt" : "Produkte"}
            </p>
          )}
        </div>
        {description ? <p className={styles.desc}>{description}</p> : null}
      </header>

      {comingSoon && activeCat ? (
        <CategoryComingSoon categoryName={activeCat.name} />
      ) : products.length === 0 ? (
        // Ohne Kategorie heisst leer: das Backend liefert gar nichts. Der
        // alte Text sprach von «dieser Kategorie» — das stimmt hier nicht.
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>Nichts gefunden</h2>
          <p>
            Im Sortiment ist gerade nichts verfügbar. Schau später noch einmal
            vorbei.
          </p>
          <Link href="/" className={styles.emptyCta}>
            Zur Startseite
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      )}
    </div>
  );
}
