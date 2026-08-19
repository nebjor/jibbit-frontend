import Link from "next/link";
import { Logo } from "./Logo";
import { CartButton } from "./CartButton";
import { AccountLink } from "./AccountLink";
import { getCategories } from "@/lib/data";
import { SHIPPING } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import styles from "./Header.module.css";

/**
 * Site header. Categories are fetched from the data layer (backend-first with
 * mock fallback) — never hardcoded in the component.
 *
 * Mobile strategy: no hamburger. The category row is a horizontally scrollable
 * strip, so the primary navigation is always one tap away, and the cart is
 * always visible.
 */
export async function Header() {
  const categories = await getCategories();

  return (
    <>
      {/* Utility strip — the shipping promise, sitewide. */}
      <div className={styles.promo}>
        <p className="page">
          Gratisversand ab{" "}
          <strong className="tnum">
            {formatPrice(SHIPPING.freeThreshold)}
          </strong>{" "}
          &middot; Versand aus der Schweiz &middot; TWINT &amp; Powerpay
        </p>
      </div>

      <header className={styles.header}>
        <div className={`page ${styles.bar}`}>
          <Link href="/" className={styles.brand} aria-label="jibbit — Startseite">
            <Logo size="md" />
          </Link>

          <nav className={styles.nav} aria-label="Hauptnavigation">
            <Link href="/shop">Shop</Link>
            {categories.map((c) => (
              <Link key={c.id} href={`/shop?kategorie=${c.handle}`}>
                {c.name}
              </Link>
            ))}
          </nav>

          <div className={styles.actions}>
            <AccountLink />
            <CartButton />
          </div>
        </div>

        {/* Mobile category strip */}
        <nav className={styles.mobileNav} aria-label="Kategorien">
          <div className={styles.mobileScroll}>
            <Link href="/shop">Alles</Link>
            {categories.map((c) => (
              <Link key={c.id} href={`/shop?kategorie=${c.handle}`}>
                {c.name}
              </Link>
            ))}
          </div>
        </nav>
      </header>
    </>
  );
}
