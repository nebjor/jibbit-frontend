import { STORE } from "@/lib/config";
import styles from "./Logo.module.css";

/**
 * ⚠️ PLACEHOLDER LOGO — SWAP ME.
 *
 * The real jibbit logo is a black graffiti tag (asset not yet supplied).
 * To swap: drop the SVG into `public/logo.svg` and replace the <span> below
 * with an <img src="/logo.svg" .../> or an inline <svg>. Keep the same props
 * and class names and nothing else in the app needs to change.
 *
 * Renders black-on-light per the Kiosk colorway (uses --c-ink, never a literal).
 */
export function Logo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={[styles.logo, styles[size], className].filter(Boolean).join(" ")}
      data-placeholder="graffiti-tag-svg"
      aria-hidden="true"
    >
      {STORE.name}
    </span>
  );
}
