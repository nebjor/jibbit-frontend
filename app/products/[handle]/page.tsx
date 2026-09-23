import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/PageLoading";
import type { ProductView } from "@/lib/types";
import {
  getProduct,
  getRelatedProducts,
  getCategory,
  getStaticProductHandles,
} from "@/lib/data";
import { ProductImage } from "@/components/ProductImage";
import { ProductCard } from "@/components/ProductCard";
import { AddToCart } from "@/components/AddToCart";
import { VariantHero } from "@/components/VariantHero";
import { VariantSelectionProvider } from "@/components/VariantSelection";
import { TrackProductView } from "@/components/analytics/TrackProductView";
import { JsonLd } from "@/components/JsonLd";
import { SHIPPING, MIN_AGE } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import { VARIANT_PARAM, preselectedVariant } from "@/lib/pricing";
import { heroGallery } from "@/lib/variant-image";
import { getTenantContext } from "@/lib/tenant/context";
import { breadcrumbJsonLd, graph, productJsonLd } from "@/lib/seo/jsonld";
import styles from "./product.module.css";

/**
 * Handles come from the mock catalog, never from a live backend call — a build
 * must not depend on the backend being reachable. `dynamicParams` lets any
 * other handle render on demand once the backend is up.
 */
export function generateStaticParams() {
  return getStaticProductHandles().map((handle) => ({ handle }));
}

export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) notFound();
  return {
    title: product.title,
    description: product.description.slice(0, 160),
    // EINE kanonische Adresse je Produkt — ohne `?variant=`. Die Varianten-
    // URLs (siehe unten) zeigen dieselbe Seite mit anderer Vorauswahl; Google
    // verlangt für dieses Modell genau eine kanonische URL der ProductGroup.
    // Relativ: `metadataBase` aus dem Layout setzt die Mandantendomain davor.
    alternates: { canonical: `/products/${handle}` },
    openGraph: { title: product.title, description: product.subtitle },
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ handle }, query] = await Promise.all([params, searchParams]);
  const product = await getProduct(handle);
  if (!product) notFound();

  // Erst prüfen, dann streamen: ausserhalb der Grenze setzt notFound() noch ein 404.
  return (
    <Suspense fallback={<PageLoading />}>
      <ProductDetails product={product} query={query} />
    </Suspense>
  );
}

async function ProductDetails({
  product,
  query,
}: {
  product: ProductView;
  query: { [key: string]: string | string[] | undefined };
}) {
  /**
   * Vorauswahl: `?variant=<id>` gewinnt, sonst wie bisher das Einzelstück
   * (`defaultVariant`). Serverseitig gelesen, damit ein Crawler unter der
   * Varianten-URL aus dem JSON-LD (`Offer.url`) schon im HTML das Bild, den
   * Preis und die Verfügbarkeit DIESER Packung sieht. Die Seite ist wegen
   * der Mandantenauflösung (`headers()`) ohnehin dynamisch — der Parameter
   * kostet kein statisches Rendering.
   */
  const preselected = preselectedVariant(product.variants, query[VARIANT_PARAM]);

  const [related, category, tenant] = await Promise.all([
    getRelatedProducts(product),
    getCategory(product.categoryHandle),
    getTenantContext(),
  ]);

  /**
   * Bild je Variante: «Display» zeigt die Box, «1 Heftchen» das Einzelstück.
   * Die Zuordnung (samt Randfällen: Variante ohne Bild, nur ein Bild, nur
   * eine Variante) rechnet lib/variant-image.ts aus; hier wird nur gerendert.
   * Ist nichts umzuschalten, rendert die Seite exakt wie bisher.
   */
  const gallery = heroGallery(product);
  const initialSrc =
    (preselected && gallery.srcByVariant[preselected.id]) ?? gallery.defaultSrc;
  const variantFor = (src: string) =>
    product.variants.find((v) => gallery.srcByVariant[v.id] === src);

  /**
   * Strukturierte Daten für Rich Results / Google Shopping.
   *
   * Produkt und Brotkrümel stehen in EINEM `@graph`: dieselbe Seite, ein
   * Block, und `@id` verknüpft sie mit Organisation und Website aus dem
   * Layout. Gebaut wird alles in lib/seo/jsonld.ts — hier wird nur
   * eingesetzt, was die Seite ohnehin schon geladen hat.
   */
  const base = `https://${tenant.theme.domain}`;
  const jsonLd = graph(
    productJsonLd({
      product,
      domain: tenant.theme.domain,
      host: tenant.host,
      categoryName: category?.name,
    }),
    breadcrumbJsonLd([
      { name: "Shop", url: `${base}/` },
      ...(category
        ? [
            {
              name: category.name,
              // Kodiert, wie im sichtbaren Brotkrümel: Handles können `&`
              // oder Umlaute enthalten.
              url: `${base}/?kategorie=${encodeURIComponent(category.handle)}`,
            },
          ]
        : []),
      // Letzter Eintrag ohne `item` — das ist diese Seite.
      { name: product.title },
    ]),
  );

  return (
    <div className={`page ${styles.wrap}`}>
      <JsonLd data={jsonLd} />

      {/* «Produkt angesehen» — öffentliche Katalogdaten, keine Personendaten. */}
      <TrackProductView product={product} />

      <nav className={styles.crumbs} aria-label="Brotkrümelnavigation">
        <Link href="/">Shop</Link>
        <span aria-hidden="true">/</span>
        {category && (
          <>
            {/* Kodiert: Handles können `&` oder Umlaute enthalten. */}
            <Link href={`/?kategorie=${encodeURIComponent(category.handle)}`}>
              {category.name}
            </Link>
            <span aria-hidden="true">/</span>
          </>
        )}
        <span className={styles.crumbCurrent}>{product.title}</span>
      </nav>

      {/* Der Provider hält NUR die gewählte Variante — Galerie und Kaufbox
          lesen dieselbe Auswahl, die Seite selbst bleibt Server-Komponente.
          Vorauswahl: `?variant=`, sonst wie in AddToCart (defaultVariant).
          `urlParam` hält die Adresszeile bei jeder Auswahl auf der URL der
          gewählten Packung — dieselbe, die im JSON-LD steht. */}
      <VariantSelectionProvider
        initialId={preselected?.id ?? null}
        urlParam={product.variants.length > 1 ? VARIANT_PARAM : undefined}
      >
        <div className={styles.layout}>
          <div className={styles.gallery}>
            {gallery.interactive && gallery.defaultSrc ? (
              <VariantHero
                defaultSrc={gallery.defaultSrc}
                srcByVariant={gallery.srcByVariant}
                slides={gallery.slides.map((src) => {
                  const v = variantFor(src);
                  return {
                    src,
                    node: (
                      <ProductImage
                        src={src}
                        alt={v ? `${product.title} — ${v.title}` : product.title}
                        product={product}
                        variant="hero"
                        // Nur das anfangs sichtbare Bild ist das LCP-Element;
                        // die verborgenen laden lazy.
                        priority={src === initialSrc}
                      />
                    ),
                  };
                })}
              />
            ) : (
              <ProductImage
                src={product.images[0]}
                alt={product.title}
                product={product}
                variant="hero"
                priority
              />
            )}
            {product.images.length > 1 && (
              <div className={styles.thumbs}>
                {product.images.slice(1, 5).map((src, i) => (
                  <ProductImage
                    key={src}
                    src={src}
                    alt={`${product.title} — Ansicht ${i + 2}`}
                    product={product}
                    variant="thumb"
                  />
                ))}
              </div>
            )}
          </div>

          <div className={styles.info}>
            {product.brand && <p className="eyebrow">{product.brand}</p>}
            <h1 className={styles.title}>{product.title}</h1>
            <p className={styles.subtitle}>{product.subtitle}</p>

            <AddToCart product={product} />

            <p className={styles.desc}>{product.description}</p>

            <ul className={styles.signals}>
              <li>
                Versand ab {formatPrice(SHIPPING.letterRate)} — gratis ab{" "}
                {formatPrice(SHIPPING.freeThreshold)}
              </li>
              <li>Versand ab Lager in der Schweiz, kein Zoll</li>
              <li>Bezahlung mit TWINT, Kreditkarte oder PostFinance</li>
              <li>Abgabe nur an Personen ab {MIN_AGE} Jahren</li>
            </ul>

            <p className={styles.serviceLinks}>
              <Link href="/service/versand">Versand &amp; Lieferung</Link>
              <Link href="/service/rueckgabe">Rückgabe</Link>
              <Link href="/service/kontakt">Fragen? Schreib uns</Link>
            </p>
          </div>
        </div>
      </VariantSelectionProvider>

      {related.length > 0 && (
        <section className={styles.related}>
          <h2 className={styles.relatedTitle}>Passt dazu</h2>
          <div className={styles.relatedGrid}>
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
