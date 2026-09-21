import { formatAmount, discountPercent } from "@/lib/format";
import styles from "./Price.module.css";

/**
 * Price is the hero element in the Kiosk design: ink, bold, tabular numerals
 * so digits line up down a product grid. It only turns accent-red when there
 * is a concrete saving — an Aktionspreis with the regular price struck through.
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
  const onSale = pct > 0 && compareAt != null;

  return (
    <span className={`${styles.wrap} ${styles[size]}`}>
      <span className={`${styles.current} ${onSale ? styles.sale : ""} tnum`}>
        <span className={styles.cur}>{currency}</span>
        {formatAmount(price)}
      </span>
      {onSale && (
        <>
          <s className={`${styles.was} tnum`}>{formatAmount(compareAt)}</s>
          {size !== "sm" && <SaveBadge percent={pct} />}
          <span className="srOnly">
            Reduziert von {formatAmount(compareAt)} Franken auf{" "}
            {formatAmount(price)} Franken
          </span>
        </>
      )}
    </span>
  );
}

/** "−28%" — the one red marker for a saving, shared by every price surface. */
export function SaveBadge({ percent }: { percent: number }) {
  return <span className={styles.badge}>&minus;{percent}%</span>;
}
