import styles from "./PixelJoint.module.css";

/**
 * Der Pixel-Joint in seinen zwei Zuständen — das Maskottchen für Warten und
 * Scheitern.
 *
 *   loading  brennender Joint mit Rauchfahne. Sprite-Sheet
 *            (public/loader/joint-loader-sheet.png, 16 Bilder à 32x56) plus
 *            CSS `steps()`. BEWUSST kein APNG: dessen Abspielen ist Teil der
 *            Bildressource und lässt sich per CSS nicht anhalten — man müsste
 *            über <picture> ein zweites, statisches Bild ausliefern. Das
 *            Sprite dagegen steht bei `prefers-reduced-motion` einfach auf
 *            seinem ersten Bild (siehe PixelJoint.module.css) und ist obendrein
 *            das kleinere Asset.
 *   error    ausgedrückter Joint, STATISCH — ein Fehlerzustand darf nicht
 *            aussehen, als arbeite noch etwas. Erzeugt von
 *            tools/pixel-art/gen_joint_stub.mjs in exakt der Palette des
 *            Original-Generators.
 *
 * Die Grafik ist in beiden Fällen DEKORATIV (`aria-hidden`): was gerade lädt
 * oder gescheitert ist, sagt die Aufrufstelle in Textform — sie kennt den
 * Kontext, der Joint nicht.
 *
 * `px` ist der GANZZAHLIGE Vergrösserungsfaktor der 32x56-Grafik. Ganzzahlig,
 * weil `image-rendering: pixelated` bei krummen Faktoren ungleich grosse
 * Pixel erzeugt — das fällt bei Pixel-Art sofort auf.
 */
export function PixelJoint({
  variant,
  px = 2,
  className,
}: {
  variant: "loading" | "error";
  px?: 2 | 3;
  className?: string;
}) {
  const cls = [
    styles.joint,
    variant === "loading" ? styles.loading : styles.stub,
    px === 3 ? styles.px3 : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (variant === "error") {
    // Echte <img> statt background: der Stub ist statisch, so bekommt er
    // Browser-Caching und feste Masse ohne weitere CSS-Regeln. Am
    // Bildoptimierer vorbei (kein next/image): aus 278 Byte Pixel-Art macht
    // der nur ein grösseres Bild.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/loader/joint-stub.png" alt="" aria-hidden="true" className={cls} />;
  }

  return <span aria-hidden="true" className={cls} />;
}
