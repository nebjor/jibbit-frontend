"use client";

import { openConsentSettings } from "@/lib/consent/client";
import styles from "./CookieSettingsLink.module.css";

/**
 * Der Widerrufsweg: öffnet den Einwilligungsdialog erneut. Eine
 * Einwilligung, die man nicht zurücknehmen kann, ist keine — darum steht
 * dieser Knopf dauerhaft im Footer, einen Klick entfernt, auf jeder Seite.
 * (Ein <button>, kein <a>: es wird nichts navigiert, nur der Dialog
 * geöffnet.)
 */
export function CookieSettingsLink() {
  return (
    <button
      type="button"
      className={styles.link}
      onClick={openConsentSettings}
    >
      Cookie-Einstellungen
    </button>
  );
}
