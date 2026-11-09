import Link from "next/link";
import type { CategoryContent } from "@/lib/content/kategorien";
import styles from "./CategoryText.module.css";

/**
 * Der Textteil unter dem Raster einer Kategorie: Ratgebertext, FAQ und
 * Verweise auf die übrigen Kategorien (innere Verlinkung mit Linktexten, die
 * sagen, was dahinter liegt). Reines Server-Markup, alles steht im
 * ausgelieferten HTML. Die FAQ ist dieselbe Liste wie im FAQPage-Schema
 * (lib/seo/faq-jsonld.ts) — sichtbar und wortgleich.
 */
export function CategoryText({
  content,
  others,
}: {
  content: CategoryContent;
  /** Die anderen Kategorien: Adresse und Linktext. */
  others: { href: string; label: string }[];
}) {
  const { sections, faqs } = content;
  if (!sections.length && !faqs.length && !others.length) return null;

  return (
    <div className={styles.wrap}>
      {sections.length > 0 && (
        <section className={styles.text} aria-label="Ratgeber">
          {sections.map((s, i) => (
            <div key={s.heading ?? i}>
              {s.heading && <h2>{s.heading}</h2>}
              {s.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          ))}
        </section>
      )}

      {faqs.length > 0 && (
        <section className={styles.faq} aria-labelledby="faq-titel">
          <h2 id="faq-titel">Häufige Fragen</h2>
          {faqs.map((f) => (
            <div key={f.q}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
          <p>
            Mehr dazu: <Link href="/service/versand">Versand &amp; Lieferung</Link>,{" "}
            <Link href="/service/zahlungsarten">Zahlungsarten</Link>,{" "}
            <Link href="/service/rueckgabe">Rückgabe</Link> und{" "}
            <Link href="/service/faq">alle häufigen Fragen</Link>.
          </p>
        </section>
      )}

      {others.length > 0 && (
        <nav className={styles.more} aria-label="Weitere Kategorien">
          <h2>Das passt dazu</h2>
          <ul className={styles.moreList}>
            {others.map((o) => (
              <li key={o.href}>
                <Link href={o.href}>{o.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
