import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import { CartButton } from "./CartButton";
import { AccountLink } from "./AccountLink";
import { CategoryNav } from "./CategoryNav";
import { getCategories } from "@/lib/data";
import { SHIPPING } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import styles from "./Header.module.css";

/**
 * Site-Header. Kategorien kommen aus der Datenschicht (Backend zuerst,
 * Mock-Fallback) — nie hartkodiert.
 *
 * Es gibt genau EINE Kategorienavigation (`CategoryNav`), nicht mehr je eine
 * für Desktop, Mobile und die Shop-Seite: dieselben Links standen viermal im
 * HTML und füllten übereinander den halben Bildschirm. Das eine Element wird
 * per Grid-Area umpositioniert — mobil als eigene scrollende Zeile, ab 900px
 * in der Kopfleiste. Kein Hamburger: die Kategorien sind immer einen Tap
 * entfernt, der Warenkorb immer sichtbar.
 *
 * SUCHLEISTE (kommt aus einem parallelen Branch): ihr Platz ist die
 * Grid-Area `search` in `Header.module.css` — in der Kopfleiste zwischen
 * `CategoryNav` und `.actions` (Desktop) bzw. als eigene Spalte neben dem
 * Logo (mobil). Die Spalte ist vorbereitet und kollabiert leer auf 0.
 */
export async function Header() {
  const categories = await getCategories();

  return (
    <>
      {/* Utility-Streifen — das Versandversprechen, seitenweit. Die
          Zusatzargumente sind mobil ausgeblendet, damit der Streifen dort
          eine Zeile bleibt statt umzubrechen. */}
      <div className={styles.promo}>
        <p className="page">
          Gratisversand ab{" "}
          <strong className="tnum">
            {formatPrice(SHIPPING.freeThreshold)}
          </strong>
          <span className={styles.promoExtra}>
            {" "}
            &middot; Versand aus der Schweiz &middot; TWINT &amp; Powerpay
          </span>
        </p>
      </div>

      <header className={styles.header}>
        <div className={`page ${styles.bar}`}>
          <Link
            href="/"
            className={styles.brand}
            aria-label="jibbit — Startseite"
          >
            <Logo size="md" />
          </Link>

          {/*
           * Suspense wegen useSearchParams in der Client-Komponente: bei
           * dynamischem Rendern (alle Routen hier lesen Cookies) löst sie
           * nie aus, aber ein statischer Prerender-Pfad darf den Build
           * nicht brechen. Die Links stehen dadurch nicht doppelt im HTML:
           * der Fallback würde nur bei tatsächlichem Suspendieren gestreamt.
           */}
          <Suspense fallback={null}>
            <CategoryNav categories={categories} />
          </Suspense>

          <div className={styles.actions}>
            <AccountLink />
            <CartButton />
          </div>
        </div>
      </header>
    </>
  );
}
