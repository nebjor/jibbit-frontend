import Link from "next/link";
import { getFeaturedProducts, getCategories } from "@/lib/data";
import { ProductCard } from "@/components/ProductCard";
import { Logo } from "@/components/Logo";
import { STORE, SHIPPING, PAYMENT_METHODS } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import styles from "./page.module.css";

export default async function HomePage() {
  const [featured, categories] = await Promise.all([
    getFeaturedProducts(6),
    getCategories(),
  ]);

  return (
    <>
      {/* ---- HERO ---------------------------------------------------- */}
      <section className={styles.hero}>
        <div className={`page ${styles.heroInner}`}>
          <p className="eyebrow">Online Headshop &middot; Schweiz</p>
          <h1 className={styles.h1}>
            Bock auf <Logo size="lg" className={styles.heroLogo} />?
          </h1>
          <p className={styles.lead}>
            Kein Bock auf 6.&ndash; für Papers und Filter? Eben. Wir auch nicht.
            Darum gibt&rsquo;s bei uns Papers, Filter und Zubehör zu Preisen, die
            man nicht erst schönrechnen muss.
          </p>
          <p className={styles.tagline}>{STORE.tagline}</p>
          {/* One primary action on this view. */}
          <Link href="/shop" className={styles.cta}>
            Zum Shop
          </Link>
        </div>
      </section>

      {/* ---- TRUST SIGNALS ------------------------------------------- */}
      <section className={styles.trust} aria-label="Unsere Versprechen">
        <ul className={`page ${styles.trustGrid}`}>
          <li>
            <h2 className={styles.trustTitle}>
              Gratisversand ab {formatPrice(SHIPPING.freeThreshold)}
            </h2>
            <p>
              Darunter ab {formatPrice(SHIPPING.letterRate)}. Keine
              Überraschungen an der Kasse.
            </p>
          </li>
          <li>
            <h2 className={styles.trustTitle}>Versand aus der Schweiz</h2>
            <p>
              Kein Zoll, keine Wartezeit an der Grenze. Wir verschicken ab Lager.
            </p>
          </li>
          <li>
            <h2 className={styles.trustTitle}>
              {PAYMENT_METHODS.map((p) => p.label.split(" ")[0]).join(" & ")}
            </h2>
            <p>
              Zahl per TWINT, Kreditkarte oder PostFinance. Abgewickelt über
              Payrexx.
            </p>
          </li>
          <li>
            <h2 className={styles.trustTitle}>Von der Community</h2>
            <p>
              Sortiment und Preise entstehen mit den Leuten, die das Zeug auch
              wirklich brauchen.
            </p>
          </li>
        </ul>
      </section>

      {/* ---- CATEGORIES ---------------------------------------------- */}
      <section className={`page ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Kategorien</h2>
        <div className={styles.cats}>
          {categories.map((c) => (
            <Link
              key={c.id}
              /* Handles kommen aus dem Admin und können Sonderzeichen tragen
                 ("filter-&-tips"): unkodiert zerreisst das `&` den Query. */
              href={`/shop?kategorie=${encodeURIComponent(c.handle)}`}
              className={styles.cat}
            >
              <h3 className={styles.catName}>{c.name}</h3>
              <p className={styles.catDesc}>{c.description}</p>
              <span className={styles.catMore}>Ansehen &rarr;</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- FEATURED PRODUCTS --------------------------------------- */}
      <section className={`page ${styles.section}`}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Läuft gerade</h2>
          <Link href="/shop" className={styles.sectionLink}>
            Alle Produkte &rarr;
          </Link>
        </div>
        {featured.length === 0 ? (
          <p className={styles.empty}>
            Gerade keine Produkte verfügbar. Schau gleich nochmal vorbei.
          </p>
        ) : (
          <div className={styles.grid}>
            {featured.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 2} />
            ))}
          </div>
        )}
      </section>

      {/* ---- VALUE PROP ---------------------------------------------- */}
      <section className={styles.manifesto}>
        <div className={`page ${styles.manifestoInner}`}>
          <h2 className={styles.manifestoTitle}>Warum es uns gibt</h2>
          <p>
            Am Kiosk zahlst du für ein Heftchen Papers und eine Packung Filter
            schnell mal sechs Franken. Für Ware, die im Einkauf einen Bruchteil
            davon kostet. Wir fanden das schon immer daneben.
          </p>
          <p>
            jibbit ist der Versuch, das anders zu machen: faire Preise, ehrliche
            Mengenrabatte auf Boxen und Displays, und ein Sortiment, das sich
            nach dem richtet, was die Community tatsächlich bestellt — nicht nach
            dem, was die höchste Marge hat.
          </p>
          <Link href="/shop" className={styles.manifestoLink}>
            Sortiment ansehen &rarr;
          </Link>
        </div>
      </section>
    </>
  );
}
