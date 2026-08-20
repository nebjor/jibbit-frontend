import Link from "next/link";
import { Logo } from "./Logo";
import { STORE, SHIPPING, PAYMENT_METHODS, MIN_AGE } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import styles from "./Footer.module.css";

/**
 * Footer.
 *
 * Column structure adapted from how established Swiss headshops (e.g.
 * stayhighswiss.ch) group their footer: a Kundenservice block (Kontakt,
 * Versand & Lieferung, Zahlungsarten, Rückgabe, FAQ) and a legal block
 * (Impressum, AGB, Datenschutz, Widerrufsrecht). All copy is jibbit's own —
 * nothing is lifted verbatim.
 *
 * Bewusst KEINE Kategorieliste mehr: die stand als vierte Kopie derselben
 * Links im HTML (Header-Desktop, Header-Mobil, Shop-Filter, Footer). Die
 * Kategorienavigation gibt es genau einmal — im Header (`CategoryNav`);
 * für Crawler deckt die Sitemap die Kategorie-URLs ab. Der Footer macht,
 * was nur er kann: Service und Rechtliches.
 */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`page ${styles.grid}`}>
        <div className={styles.brandCol}>
          <Logo size="md" />
          <p className={styles.tagline}>{STORE.tagline}</p>
          <p className={styles.small}>
            Versand ab {formatPrice(SHIPPING.flatRate)} &middot; gratis ab{" "}
            {formatPrice(SHIPPING.freeThreshold)}
          </p>
        </div>

        <nav className={styles.col} aria-label="Kundenservice">
          <h2 className={styles.colTitle}>Kundenservice</h2>
          <ul>
            <li>
              <Link href="/service/kontakt">Kontakt</Link>
            </li>
            <li>
              <Link href="/service/versand">Versand &amp; Lieferung</Link>
            </li>
            <li>
              <Link href="/service/zahlungsarten">Zahlungsarten</Link>
            </li>
            <li>
              <Link href="/service/rueckgabe">Rückgabe &amp; Umtausch</Link>
            </li>
            <li>
              <Link href="/service/faq">Häufige Fragen</Link>
            </li>
          </ul>
        </nav>

        <nav className={styles.col} aria-label="Rechtliches">
          <h2 className={styles.colTitle}>Rechtliches</h2>
          <ul>
            <li>
              <Link href="/impressum">Impressum</Link>
            </li>
            <li>
              <Link href="/agb">AGB</Link>
            </li>
            <li>
              <Link href="/datenschutz">Datenschutzerklärung</Link>
            </li>
            <li>
              <Link href="/widerrufsrecht">Widerrufsrecht</Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className={styles.bottom}>
        <div className={`page ${styles.bottomInner}`}>
          <p className={styles.small}>
            &copy; {new Date().getFullYear()} {STORE.domain} &middot; Abgabe nur
            an Personen ab {MIN_AGE} Jahren
          </p>
          <ul className={styles.pay} aria-label="Akzeptierte Zahlungsmittel">
            {PAYMENT_METHODS.map((p) => (
              <li key={p.id}>{p.label}</li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
