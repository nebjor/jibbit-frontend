import Link from "next/link";
import { getGoogleProfil } from "@/lib/google-profil";
import { googleTrustItem, TRUST_FACTS, type TrustIcon } from "@/lib/trust";
import styles from "./ShopTrust.module.css";

/**
 * VERTRAUENSZEILE IM SHOP-KOPF — unter Titel und Beschreibung des Katalogs
 * (app/page.tsx: Startseite und Kategorien; app/suche/page.tsx). Eine
 * kompakte Zeile: links die Google-Bewertung des Ladenlokals («★★★★★ 5.0
 * bei Google · 26 Bewertungen», Link aufs Unternehmensprofil), daneben
 * klein und gedämpft die drei Fakten (Versand aus der Schweiz · Gratisversand
 * ab CHF 69 · Sichere Zahlung). Mobil bricht die Faktengruppe als Ganzes
 * unter die Google-Zeile; nichts wird ausgeblendet, nichts springt — alles
 * ist serverseitig gerendert, kein Client-JS.
 *
 * Texte und Wahrheitspflicht: lib/trust.ts. Die Zahl: lib/google-profil.ts
 * (Places API, 6 h gecacht). Ohne Schlüssel/Place-ID oder ohne je
 * erfolgreichen Abruf gibt es KEINE Zahl und KEINE Sterne — nur
 * «Bewertungen auf Google» als Link. Diese Komponente schreibt keine Zahl
 * selbst; ShopTrust.test.ts hält das fest.
 *
 * Sterne: fünf Umriss-Sterne, darüber eine auf `rating / 5` breite Schicht
 * mit fünf gefüllten Sternen (reines CSS, keine SVG-Ids, also auch mehrfach
 * je Seite einbindbar). 4.6 ergibt so vier volle Sterne und einen zu 60 %
 * gefüllten — die Grafik entspricht der Zahl, nicht einer Rundung.
 */
export async function ShopTrust() {
  const profil = await getGoogleProfil();
  const google = googleTrustItem(profil);

  return (
    <div className={styles.row} data-trust-source={profil.source}>
      <a
        href={google.href}
        className={styles.google}
        target="_blank"
        rel="noopener"
        aria-label={google.ariaLabel}
        data-trust="google"
      >
        {google.rating === null ? (
          <Star className={styles.starSingle} filled={false} />
        ) : (
          <Stars rating={google.rating} />
        )}
        <span className={styles.googleText}>{google.text}</span>
      </a>

      <ul className={styles.facts} aria-label="Unsere Versprechen">
        {TRUST_FACTS.map((fact) => (
          <li key={fact.id} className={styles.fact} data-trust={fact.id}>
            <Link href={fact.href} className={styles.factLink}>
              <Icon kind={fact.icon} />
              <span>{fact.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Fünf Sterne, gefüllt im Verhältnis `rating / 5`. Rein dekorativ. */
function Stars({ rating }: { rating: number }) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  return (
    <span className={styles.stars} aria-hidden="true">
      <span className={styles.starRow}>
        {STAR_KEYS.map((k) => (
          <Star key={k} filled={false} />
        ))}
      </span>
      <span className={styles.starFill} style={{ width: `${pct}%` }}>
        <span className={styles.starRow}>
          {STAR_KEYS.map((k) => (
            <Star key={k} filled />
          ))}
        </span>
      </span>
    </span>
  );
}

const STAR_KEYS = ["a", "b", "c", "d", "e"] as const;

function Star({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      className={className ?? styles.star}
      viewBox="0 0 16 16"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 1.6l1.95 4.1 4.45.55-3.27 3.1.85 4.45L8 11.6l-3.98 2.2.85-4.45L1.6 6.25l4.45-.55z" />
    </svg>
  );
}

function Icon({ kind }: { kind: TrustIcon }) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {kind === "truck" && (
        <>
          <path d="M1.5 3.5h8.5v7H1.5zM10 6h2.6l1.9 2.3v2.2H10" />
          <circle cx="4.5" cy="12.5" r="1.5" />
          <circle cx="11.5" cy="12.5" r="1.5" />
        </>
      )}
      {kind === "check" && (
        <>
          <circle cx="8" cy="8" r="6.25" />
          <path d="M5 8.3l2 2 4-4.5" />
        </>
      )}
      {kind === "lock" && (
        <>
          <rect x="3" y="7" width="10" height="7.25" rx="1" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
        </>
      )}
    </svg>
  );
}
