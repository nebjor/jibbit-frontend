/* eslint-disable @next/next/no-img-element */
import styles from "./ProductImage.module.css";

/**
 * Product imagery.
 *
 * STUBBED: no product photography exists yet, so when `src` is absent we render
 * a token-styled placeholder built from the brand initial. As soon as Medusa
 * serves image URLs the adapter fills `images` and this renders them for real.
 *
 * `priority` marks the LCP image (first PDP / first grid row) — everything else
 * is explicitly lazy-loaded.
 */
export function ProductImage({
  src,
  alt,
  brand,
  priority = false,
  className,
}: {
  src?: string;
  alt: string;
  brand?: string;
  priority?: boolean;
  className?: string;
}) {
  const cls = [styles.frame, className].filter(Boolean).join(" ");

  if (!src) {
    return (
      <div className={cls} role="img" aria-label={alt}>
        <span className={styles.mark} aria-hidden="true">
          {(brand || alt).slice(0, 2)}
        </span>
        <span className={styles.note} aria-hidden="true">
          Bild folgt
        </span>
      </div>
    );
  }

  return (
    <div className={cls}>
      <img
        src={src}
        alt={alt}
        className={styles.img}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
      />
    </div>
  );
}
