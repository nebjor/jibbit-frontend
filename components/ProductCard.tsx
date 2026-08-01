import Link from "next/link";
import type { ProductView } from "@/lib/types";
import { ProductImage } from "./ProductImage";
import { Price } from "./Price";
import styles from "./ProductCard.module.css";

/**
 * Grid tile. Price-forward per the Kiosk direction: the price sits directly
 * under the title in accent colour and is the loudest thing on the card.
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductView;
  priority?: boolean;
}) {
  return (
    <article className={styles.card}>
      <Link href={`/products/${product.handle}`} className={styles.link}>
        <ProductImage
          src={product.images[0]}
          alt={product.title}
          brand={product.brand}
          priority={priority}
        />
        <div className={styles.body}>
          {product.brand && <p className="eyebrow">{product.brand}</p>}
          <h3 className={styles.title}>{product.title}</h3>
          <p className={styles.sub}>{product.subtitle}</p>
          <div className={styles.price}>
            <Price
              price={product.price}
              compareAt={product.compareAt}
              currency={product.currency}
              size="sm"
            />
          </div>
        </div>
      </Link>
    </article>
  );
}
