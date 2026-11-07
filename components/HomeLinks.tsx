import Link from "next/link";
import { SHIPPING } from "@/lib/config";
import { categoryAnchor } from "@/lib/content/kategorien";
import { formatPrice } from "@/lib/format";
import { categoryPath } from "@/lib/seo/category-url";
import type { CategoryView, ProductView } from "@/lib/types";
import styles from "@/app/page.module.css";

/** Beliebte Produkte für den Text unter dem Raster: «featured», sonst die ersten. */
function bestProducts(products: ProductView[], max = 6): ProductView[] {
  const featured = products.filter((p) => p.featured);
  return (featured.length >= 3 ? featured : products).slice(0, max);
}

/**
 * Kategorien als grosse, gut tippbare Links über dem Raster. Der Linktext
 * nennt, was man dort kauft («Papers kaufen») — das ist das Signal für die
 * Suche nach genau diesen Begriffen. Mobil drei schmale Kacheln in einer
 * Reihe, damit das Raster nicht aus dem ersten Bildschirm rutscht.
 */
export function CategoryLinks({ categories }: { categories: CategoryView[] }) {
  if (categories.length === 0) return null;
  return (
    <section className={styles.cats} aria-label="Beliebte Kategorien">
      {categories.map((c) => (
        <Link key={c.id} href={categoryPath(c.handle)} className={styles.cat}>
          {categoryAnchor(c)}
        </Link>
      ))}
    </section>
  );
}

/**
 * Kurzer Text unter dem Raster mit Links auf Kategorien und beliebte
 * Produkte. Die Linktexte sind die Namen der Kategorien bzw. Produkte —
 * beschreibend, kein «hier klicken».
 */
export function HomeText({
  categories,
  products,
}: {
  categories: CategoryView[];
  products: ProductView[];
}) {
  if (products.length === 0) return null;
  const best = bestProducts(products);
  return (
    <section className={styles.about} aria-labelledby="home-text-titel">
      <h2 id="home-text-titel">Dein Headshop für die Schweiz</h2>
      <p>
        Bei uns bestellst du Papers, Filter und Zubehör online, mit Versand ab
        Lager in der Schweiz und ohne Zoll. Ab {formatPrice(SHIPPING.freeThreshold)}{" "}
        Bestellwert ist der Versand gratis. Bezahlt wird mit TWINT, Kreditkarte
        oder PostFinance.
      </p>
      {categories.length > 0 && (
        <p>
          Im Sortiment:{" "}
          {categories.map((c, i) => (
            <span key={c.id}>
              {i > 0 && (i === categories.length - 1 ? " und " : ", ")}
              <Link href={categoryPath(c.handle)}>{categoryAnchor(c)}</Link>
            </span>
          ))}
          .
        </p>
      )}
      <h3>Beliebte Produkte</h3>
      <ul className={styles.best}>
        {best.map((p) => (
          <li key={p.id}>
            <Link href={`/products/${p.handle}`}>{p.title}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
