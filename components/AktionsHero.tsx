"use client";

import { bannerUeberschrift, formatRestzeit, restMillisekunden, type Aktion } from "@/lib/aktionen";
import { useAktionJetzt } from "./useAktionJetzt";
import styles from "./AktionsHero.module.css";

/**
 * Hero-Block der Startseite: die laufende Aktion gross über dem Katalog.
 * Nicht wegklickbar (der schmale Banner auf den übrigen Seiten ist es).
 *
 * Der statische Text kommt schon im Server-HTML mit; nur die Restzeit
 * kommt nach dem Mounten dazu (Begründung: useAktionJetzt). Am Ende der
 * Aktion blendet sich der Block selbst aus.
 *
 * `bis` ist das Ende, fertig formatiert in Schweizer Zeit (formatGiltBis).
 */
export function AktionsHero({ aktion, bis }: { aktion: Aktion; bis: string | null }) {
  const jetzt = useAktionJetzt(aktion);
  const rest = jetzt === null ? null : restMillisekunden(aktion.giltBis, jetzt);
  if (jetzt !== null && aktion.giltBis !== null && rest === null) return null;

  return (
    <section className={styles.hero} role="region" aria-label="Aktion" data-testid="aktions-hero">
      <h2 className={styles.headline}>{bannerUeberschrift(aktion)}</h2>
      {bis && <p className={styles.bis}>Nur bis {bis}</p>}
      <p className={styles.sub}>Zusätzlich zu den Mengenrabatten · Wird an der Kasse automatisch abgezogen</p>
      {rest !== null && (
        <p className={`tnum ${styles.rest}`} data-testid="aktion-restzeit">
          noch {formatRestzeit(rest)}
        </p>
      )}
      <a href="#sortiment" className={styles.cta}>
        Jetzt sparen
      </a>
    </section>
  );
}
