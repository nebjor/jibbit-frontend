import Link from "next/link";
import type { ProductView } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { defaultVariant, tierChips } from "@/lib/pricing";
import { ProductImage } from "./ProductImage";
import { Price, SaveBadge } from "./Price";
import styles from "./ProductCard.module.css";

/**
 * Grid tile. Price-forward per the Kiosk direction: the price sits directly
 * under the title and is the loudest thing on the card. Below it, the best
 * quantity tier — the card's only red, because it is a concrete saving.
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductView;
  priority?: boolean;
}) {
  const best = tierChips(defaultVariant(product.variants)?.tiers ?? []).at(-1);
  const tier = best && best.savePercent > 0 ? best : undefined;

  return (
    <article className={styles.card}>
      <Link href={`/products/${product.handle}`} className={styles.link}>
        <ProductImage
          src={product.images[0]}
          alt={product.title}
          product={product}
          variant="card"
          priority={priority}
        />
        <div className={styles.body}>
          <h3 className={styles.title}>{product.title}</h3>
          <Price
            price={product.price}
            compareAt={product.compareAt}
            currency={product.currency}
            size="sm"
          />
          <p className={`${styles.tier} tnum`}>
            {tier && (
              <>
                ab {tier.minQuantity} Stk. {formatAmount(tier.price)}/Stk.{" "}
                <SaveBadge percent={tier.savePercent} />
              </>
            )}
          </p>
          {product.brand && <p className="eyebrow">{product.brand}</p>}
          {product.subtitle && <p className={styles.sub}>{product.subtitle}</p>}
        </div>
      </Link>
    </article>
  );
}
