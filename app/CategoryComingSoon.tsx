import Link from "next/link";
import styles from "./page.module.css";

/**
 * Standardverhalten für JEDE Kategorie ohne Produkte — nicht nur für eine
 * bestimmte: der Betreiber legt Kategorien im Admin an, bevor die Ware da
 * ist (aktueller Anlass: «Kräutermischungen»), und jede weitere muss ohne
 * Code-Änderung denselben Hinweis bekommen.
 *
 * Bewusst NICHT der Wortlaut der Suche («Keine Treffer …»): eine leere
 * Kategorie ist kein Fehlschlag des Kunden und keine erfolglose Eingabe,
 * sondern eine Ankündigung des Sortiments. Deshalb «bald verfügbar» statt
 * «nichts gefunden» — freundlich, kurz, mit Weg zurück ins Sortiment.
 * Das Sortiment liegt auf der Startseite; der Link entfernt nur den Filter.
 */
export function CategoryComingSoon({ categoryName }: { categoryName: string }) {
  return (
    <div className={styles.empty}>
      <h2 className={styles.emptyTitle}>Bald verfügbar</h2>
      <p>
        {categoryName} nehmen wir gerade ins Sortiment auf — die ersten
        Artikel sind bald da. Schau in der Zwischenzeit im übrigen Shop
        vorbei.
      </p>
      <Link href="/" className={styles.emptyCta}>
        Zum ganzen Sortiment
      </Link>
    </div>
  );
}
