import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
import { SHIPPING, MIN_AGE } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import { defaultVariant } from "@/lib/pricing";
import { heroGallery } from "@/lib/variant-image";
import { getTenantContext } from "@/lib/tenant/context";
import { toMediaSrc } from "@/lib/media";
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
  if (!product) return { title: "Produkt nicht gefunden" };
  return {
    title: product.title,
    description: product.description.slice(0, 160),
    openGraph: { title: product.title, description: product.subtitle },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) notFound();

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
  const variantFor = (src: string) =>
    product.variants.find((v) => gallery.srcByVariant[v.id] === src);

  // Product schema for rich results / Google Shopping.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    // Absolut und über die eigene Domain: die Bild-URL aus Medusa zeigt auf
    // die Backend-Adresse des Tenants, die von aussen in der Regel gar nicht
    // erreichbar ist (im Compose `http://medusa:9000`). Siehe lib/media.ts.
    image: product.images
      .map((url) => toMediaSrc(url, tenant.host).src)
      .map((src) =>
        src.startsWith("/") ? `https://${tenant.theme.domain}${src}` : src,
      ),
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: product.currency,
      availability: product.variants.some((v) => v.inStock)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `https://${tenant.theme.domain}/products/${product.handle}`,
    },
  };

  return (
    <div className={`page ${styles.wrap}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* «Produkt angesehen» — öffentliche Katalogdaten, keine Personendaten. */}
      <TrackProductView product={product} />

      <nav className={styles.crumbs} aria-label="Brotkrümelnavigation">
        <Link href="/shop">Shop</Link>
        <span aria-hidden="true">/</span>
        {category && (
          <>
            {/* Kodiert: Handles können `&` oder Umlaute enthalten. */}
            <Link href={`/shop?kategorie=${encodeURIComponent(category.handle)}`}>
              {category.name}
            </Link>
            <span aria-hidden="true">/</span>
          </>
        )}
        <span className={styles.crumbCurrent}>{product.title}</span>
      </nav>

      {/* Der Provider hält NUR die gewählte Variante — Galerie und Kaufbox
          lesen dieselbe Auswahl, die Seite selbst bleibt Server-Komponente.
          Vorauswahl identisch mit AddToCart (defaultVariant). */}
      <VariantSelectionProvider
        initialId={defaultVariant(product.variants)?.id ?? null}
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
                        priority={src === gallery.initialSrc}
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
