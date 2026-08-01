import type { Metadata } from "next";
import Link from "next/link";
import { getProducts, getCategories } from "@/lib/data";
import { ProductCard } from "@/components/ProductCard";
import type { CategoryHandle } from "@/lib/types";
import styles from "./shop.module.css";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Papers, Filter und Zubehör für die Schweiz. Faire Preise, Versand ab Lager, Gratisversand ab CHF 100.",
};

const VALID: CategoryHandle[] = ["papers", "filter", "zubehoer"];

function parseCategory(v: string | string[] | undefined): CategoryHandle | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && (VALID as string[]).includes(s) ? (s as CategoryHandle) : undefined;
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const active = parseCategory(params.kategorie);

  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ category: active }),
  ]);

  const activeCat = categories.find((c) => c.handle === active);

  return (
    <div className={`page ${styles.wrap}`}>
      <header className={styles.head}>
        <p className="eyebrow">Shop</p>
        <h1 className={styles.title}>{activeCat ? activeCat.name : "Alles"}</h1>
        <p className={styles.desc}>
          {activeCat
            ? activeCat.description
            : "Das ganze Sortiment: Papers, Filter und Zubehör. Boxen und Displays sind pro Stück günstiger — es lohnt sich, kurz nachzurechnen."}
        </p>
      </header>

      {/* Category filter — options come from the data layer, not hardcoded. */}
      <nav className={styles.filters} aria-label="Nach Kategorie filtern">
        <Link
          href="/shop"
          className={styles.filter}
          aria-current={!active ? "page" : undefined}
        >
          Alles
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/shop?kategorie=${c.handle}`}
            className={styles.filter}
            aria-current={active === c.handle ? "page" : undefined}
          >
            {c.name}
          </Link>
        ))}
      </nav>

      <p className={styles.count} aria-live="polite">
        <span className="tnum">{products.length}</span>{" "}
        {products.length === 1 ? "Produkt" : "Produkte"}
      </p>

      {products.length === 0 ? (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>Nichts gefunden</h2>
          <p>
            In dieser Kategorie ist gerade nichts verfügbar. Schau im ganzen
            Sortiment nach — dort wirst du eher fündig.
          </p>
          <Link href="/shop" className={styles.emptyCta}>
            Alle Produkte ansehen
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
