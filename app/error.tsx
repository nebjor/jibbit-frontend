"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PixelJoint } from "@/components/PixelJoint";
import styles from "./error.module.css";

/**
 * Fehlergrenze für alle Seiten unterhalb des Root-Layouts (Next-Konvention;
 * muss eine Client Component sein). Greift, wenn ein Datenabruf oder das
 * Rendern einer Seite wirft — in Produktion auch dann, wenn der Katalog
 * nicht erreichbar ist (lib/data.ts, `CatalogUnavailableError`).
 *
 * Der Joint ist hier der AUSGEDRÜCKTE, statisch: nichts arbeitet mehr, und
 * genau das soll das Bild sagen. Eine Animation an dieser Stelle würde das
 * Gegenteil behaupten.
 *
 * `unstable_retry` ist in dieser Next-Version der dokumentierte Weg, das
 * Segment neu zu laden (node_modules/next/dist/docs → file-conventions/
 * error.md); `reset` bleibt als Rückfall abgefragt, falls eine spätere
 * Version umbenennt.
 */
export default function Error({
  error,
  unstable_retry,
  reset,
}: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    // Serverseitig ist die Meldung in Produktion geschwärzt — der digest ist
    // dann der Schlüssel, um sie im Server-Log wiederzufinden.
    console.error(error);
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <div className={`page ${styles.wrap}`}>
      <PixelJoint variant="error" px={3} className={styles.joint} />
      <div>
        <p className="eyebrow">Fehler</p>
        <h1 className={styles.title}>Da ist was ausgegangen</h1>
        <p className={styles.text}>
          Die Seite liess sich gerade nicht laden. Das liegt an uns, nicht an
          dir — ein neuer Versuch hilft oft schon.
        </p>
        <div className={styles.actions}>
          {retry && (
            <button type="button" className={styles.cta} onClick={() => retry()}>
              Nochmal versuchen
            </button>
          )}
          <Link href="/" className={styles.alt}>
            Zum Shop
          </Link>
        </div>
      </div>
    </div>
  );
}
