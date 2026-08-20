"use client";

import Image from "next/image";
import { useState } from "react";
import { PixelJoint } from "./PixelJoint";
import styles from "./MediaImage.module.css";

/**
 * Das eigentliche <Image> mit Lade- und Fehlerzustand. Client Component,
 * weil nur der Browser weiss, ob ein Bild angekommen ist — `onLoad`/`onError`
 * gibt es serverseitig nicht. Alles Tenant- und URL-Wissen bleibt in der
 * Server Component ProductImage; hierher kommt nur die fertige `src`.
 *
 * LADEN — nur wo gewartet wird, und erst ab einer Schwelle:
 * Die Animation erscheint ausschliesslich auf dem Hauptbild der Produktseite
 * (`showLoader`), NICHT auf Rasterkacheln oder Vorschaubildern. Ein Shop-
 * Raster mit dutzenden gleichzeitig rauchenden Joints wäre kein Fortschritt
 * gegenüber ruhigen Flächen — die Kacheln behalten ihre stille Farbfläche,
 * bis das Bild da ist. Und auch das Hauptbild wartet erst
 * `--loader-delay` (app/tokens.css) ab, bevor der Joint erscheint: unter
 * ~100 ms nimmt niemand eine Lücke wahr, und bis einige hundert ms bleibt
 * man ohnehin im Fluss. Ein Loader, der bei einem Cache-Treffer für zwei
 * Frames aufblitzt, macht die Seite gefühlt LANGSAMER. Die Verzögerung ist
 * reines CSS (animation-delay), funktioniert also auch, während der
 * Haupt-Thread mit Hydration beschäftigt ist.
 *
 * FEHLER — statisch: Lässt sich das Bild nicht laden, tritt der ausgedrückte
 * Joint an seine Stelle, dazu eine knappe Textzeile. Das ist ein ANDERER Fall
 * als „Produkt hat kein Foto" — den deckt der typografische Platzhalter in
 * ProductImage/lib/placeholder.ts ab und er ist bewusst KEIN Fehlerbild.
 * Hier dagegen gibt es ein Bild, es kommt nur nicht an — das darf man sagen.
 *
 * KEIN LAYOUTSPRUNG: Der umgebende Rahmen (ProductImage.module.css, .frame)
 * reserviert die Fläche über `aspect-ratio: 1/1`; Warten, Fehler und fertiges
 * Bild füllen alle dieselbe absolute Position darin.
 */
export function MediaImage({
  src,
  alt,
  sizes,
  priority = false,
  unoptimized = false,
  imgClassName,
  showLoader = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  unoptimized?: boolean;
  imgClassName?: string;
  showLoader?: boolean;
}) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  if (state === "failed") {
    return (
      <span className={styles.media} role="img" aria-label={alt}>
        <span className={styles.broken} aria-hidden="true">
          <PixelJoint variant="error" />
          <span className={styles.brokenText}>Bild liess sich nicht laden</span>
        </span>
      </span>
    );
  }

  return (
    <span className={styles.media} aria-busy={state === "loading" || undefined}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={imgClassName}
        priority={priority}
        unoptimized={unoptimized}
        onLoad={() => setState("ready")}
        onError={() => setState("failed")}
      />
      {showLoader && state === "loading" && (
        <span className={styles.wait} aria-hidden="true">
          <PixelJoint variant="loading" />
        </span>
      )}
    </span>
  );
}
