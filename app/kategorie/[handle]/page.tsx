import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/PageLoading";
import { ProductCard } from "@/components/ProductCard";
import { ShopTrust } from "@/components/ShopTrust";
import { ProduktWunsch } from "@/components/ProduktWunsch";
import { JsonLd } from "@/components/JsonLd";
import { CategoryText } from "@/components/CategoryText";
import { CategoryComingSoon } from "@/app/CategoryComingSoon";
import { getCategories, getProducts } from "@/lib/data";
import { categoryAnchor, categoryContent } from "@/lib/content/kategorien";
import { categoryPath } from "@/lib/seo/category-url";
import { faqJsonLd } from "@/lib/seo/faq-jsonld";
import { breadcrumbJsonLd, graph, itemListJsonLd } from "@/lib/seo/jsonld";
import { getTenantContext } from "@/lib/tenant/context";
import type { CategoryView } from "@/lib/types";
import pageStyles from "@/app/page.module.css";
import styles from "./kategorie.module.css";

/**
 * KATEGORIESEITE (PLP) unter /kategorie/<handle>.
 *
 * Eigener Pfad statt `/?kategorie=…`: jede Kategorie hat damit eine saubere,
 * serverseitig gerenderte Adresse mit eigenem Titel, eigener Beschreibung,
 * H1, Kurztext, Ratgebertext und FAQ — Texte in lib/content/kategorien.ts
 * (überschreibbar über die Medusa-Kategorie-Metadaten). Die alte Adresse
 * leitet proxy.ts mit 301 hierher um.
 *
 * Das Handle wird gegen die GELADENEN Kategorien geprüft (exakt); jede im
 * Admin angelegte Kategorie funktioniert ohne Code-Änderung, unbekannte
 * ergeben ein echtes 404.
 */

type PageProps = { params: Promise<{ handle: string }> };

async function loadCategory(params: PageProps["params"]): Promise<{
  category: CategoryView;
  all: CategoryView[];
}> {
  const { handle: raw } = await params;
  let handle = raw;
  try {
    handle = decodeURIComponent(raw);
  } catch {
    notFound();
  }
  const all = await getCategories();
  const category = all.find((c) => c.handle === handle);
  if (!category) notFound();
  return { category, all };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await loadCategory(params);
  const content = categoryContent(category);
  const url = categoryPath(category.handle);
  return {
    // Das Layout hängt « | <Shop>» an.
    title: content.title,
    description: content.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: content.title,
      description: content.metaDescription,
      url,
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { category, all } = await loadCategory(params);
  // Erst prüfen, dann streamen: ausserhalb der Grenze setzt notFound() noch ein 404.
  return (
    <Suspense fallback={<PageLoading />}>
      <CategoryListing category={category} all={all} />
    </Suspense>
  );
}

async function CategoryListing({
  category,
  all,
}: {
  category: CategoryView;
  all: CategoryView[];
}) {
  const [products, tenant] = await Promise.all([
    getProducts({ category: category.handle }),
    getTenantContext(),
  ]);
  const content = categoryContent(category);
  const base = `https://${tenant.theme.domain}`;

  /**
   * Eine LEERE KATEGORIE ist kein Fehlschlag: der Betreiber hat sie angelegt,
   * die Ware kommt («bald verfügbar», CategoryComingSoon).
   */
  const comingSoon = products.length === 0;

  const jsonLd = graph(
    products.length
      ? itemListJsonLd({
          products,
          domain: tenant.theme.domain,
          name: category.name,
        })
      : undefined,
    breadcrumbJsonLd([
      { name: "Shop", url: `${base}/` },
      { name: category.name },
    ]),
    faqJsonLd(content.faqs),
  );

  const others = all
    .filter((c) => c.handle !== category.handle)
    .map((c) => ({ href: categoryPath(c.handle), label: categoryAnchor(c) }));

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className={`page ${pageStyles.wrap}`}>
        <nav className={styles.crumbs} aria-label="Brotkrümelnavigation">
          <Link href="/">Shop</Link>
          <span aria-hidden="true">/</span>
          <span className={styles.crumbCurrent} aria-current="page">
            {category.name}
          </span>
        </nav>

        <header className={pageStyles.head}>
          <div className={pageStyles.headRow}>
            <h1 className={pageStyles.title}>{content.h1}</h1>
            {!comingSoon && (
              <p className={pageStyles.count} aria-live="polite">
                <span className="tnum">{products.length}</span>{" "}
                {products.length === 1 ? "Produkt" : "Produkte"}
              </p>
            )}
          </div>
          <p className={styles.intro}>{content.intro}</p>
          <ShopTrust />
        </header>

        {comingSoon ? (
          <CategoryComingSoon categoryName={category.name} />
        ) : (
          <div id="sortiment" className={pageStyles.grid}>
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        )}

        <CategoryText content={content} others={others} />

        {/* Am Ende jeder Liste, auch bei leerer Kategorie. */}
        <ProduktWunsch kategorie={category.name} />
      </div>
    </>
  );
}
