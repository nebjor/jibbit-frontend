import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import { CartButton } from "./CartButton";
import { AccountLink } from "./AccountLink";
import { CategoryNav } from "./CategoryNav";
import { SearchBar } from "./search/SearchBar";
import { AktionsBannerSlot } from "./AktionsBannerSlot";
import { getCategories } from "@/lib/data";
import { PRICE_CLAIM, SHIPPING, STORE } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import styles from "./Header.module.css";

/**
 * Site-Header. Kategorien kommen aus der Datenschicht (Backend zuerst,
 * Mock-Fallback) — nie hartkodiert.
 *
 * Aufbau auf ALLEN Breiten (Grid-Areas in Header.module.css):
 *
 *   Logo · Suche · Konto/Warenkorb
 *   Kategorien (eigene Zeile, scrollt bei Überlauf waagrecht)
 *
 * Es gibt genau EINE Kategorienavigation (`CategoryNav`), nicht mehr je eine
 * für Desktop, Mobile und die Shop-Seite: dieselben Links standen viermal im
 * HTML und füllten übereinander den halben Bildschirm. Kein Hamburger: die
 * Kategorien sind immer einen Tap entfernt, der Warenkorb immer sichtbar.
 *
 * Die Suche belegt mobil nur ein 44px-Lupensymbol (öffnet eine
 * bildschirmfüllende Suchschicht) und ab 900px das breite Inline-Feld —
 * beides in SearchBox.tsx/.module.css, der Header reserviert nur die
 * Grid-Area `search`. Die DOM-Reihenfolge unten (Logo, Suche, Aktionen,
 * Kategorien) entspricht der visuellen Ordnung, damit die Tab-Reihenfolge
 * nicht springt.
 */
export async function Header() {
  const categories = await getCategories();

  return (
    <>
      {/* Utility-Streifen — Preis- und Versandversprechen, seitenweit. Die
          Zusatzargumente sind mobil ausgeblendet, damit der Streifen dort
          eine Zeile bleibt statt umzubrechen. */}
      <div className={styles.promo}>
        <p className="page">
          <strong>{PRICE_CLAIM.short}</strong> &middot; Gratisversand ab{" "}
          <strong className="tnum">
            {formatPrice(SHIPPING.freeThreshold)}
          </strong>
          <span className={styles.promoExtra}>
            {" "}
            &middot; Versand aus der Schweiz &middot; TWINT &amp; Kreditkarte
          </span>
        </p>
      </div>

      {/* Aktionsbanner — nur solange das Backend eine automatische Aktion
          meldet (lib/data.ts, getAktionen); sonst rendert er nichts. */}
      <AktionsBannerSlot />

      <header className={styles.header}>
        <div className={`page ${styles.bar}`}>
          <Link
            href="/"
            className={styles.brand}
            /* Landeplatz des Intro-Logos: IntroOverlay.tsx misst diese
               Position zur LAUFZEIT (FLIP), intro-global.css versteckt
               das Logo hier, bis das Intro-Logo gelandet ist. */
            data-intro-logo-target
            aria-label={`${STORE.name} — Startseite`}
          >
            <Logo size="md" />
          </Link>

          {/* Instant search — self-contained (own CSS module), deliberately a
              single element here. Sizing lives in SearchBox.module.css, not
              Header.css. */}
          <SearchBar />

          <div className={styles.actions}>
            <AccountLink />
            <CartButton />
          </div>

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
        </div>
      </header>
    </>
  );
}
