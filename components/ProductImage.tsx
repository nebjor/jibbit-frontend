import Image from "next/image";
import type { ProductView } from "@/lib/types";
import { toMediaSrc } from "@/lib/media";
import { brandLabel, kindLabel } from "@/lib/placeholder";
import { getTenantContext } from "@/lib/tenant/context";
import styles from "./ProductImage.module.css";

/**
 * Produktbild — oder, wenn es keines gibt, eine gleichwertige Kachel aus
 * Markenname und Warenart.
 *
 * DER PLATZHALTER IST KEIN FEHLERZUSTAND. Er trägt bewusst keinen Hinweis auf
 * ein fehlendes Bild (vorher stand hier „Bild folgt"), sondern liest sich als
 * ruhige typografische Fläche in den Shopfarben. Die Begründung steht in
 * lib/placeholder.ts.
 *
 * BARRIEREFREIHEIT: Auch der Platzhalter ist inhaltstragend — er benennt das
 * Produkt. Er bekommt deshalb `role="img"` mit demselben `aria-label`, das ein
 * Foto als `alt` bekäme; die sichtbaren Wörter sind `aria-hidden`, sonst läse
 * ein Screenreader Marke und Warenart ein zweites Mal vor.
 */

export type ProductImageVariant = "card" | "hero" | "thumb";

/**
 * `sizes` je Einsatzort. Ohne diese Angabe nimmt `next/image` bei `fill` immer
 * `100vw` an und lädt auf einer vierspaltigen Liste ein Vielfaches der
 * nötigen Pixel.
 *
 * Hergeleitet aus den Layouts (`--page-max` 1280 px abzüglich 2 × 24 px
 * Innenabstand = 1232 px nutzbar):
 *   card  — app/shop/shop.module.css: 2 Spalten, ab 640 px 3, ab 1100 px 4.
 *           Vierspaltig sind das rund 296 px je Kachel.
 *   hero  — app/products/[handle]/product.module.css: ab 900 px teilt sich der
 *           Inhalt in `1.1fr 1fr` mit 48 px Spalt, die Bildspalte misst also
 *           rund 620 px. Darunter volle Breite.
 *   thumb — vier Vorschauen unter dem Hauptbild, also ein Viertel davon.
 */
const SIZES: Record<ProductImageVariant, string> = {
  card: "(min-width: 1100px) 296px, (min-width: 640px) 32vw, 48vw",
  hero: "(min-width: 900px) 620px, 100vw",
  thumb: "(min-width: 900px) 150px, 24vw",
};

/**
 * Server Component — sie löst den Tenant selbst auf, statt ihn von jeder
 * Aufrufstelle durchgereicht zu bekommen. Der Host gehört in die Bild-URL
 * (siehe app/media/[...path]/route.ts), und `getTenantContext()` ist nur ein
 * Header-Lesevorgang. Die Alternative wäre ein `host`-Prop durch ProductCard,
 * die Shopliste, die Startseite und die Produktseite — vier Aufrufstellen für
 * eine Angabe, die hier ohnehin verfügbar ist.
 */
export async function ProductImage({
  src,
  alt,
  product,
  variant = "card",
  priority = false,
  className,
}: {
  src?: string;
  alt: string;
  /** Nur für den Platzhalter — Marke und Warenart stammen daraus. */
  product: Pick<ProductView, "title" | "brand" | "categoryHandle">;
  variant?: ProductImageVariant;
  /** Markiert das LCP-Bild (erstes Bild der Produktseite, erste Rasterzeile). */
  priority?: boolean;
  className?: string;
}) {
  const cls = [styles.frame, className].filter(Boolean).join(" ");

  if (!src) {
    return (
      <div className={cls} role="img" aria-label={alt}>
        <div className={styles.placeholder} aria-hidden="true">
          <span className={styles.brand}>
            {brandLabel(product.title, product.brand)}
          </span>
          <span className={styles.rule} />
          <span className={styles.kind}>
            {kindLabel(product.title, product.categoryHandle)}
          </span>
        </div>
      </div>
    );
  }

  const tenant = await getTenantContext();
  const { src: url, unoptimized } = toMediaSrc(src, tenant.host);

  return (
    <div className={cls}>
      <Image
        src={url}
        alt={alt}
        // `fill` statt fester Masse: die Rahmen sind über `aspect-ratio: 1/1`
        // quadratisch, die Fotos sind es nicht. Die echten Bildmasse kennt die
        // Storefront ohnehin nicht — Medusa liefert zu einem Produktbild nur
        // die URL, keine Breite und Höhe.
        fill
        sizes={SIZES[variant]}
        className={styles.img}
        priority={priority}
        unoptimized={unoptimized}
      />
    </div>
  );
}
