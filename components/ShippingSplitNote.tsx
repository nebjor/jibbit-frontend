import { SHIPPING } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import styles from "./ShippingSplitNote.module.css";

/** 9 -> «9.–», 9.5 -> «9.50» (Schweizer Preisschreibweise). */
function short(amount: number): string {
  return Number.isInteger(amount) ? `${amount}.–` : amount.toFixed(2);
}

/**
 * Bewusst kein «CHF 4.50 statt 9.–»: CHF 9.00 war bis 21.09.2026 der
 * Versandpreis, ein «statt» wäre ein befristeter Preisvergleich (PBV Art. 16).
 * Die 9.– stehen deshalb als Porto da. Siehe docs/legal-review.md, B10.
 */
export function ShippingSplitNote({ className }: { className?: string }) {
  if (SHIPPING.rate >= SHIPPING.postage) return null;
  return (
    <p className={[styles.note, className].filter(Boolean).join(" ")}>
      Wir teilen das Paketporto ({short(SHIPPING.postage)}) mit dir: du
      zahlst nur{" "}
      <strong className="tnum">{formatPrice(SHIPPING.rate)}</strong>
    </p>
  );
}
