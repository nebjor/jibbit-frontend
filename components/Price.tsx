import { formatAmount, discountPercent } from "@/lib/format";
import styles from "./Price.module.css";

/**
 * Price is the hero element in the Kiosk design — it is the only text that
 * gets the accent colour, and it always uses tabular numerals so digits line
 * up down a product grid.
 */
export function Price({
  price,
  compareAt,
  size = "md",
  currency = "CHF",
}: {
  price: number;
  compareAt?: number;
  size?: "sm" | "md" | "lg";
  currency?: string;
}) {
  const pct = discountPercent(price, compareAt);

  return (
    <span className={`${styles.wrap} ${styles[size]}`}>
      <span className={`${styles.current} tnum`}>
        <span className={styles.cur}>{currency}</span>
        {formatAmount(price)}
      </span>
      {pct > 0 && compareAt != null && (
        <>
          <s className={`${styles.was} tnum`}>{formatAmount(compareAt)}</s>
          <span className={styles.badge}>&minus;{pct}%</span>
          <span className="srOnly">
            Reduziert von {formatAmount(compareAt)} Franken auf{" "}
            {formatAmount(price)} Franken
          </span>
        </>
      )}
    </span>
  );
}
