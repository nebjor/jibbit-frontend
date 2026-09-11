import type { Metadata } from "next";
import Link from "next/link";
import { getProducts, getCategories } from "@/lib/data";
import { toSearchDoc } from "@/lib/search/server";
import { buildIndex, search } from "@/lib/search/engine";
import { ProductCard } from "@/components/ProductCard";
import type { ProductView } from "@/lib/types";
import styles from "./suche.module.css";

/**
 * Full results page ("alle Treffer anzeigen"). Runs the SAME engine as the
 * header combobox, server-side over the same data layer — one ranking, two
 * surfaces. Also the no-JS target of the header's GET form.
 *
 * noindex: internal search result pages are crawl-trap territory; products
 * are indexed on their own pages.
 */
export const metadata: Metadata = {
  title: "Suche",
  robots: { index: false, follow: true },
};

const MIN_QUERY = 2;

export default async function SuchePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = params.q;
  const q = (Array.isArray(raw) ? raw[0] : (raw ?? "")).trim();

  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);
  const index = buildIndex(products.map((p) => toSearchDoc(p, categories)));
  const hits = q.length >= MIN_QUERY ? search(index, q) : [];

  const byId = new Map(products.map((p) => [p.id, p]));
  const results = hits
    .map((h) => byId.get(h.doc.id))
    .filter((p): p is ProductView => Boolean(p));

  return (
    <div className={`page ${styles.wrap}`}>
      <header className={styles.head}>
        <p className="eyebrow">Suche</p>
        <h1 className={styles.title}>
          {q ? `Treffer für «${q}»` : "Suche"}
        </h1>
      </header>

      {/* Plain GET form: works without JavaScript, refines the query here. */}
      <form action="/suche" role="search" className={styles.form}>
        <input
          type="search"
          name="q"
          defaultValue={q}
          className={styles.input}
          placeholder="Suchen …"
          aria-label="Produkte suchen"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        <button type="submit" className={styles.submit}>
          Suchen
        </button>
      </form>

      {q.length < MIN_QUERY ? (
        <p className={styles.hint}>
          Gib mindestens zwei Zeichen ein — Tippfehler sind okay, wir suchen
          unscharf.
        </p>
      ) : (
        <>
          <p className={styles.count} aria-live="polite">
            <span className="tnum">{results.length}</span> Treffer für «{q}»
          </p>

          {results.length === 0 ? (
            <div className={styles.empty}>
              <h2 className={styles.emptyTitle}>Keine Treffer</h2>
              <p>
                Auch mit unscharfer Suche haben wir zu «{q}» nichts gefunden.
                Vielleicht führen wir den Artikel nicht — oder er heisst bei
                uns anders.
              </p>
              <Link href="/" className={styles.emptyCta}>
                Ganzes Sortiment ansehen
              </Link>
            </div>
          ) : (
            <div className={styles.grid}>
              {results.map((p, i) => (
                <ProductCard key={p.id} product={p} priority={i < 4} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
