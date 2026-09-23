import Link from "next/link";
import { PixelJoint } from "@/components/PixelJoint";
import { getCategories } from "@/lib/data";
import styles from "./not-found.module.css";

export default async function NotFound() {
  const categories = await getCategories();
  return (
    <div className={`page ${styles.wrap}`}>
      {/* Der ausgedrückte Joint — statisch: hier arbeitet nichts mehr, und
          das Bild soll das auch nicht behaupten. Dekorativ; die Aussage
          machen Titel und Text. */}
      <PixelJoint variant="error" px={3} />
      <p className="eyebrow">404</p>
      <h1 className={styles.title}>Nichts zu holen hier</h1>
      <p className={styles.text}>
        Diese Seite gibt&rsquo;s nicht (mehr). Vielleicht ein alter Link oder ein
        Tippfehler. Such danach oder stöbere in einer Kategorie.
      </p>
      <form action="/suche" role="search" className={styles.search}>
        <input
          type="search"
          name="q"
          placeholder="Produkt suchen"
          aria-label="Produkt suchen"
          className={styles.input}
        />
        <button type="submit" className={styles.cta}>
          Suchen
        </button>
      </form>
      <ul className={styles.categories}>
        {categories.map((c) => (
          <li key={c.id}>
            <Link href={`/?kategorie=${encodeURIComponent(c.handle)}`}>{c.name}</Link>
          </li>
        ))}
        <li>
          <Link href="/">Alles</Link>
        </li>
      </ul>
    </div>
  );
}
