import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/checkout/checkout.module.css";

export const metadata: Metadata = {
  title: "Zahlung abgebrochen",
  robots: { index: false, follow: false },
};

/**
 * Landeplatz, wenn der Kunde die Zahlung auf der zahls.ch-Bezahlseite
 * abbricht. Kein Fehler, nichts belastet, Warenkorb unverändert.
 */
export default function CheckoutCancelPage() {
  return (
    <div className={styles.confirmation}>
      <h1 className={styles.confirmTitle}>Zahlung abgebrochen</h1>
      <p className={styles.confirmText}>
        Du hast die Zahlung abgebrochen. Es wurde nichts belastet, dein
        Warenkorb ist unverändert da.
      </p>
      <Link href="/checkout" className={styles.secondaryCta}>
        Zurück zur Kasse
      </Link>
    </div>
  );
}
