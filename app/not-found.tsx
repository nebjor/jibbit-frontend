import Link from "next/link";
import { PixelJoint } from "@/components/PixelJoint";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={`page ${styles.wrap}`}>
      {/* Der ausgedrückte Joint — statisch: hier arbeitet nichts mehr, und
          das Bild soll das auch nicht behaupten. Dekorativ; die Aussage
          machen Titel und Text. */}
      <PixelJoint variant="error" px={3} />
      <p className="eyebrow">404</p>
      <h1 className={styles.title}>Nichts zu holen hier</h1>
      <p className={styles.text}>
        Diese Seite gibt&rsquo;s nicht (mehr). Vielleicht ein alter Link oder ein
        Tippfehler. Im Shop wirst du eher fündig.
      </p>
      <Link href="/shop" className={styles.cta}>
        Zum Shop
      </Link>
    </div>
  );
}
