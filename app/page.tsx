import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/PageLoading";
import type { CategoryView } from "@/lib/types";
import { getProducts, getCategories } from "@/lib/data";
import { ProductCard } from "@/components/ProductCard";
import { HomeIntro } from "@/components/intro/HomeIntro";
import { JsonLd } from "@/components/JsonLd";
import { CategoryComingSoon } from "./CategoryComingSoon";
import { PRICE_CLAIM, SHIPPING } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import { breadcrumbJsonLd, graph, itemListJsonLd } from "@/lib/seo/jsonld";
import { relatedCategories } from "@/lib/related-categories";
import { getTenantContext } from "@/lib/tenant/context";
import styles from "./page.module.css";

/**
 * STARTSEITE = KATALOG.
 *
 * Der Betreiber will Besucher ohne Umweg vor der Ware («zeige nach der
 * Animation direkt den Hauptshop anstatt so eine komische Landingpage»,
 * bestätigt: «shop ist die neue startseite»). Die frühere Landingpage
 * (Hero, Trust-Grid, Manifest, «Zum Shop»-Knopf) ist ersatzlos entfallen —
 * ihre zwei erhaltenswerten Aussagen stehen bereits seitenweit im Rahmen:
 * das Versandversprechen (gratis ab CHF 69) im Promo-Streifen des Headers
 * und im Footer, die Zahlarten im Header-Streifen (kurz) und im Footer
 * (vollständige Liste). Hier wird nichts davon gedoppelt.
 *
 * Die alte Adresse /shop bleibt als dauerhafte Umleitung hierher bestehen
 * (app/shop/page.tsx); intern verlinkt niemand mehr dorthin.
 *
 * Der `kategorie`-Parameter wird gegen die GELADENEN Kategorien geprüft
 * (exakter Handle-Vergleich), nicht gegen eine fest verdrahtete Liste —
 * der Betreiber legt Kategorien im Admin an, und jede davon muss hier
 * ohne Code-Änderung funktionieren. Unbekannte Werte ergeben ein echtes
 * 404. Die Kategorienavigation lebt im
 * Header (`CategoryNav`) — diese Seite rendert bewusst keine eigene
 * Filterreihe (Begründung unverändert: keine doppelten Linkreihen).
 */

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function activeCategory(searchParams: PageProps["searchParams"]) {
  const { kategorie } = await searchParams;
  const raw = Array.isArray(kategorie) ? kategorie[0] : kategorie;
  if (!raw) return undefined;
  const found = (await getCategories()).find((c) => c.handle === raw);
  if (!found) notFound();
  return found;
}

/**
 * Der Titel bleibt der Site-Standard aus dem Layout («<Storename> — Online
 * Headshop Schweiz») — er beschreibt den Shop bereits und ist mandantenfähig.
 * Nur die Beschreibung ist seitenspezifisch: sie beschreibt jetzt den
 * Katalog, nicht mehr die Landingpage.
 */
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const activeCat = await activeCategory(searchParams);
  return {
    description: `Papers, Filter und Zubehör für die Schweiz. Faire Preise, Versand ab Lager, Gratisversand ab ${formatPrice(SHIPPING.freeThreshold)}.`,
    alternates: {
      canonical: activeCat ? `/?kategorie=${encodeURIComponent(activeCat.handle)}` : "/",
    },
  };
}

export default async function HomePage({ searchParams }: PageProps) {
  const activeCat = await activeCategory(searchParams);
  // Erst prüfen, dann streamen: ausserhalb der Grenze setzt notFound() noch ein 404.
  return (
    <>
      {/* Erstbesuchs-Intro: legt sich ÜBER den weiterhin serverseitig
          gerenderten Katalog (Overlay, kein Ersatz). Abfolge mit
          Altersabfrage/Cookie-Hinweis, SEO und Barrierefreiheit sind
          in components/intro/HomeIntro.tsx begründet; alle Zeiten
          stehen in lib/intro/timings.ts. */}
      <HomeIntro />
      <Suspense key={activeCat?.handle} fallback={<PageLoading />}>
        <Catalog activeCat={activeCat} />
      </Suspense>
    </>
  );
}

async function Catalog({ activeCat }: { activeCat: CategoryView | undefined }) {
  const products = await getProducts({ category: activeCat?.handle });
  const tenant = await getTenantContext();

  // «Filter» und «Filter & Tips» gehören zusammen (lib/related-categories.ts):
  // die Kategorieansicht verweist auf ihre Schwester.
  const related = activeCat
    ? relatedCategories(activeCat.handle, await getCategories())
    : [];

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
    : PRICE_CLAIM.full;

  /**
   * Der Katalog als `ItemList`: die Startseite ZEIGT Produkte, sie IST keins.
   * Ohne diese Auskunft muss ein Crawler aus einem Raster von Kacheln raten,
   * was hier die Hauptsache ist — und Kategoriefilter (`?kategorie=…`) sind
   * eigene Listen, keine Dubletten derselben Seite.
   *
   * Die Brotkrümel bilden denselben Weg ab wie die Kategorienavigation im
   * Header. Auf der ungefilterten Startseite ist es ein einziger Eintrag —
   * dann ist die Liste der Weg.
   *
   * Steht nichts im Regal («bald verfügbar»), wird auch nichts ausgezeichnet:
   * eine leere ItemList ist eine Aussage über ein leeres Sortiment.
   */
  const base = `https://${tenant.theme.domain}`;
  const jsonLd = graph(
    products.length
      ? itemListJsonLd({
          products,
          domain: tenant.theme.domain,
          name: activeCat ? activeCat.name : "Sortiment",
        })
      : undefined,
    breadcrumbJsonLd([
      { name: "Shop", url: activeCat ? `${base}/` : undefined },
      ...(activeCat ? [{ name: activeCat.name }] : []),
    ]),
  );

  return (
    <>
      <JsonLd data={jsonLd} />
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
          {related.length > 0 && (
            <p className={styles.related}>
              Passt dazu:{" "}
              {related.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && ", "}
                  {/* Kodiert: Handles können `&` oder Umlaute enthalten. */}
                  <Link href={`/?kategorie=${encodeURIComponent(c.handle)}`}>
                    {c.name}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </header>

        {comingSoon && activeCat ? (
          <CategoryComingSoon categoryName={activeCat.name} />
        ) : products.length === 0 ? (
          // Ohne Kategorie heisst leer: das Backend liefert gar nichts.
          // Kein CTA — der würde nur auf diese Seite selbst zeigen.
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>Nichts gefunden</h2>
            <p>
              Im Sortiment ist gerade nichts verfügbar. Schau später noch
              einmal vorbei.
            </p>
          </div>
        ) : (
          <div className={styles.grid}>
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
