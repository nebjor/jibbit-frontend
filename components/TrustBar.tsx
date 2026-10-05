import Link from "next/link";
import { getGoogleProfil } from "@/lib/google-profil";
import { trustItems, type TrustIcon, type TrustItem } from "@/lib/trust";
import styles from "./TrustBar.module.css";

/**
 * VERTRAUENSLEISTE — eine schmale Zeile ganz oben, über dem Header, auf
 * jeder Seite (app/layout.tsx). Sie ersetzt den früheren dunklen
 * Promo-Streifen («Dauertiefpreise · Gratisversand …»): EIN Streifen, nicht
 * zwei übereinander; das Preisversprechen steht weiterhin als Untertitel auf
 * der Startseite (PRICE_CLAIM.full).
 *
 * Inhalt und Wahrheitspflicht: lib/trust.ts — die Texte stehen NUR dort.
 * Die Google-Bewertung kommt aus dem Unternehmensprofil (lib/google-profil.ts:
 * Places API, wenn konfiguriert, sonst die von Hand gepflegte Konstante);
 * diese Komponente schreibt keine Zahl selbst. TrustBar.test.ts hält das
 * fest.
 *
 * Async Server-Komponente ohne Client-JS, feste Höhe (TrustBar.module.css):
 * die Leiste steht fertig im ausgelieferten HTML und verschiebt nichts beim
 * Hydrieren. Desktop zeigt alle Einträge zentriert; mobil ist die Liste eine
 * waagrecht scrollbare Zeile mit Einrasten (reines CSS), bei 390 px sind die
 * ersten zwei Einträge zu sehen und der dritte angeschnitten — der Anschnitt
 * ist der Hinweis zum Wischen. Kein Automatik-Lauftext: der wäre unruhig,
 * bei «reduzierter Bewegung» ohnehin zu unterdrücken und mit vier kurzen
 * Einträgen unnötig.
 *
 * Die Symbole sind kleine Inline-SVGs in der Textfarbe (16er-Raster, Linien
 * 1.5 px; der Stern gefüllt).
 */
export async function TrustBar() {
  const profil = await getGoogleProfil();
  const items = trustItems(profil);

  return (
    <div className={styles.bar}>
      <ul className={`page ${styles.list}`} aria-label="Unsere Versprechen">
        {items.map((item) => (
          <li key={item.id} className={styles.item} data-trust={item.id}>
            <ItemLink item={item}>
              <Icon kind={item.icon} />
              <span>{item.text}</span>
            </ItemLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Intern per next/link; extern (Google Maps) im neuen Tab, ohne Opener. */
function ItemLink({
  item,
  children,
}: {
  item: TrustItem;
  children: React.ReactNode;
}) {
  if (item.external) {
    return (
      <a
        href={item.href}
        className={styles.link}
        target="_blank"
        rel="noopener"
        aria-label={item.ariaLabel}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={item.href} className={styles.link} aria-label={item.ariaLabel}>
      {children}
    </Link>
  );
}

function Icon({ kind }: { kind: TrustIcon }) {
  const filled = kind === "star";
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 16 16"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {kind === "star" && (
        <path d="M8 1.6l1.95 4.1 4.45.55-3.27 3.1.85 4.45L8 11.6l-3.98 2.2.85-4.45L1.6 6.25l4.45-.55z" />
      )}
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
