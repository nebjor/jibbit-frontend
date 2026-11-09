import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/PageLoading";
import { getAktionen, getProducts, getCategories } from "@/lib/data";
import { formatGiltBis, heroAktion } from "@/lib/aktionen";
import { AktionsHero } from "@/components/AktionsHero";
import { ProductCard } from "@/components/ProductCard";
import { ShopTrust } from "@/components/ShopTrust";
import { ProduktWunsch } from "@/components/ProduktWunsch";
import { HomeIntro } from "@/components/intro/HomeIntro";
import { JsonLd } from "@/components/JsonLd";
import { FEATURES, PRICE_CLAIM, SHIPPING } from "@/lib/config";
import { CategoryLinks, HomeText } from "@/components/HomeLinks";
import { formatPrice } from "@/lib/format";
import { categoryPath } from "@/lib/seo/category-url";
import { RENAMED_CATEGORIES } from "@/lib/seo/legacy-redirects";
import { breadcrumbJsonLd, graph, itemListJsonLd } from "@/lib/seo/jsonld";
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
 * KATEGORIEN LIEGEN NICHT MEHR HIER. Jede Kategorie hat ihre eigene Seite
 * unter /kategorie/<handle> (app/kategorie/[handle]/page.tsx) mit eigenem
 * Titel, Text und FAQ. Die alte Form `/?kategorie=<handle>` leitet der Proxy
 * mit 301 dorthin um (proxy.ts); die Weiterleitung unten fängt dasselbe ab,
 * falls eine Anfrage am Proxy vorbeikommt (z. B. in Tests).
 *
 * Für die innere Verlinkung steht über dem Raster eine Reihe mit den
 * Kategorien (Linktext sagt, was dahinter liegt: «Papers kaufen») und unter
 * dem Raster ein kurzer Text mit Links auf Kategorien und beliebte Produkte.
 * Die Kategorienavigation im Header (`CategoryNav`) bleibt die Hauptnavigation.
 */

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/** Alte Kategorieadresse `/?kategorie=x` -> `/kategorie/x` (dauerhaft). */
async function redirectLegacyCategory(searchParams: PageProps["searchParams"]) {
  const { kategorie } = await searchParams;
  const raw = Array.isArray(kategorie) ? kategorie[0] : kategorie;
  if (!raw) return;
  const renamed = FEATURES.legacyOdooRedirects ? RENAMED_CATEGORIES[raw] : undefined;
  permanentRedirect(categoryPath(renamed ?? raw));
}

/**
 * Der Titel bleibt der Site-Standard aus dem Layout («<Storename> — Online
 * Headshop Schweiz») — er beschreibt den Shop bereits und ist mandantenfähig.
 * Nur die Beschreibung ist seitenspezifisch.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    description: `Papers, Filter und Zubehör für die Schweiz. Faire Preise, Versand ab Lager, Gratisversand ab ${formatPrice(SHIPPING.freeThreshold)}.`,
    alternates: { canonical: "/" },
  };
}

export default async function HomePage({ searchParams }: PageProps) {
  await redirectLegacyCategory(searchParams);
  return (
    <>
      {/* Erstbesuchs-Intro: legt sich ÜBER den weiterhin serverseitig
          gerenderten Katalog (Overlay, kein Ersatz). Abfolge mit
          Altersabfrage/Cookie-Hinweis, SEO und Barrierefreiheit sind
          in components/intro/HomeIntro.tsx begründet; alle Zeiten
          stehen in lib/intro/timings.ts. */}
      {FEATURES.intro ? <HomeIntro /> : null}
      <Suspense fallback={<PageLoading />}>
        <Catalog />
      </Suspense>
    </>
  );
}

async function Catalog() {
  const [products, categories, tenant] = await Promise.all([
    getProducts(),
    getCategories(),
    getTenantContext(),
  ]);
  // Hero nur bei einer Aktion auf alles.
  const hero = heroAktion(await getAktionen());

  /**
   * Der Katalog als `ItemList`: die Startseite ZEIGT Produkte, sie IST keins.
   * Ohne diese Auskunft muss ein Crawler aus einem Raster von Kacheln raten,
   * was hier die Hauptsache ist. Steht nichts im Regal, wird auch nichts
   * ausgezeichnet: eine leere ItemList ist eine Aussage über ein leeres
   * Sortiment.
   */
  const jsonLd = graph(
    products.length
      ? itemListJsonLd({
          products,
          domain: tenant.theme.domain,
          name: "Sortiment",
        })
      : undefined,
    breadcrumbJsonLd([{ name: "Shop" }]),
  );

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className={`page ${styles.wrap}`}>
        {hero && (
          <AktionsHero
            aktion={hero}
            bis={hero.giltBis ? formatGiltBis(hero.giltBis) : null}
          />
        )}
        <header className={styles.head}>
          <div className={styles.headRow}>
            <h1 className={styles.title}>Online Headshop Schweiz</h1>
            <p className={styles.count} aria-live="polite">
              <span className="tnum">{products.length}</span>{" "}
              {products.length === 1 ? "Produkt" : "Produkte"}
            </p>
          </div>
          <p className={styles.desc}>{PRICE_CLAIM.full}</p>
          {/* Vertrauenszeile: Google-Bewertung des Ladenlokals + drei
              Fakten — Texte in lib/trust.ts, Zahl aus lib/google-profil.ts. */}
          <ShopTrust />
        </header>

        <CategoryLinks categories={categories} />

        {products.length === 0 ? (
          // Leer heisst: das Backend liefert gar nichts.
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>Nichts gefunden</h2>
            <p>
              Im Sortiment ist gerade nichts verfügbar. Schau später noch
              einmal vorbei.
            </p>
          </div>
        ) : (
          <div id="sortiment" className={styles.grid}>
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 2} />
            ))}
          </div>
        )}

        <HomeText categories={categories} products={products} />

        <ProduktWunsch />
      </div>
    </>
  );
}
