import Link from "next/link";
import { Logo } from "./Logo";
import { PaymentIcons } from "./PaymentIcons";
import { CookieSettingsLink } from "./consent/CookieSettingsLink";
import { STORE, SHIPPING, MIN_AGE, BUSINESS } from "@/lib/config";
import { FOOTER_GROUPS, SUPPORT } from "@/lib/content/kundenservice";
import { displayPhone, formatPrice } from "@/lib/format";
import styles from "./Footer.module.css";

/**
 * Bewusst keine Kategorieliste — die Kategorienavigation steht einmal, im
 * Header; Crawler finden die Kategorien über die Sitemap.
 *
 * Kontaktangaben (`BUSINESS`) nur auf jibbits eigener Domain, wie in
 * `organizationJsonLd`.
 */
export function Footer({ domain }: { domain: string }) {
  const own = domain === STORE.domain;

  return (
    <footer className={styles.footer}>
      <div className={`page ${styles.grid}`}>
        <div className={styles.brandCol}>
          <Logo size="md" />
          <p className={styles.tagline}>{STORE.tagline}</p>
          <p className={styles.small}>
            Versand {formatPrice(SHIPPING.rate)} &middot; gratis ab{" "}
            {formatPrice(SHIPPING.freeThreshold)}
          </p>

          {own && (
            <address className={styles.contact}>
              <span className={styles.contactTitle}>Kontakt</span>
              <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
              <a href={`tel:${BUSINESS.telephone}`}>
                {displayPhone(BUSINESS.telephone)}
              </a>
              <span>{SUPPORT.hours}</span>
              <span>
                {BUSINESS.legalName}, {BUSINESS.street},{" "}
                {BUSINESS.postalCode} {BUSINESS.city}
              </span>
            </address>
          )}
        </div>

        {FOOTER_GROUPS.map((group) => (
          <nav key={group.title} className={styles.col} aria-label={group.title}>
            <h2 className={styles.colTitle}>{group.title}</h2>
            <ul>
              {group.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
              {/* Widerruf der Cookie-Einwilligung: muss so leicht sein wie
                  das Erteilen (DSG-Transparenz / DSGVO Art. 7 Abs. 3) —
                  deshalb dauerhaft hier, einen Klick entfernt, auf jeder
                  Seite. */}
              {group.title === "Rechtliches" && (
                <li>
                  <CookieSettingsLink />
                </li>
              )}
            </ul>
          </nav>
        ))}
      </div>

      <div className={styles.bottom}>
        <div className={`page ${styles.bottomInner}`}>
          <PaymentIcons />
          <div className={styles.notes}>
            <p className={styles.small}>
              Preise in CHF, keine Mehrwertsteuer (nicht
              mehrwertsteuerpflichtig), zuzüglich Versand. Abgabe nur an
              Personen ab {MIN_AGE} Jahren.
            </p>
            <p className={styles.small}>
              &copy; {new Date().getFullYear()} {STORE.domain}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
