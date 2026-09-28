import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/PageLoading";
import type { ProductView } from "@/lib/types";
import { getProduct, getRelatedProducts, getCategory } from "@/lib/data";
import { ProductImage } from "@/components/ProductImage";
import { ProductCard } from "@/components/ProductCard";
import { AddToCart } from "@/components/AddToCart";
import { VariantHero } from "@/components/VariantHero";
import { VariantSelectionProvider } from "@/components/VariantSelection";
import { TierSelectionProvider } from "@/components/TierSelection";
import { TierGallery } from "@/components/TierGallery";
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
 * DIESE SEITE WIRD IMMER JE ANFRAGE GERENDERT — und das ist kein Feintuning,
 * sondern der Unterschied zwischen «Produktseite» und «500».
 *
 * Hier stand ein `generateStaticParams()` (plus `dynamicParams = true`), das
 * seine Handles aus dem Mock-Katalog nahm, damit der Build nie das Backend
 * fragen muss. In PRODUKTION liefert diese Liste bewusst NICHTS — es wurde
 * also ohnehin keine einzige Produktseite vorgerendert. Trotzdem stellte
 * allein die EXISTENZ der Funktion das Segment auf statische Erzeugung (im
 * Build-Protokoll: «● /products/[handle]»), und dann rendert Next auch die
 * erst bei der Anfrage erzeugten Adressen im statischen Modus. Dort ist
 * `headers()` verboten — und genau das ruft die Mandantenauflösung
 * (`getTenantContext()`) auf. Next bricht mit
 * `digest: "DYNAMIC_SERVER_USAGE"` ab, der Server antwortet mit einem
 * nackten 500 «Internal Server Error», BEVOR irgendetwas gerendert ist.
 *
 * Wirkung auf test.jibbit.ch: JEDE Produktseite tot — auch ein unbekannter
 * Handle, der ein 404 liefern müsste, denn der Abbruch passiert schon vor
 * `notFound()`. Die Startseite blieb heil, weil sie kein
 * `generateStaticParams` hat und deshalb ohnehin dynamisch ist.
 *
 * Der Schalter `dynamic = "force-dynamic"` unten sagt aus, was ohnehin gilt.
 * Er allein hat im Versuch aber nicht gereicht: solange das
 * `generateStaticParams` danebenstand, wies das Build-Protokoll die Route
 * weiter als «●» aus. Deshalb ist die Funktion ENTFERNT und nicht nur der
 * Schalter gesetzt. Das kostet nichts — sie war in Produktion leer, und die
 * Seite ist wegen `headers()` sowieso nicht statisch (siehe den Kommentar in
 * `ProductDetails`). Ein Build fragt das Backend weiterhin nie.
 *
 * Wer hier wieder ein `generateStaticParams` einsetzen will, muss zuerst die
 * Mandantenauflösung aus dem statischen Pfad holen — sonst kommt genau dieses
 * 500 zurück.
 */
export const dynamic = "force-dynamic";

/**
 * ⚠️ OHNE DIESE ZEILE ANTWORTET IN PRODUKTION JEDE PRODUKTSEITE MIT 500.
 *
 * `generateStaticParams` macht aus dieser Route eine statisch erzeugte — und
 * in Produktion gibt `getStaticProductHandles()` absichtlich eine LEERE Liste
 * zurück. Next rendert einen unbekannten Handle deshalb beim ersten Aufruf im
 * STATISCHEN Kontext und legt das Ergebnis ab. Dort sind Request-APIs
 * verboten, und diese Seite braucht zwingend eine: die Mandantenauflösung
 * liest `headers()` (lib/tenant/context.ts). Das Ergebnis ist ein
 * `DYNAMIC_SERVER_USAGE`-Fehler und eine 500 statt der Produktseite — im
 * `next dev` nicht zu sehen, weil dort echte Handles vorgerendert werden.
 *
 * Die Route ist ohnehin nie statisch cachebar: jeder Mandant bekommt unter
 * derselben Adresse einen anderen Shop. `force-dynamic` schreibt nur hin, was
 * schon gilt. `generateStaticParams` bleibt stehen, weil es im `next dev` die
 * bekannten Handles vorwärmt.
 */
export const dynamic = "force-dynamic";

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
   * Stufenfotos aus der Preistabelle («24er Display» zeigt die Box). Nur bei
   * Produkten mit einer Variante — dem Modell der Preistabelle; ältere
   * Produkte mit Display-Variante behalten die bisherige Galerie.
   */
  const imageByTier: Record<number, string> = {};
  for (const [min, extra] of Object.entries(product.tierExtras ?? {})) {
    if (extra.image && product.images.includes(extra.image)) {
      imageByTier[Number(min)] = extra.image;
    }
  }
  const tierImages = new Set(Object.values(imageByTier));
  const useTierGallery =
    product.variants.length === 1 && tierImages.size > 0;

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
        <TierSelectionProvider>
        <div className={styles.layout}>
          <div className={styles.gallery}>
            {useTierGallery ? (
              <TierGallery
                images={product.images}
                imageByTier={imageByTier}
                hero={Object.fromEntries(
                  product.images.map((src, i) => [
                    src,
                    <ProductImage
                      key={src}
                      src={src}
                      alt={i === 0 ? product.title : `${product.title} — Ansicht ${i + 1}`}
                      product={product}
                      variant="hero"
                      // Erstes Bild = LCP; Stufenfotos vorladen, damit der
                      // Wechsel beim Tippen auf eine Stufe sofort sitzt.
                      priority={i === 0 || tierImages.has(src)}
                    />,
                  ]),
                )}
                thumb={Object.fromEntries(
                  product.images.map((src, i) => [
                    src,
                    <ProductImage
                      key={src}
                      src={src}
                      alt={`${product.title} — Ansicht ${i + 1}`}
                      product={product}
                      variant="thumb"
                    />,
                  ]),
                )}
              />
            ) : gallery.interactive && gallery.defaultSrc ? (
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
            {!useTierGallery && product.images.length > 1 && (
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
                Versand {formatPrice(SHIPPING.rate)} — gratis ab{" "}
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
        </TierSelectionProvider>
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
