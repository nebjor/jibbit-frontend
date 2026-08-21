import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/checkout/checkout.module.css";

export const metadata: Metadata = {
  title: "Zahlung fehlgeschlagen",
  robots: { index: false, follow: false },
};

/**
 * Landeplatz, wenn die Zahlung auf der zahls.ch/Payrexx-Seite scheitert.
 * Der Warenkorb besteht weiter — der Kunde kann es direkt nochmals versuchen.
 */
export default function CheckoutFailedPage() {
  return (
    <div className={styles.confirmation}>
      <h1 className={styles.confirmTitle}>Zahlung fehlgeschlagen</h1>
      <p className={styles.confirmText}>
        Die Zahlung hat nicht geklappt — es wurde nichts belastet. Dein
        Warenkorb ist noch da; du kannst es gleich nochmals oder mit einer
        anderen Zahlungsart versuchen.
      </p>
      <Link href="/checkout" className={styles.secondaryCta}>
        Zurück zur Kasse
      </Link>
    </div>
  );
}
