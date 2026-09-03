"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completePendingOrderAction } from "@/app/actions/checkout";
import { useCart } from "@/components/CartProvider";
import { EMPTY_CART } from "@/lib/cart/types";
import {
  PATIENCE_AFTER,
  TOTAL_ATTEMPTS,
  delayBeforeAttempt,
} from "@/lib/checkout/poll-schedule";
import styles from "./checkout.module.css";

/**
 * Rückkehr von der zahls.ch-Bezahlseite (offizielles Plugin, statische
 * Redirect-URLs — der Browser bringt keine Zahlungsreferenz mit).
 *
 * Die Seite versucht server-seitig, den Cart abzuschliessen. Medusa
 * autorisiert die Zahlung dabei frisch beim Anbieter; unbezahlt entsteht
 * keine Bestellung. Der Browser wird nie nach seiner Meinung gefragt.
 *
 * ─── Was hier ausdrücklich anders ist als vorher ───────────────────────────
 *
 * 1. ES WIRD WEITER GEFRAGT. Vorher hörte die Seite nach acht Versuchen auf.
 *    Traf die Bestätigung eine halbe Minute später ein, blieb der Kunde auf
 *    «wir warten» sitzen, obwohl die Bestellung längst existierte — gemeldet
 *    und reproduziert. Jetzt läuft nach dem dichten Takt ein langsamer
 *    weiter, und die Seite leitet auch dann noch von selbst weiter.
 *
 * 2. DER WARENKORB WIRD GELEERT, sobald feststeht, dass er verbraucht ist.
 *    Sonst zeigt das Körbchen im Kopfbereich weiter Artikel an, die es
 *    server-seitig nicht mehr gibt — und ein Klick auf «Bezahlen» lief ins
 *    Leere. Ebenfalls gemeldet.
 *
 * 3. ES GIBT EINEN KNOPF. Wer nicht warten will, prüft sofort nach.
 */

type View =
  | { state: "checking" }
  | { state: "still-pending" }
  | { state: "no-cart" };

export function PaymentReturnStatus() {
  const router = useRouter();
  const { applyCart } = useCart();
  const [view, setView] = useState<View>({ state: "checking" });
  const [manualBusy, setManualBusy] = useState(false);
  const started = useRef(false);
  const finished = useRef(false);

  /**
   * Einen Abschlussversuch. Gibt `true` zurück, wenn danach nichts mehr zu
   * tun ist — die Schleife hört dann auf.
   */
  const attemptOnce = useCallback(async (): Promise<boolean> => {
    if (finished.current) return true;

    const result = await completePendingOrderAction();

    if (result.kind === "order") {
      finished.current = true;
      // Erst den Warenkorb im Browser leeren, dann weiterleiten: sonst zeigt
      // das Körbchen auf der Bestätigungsseite noch die eben gekauften Artikel.
      applyCart(EMPTY_CART);
      router.replace(`/checkout/bestellung/${result.orderId}`);
      return true;
    }

    if (result.kind === "missing") {
      finished.current = true;
      // Server-seitig ist kein Warenkorb mehr offen. Was der Browser noch
      // anzeigt, ist ein Trugbild — weg damit.
      applyCart(EMPTY_CART);
      setView({ state: "no-cart" });
      return true;
    }

    return false; // pending
  }, [applyCart, router]);

  useEffect(() => {
    // React 18 StrictMode hängt zweimal ein — der Abschluss ist idempotent,
    // ein zweiter paralleler Lauf wäre trotzdem sinnlos.
    if (started.current) return;
    started.current = true;

    let cancelled = false;

    (async () => {
      for (let attempt = 1; attempt <= TOTAL_ATTEMPTS; attempt++) {
        const wait = delayBeforeAttempt(attempt);
        if (wait) {
          await new Promise((r) => setTimeout(r, wait));
          if (cancelled) return;
        }

        const done = await attemptOnce();
        if (cancelled || done) return;

        // Ab hier ist die Wartezeit spürbar — dem Kunden sagen, dass es
        // dauert. Gefragt wird trotzdem weiter.
        if (attempt === PATIENCE_AFTER) {
          setView({ state: "still-pending" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attemptOnce]);

  const checkNow = async () => {
    if (manualBusy || finished.current) return;
    setManualBusy(true);
    try {
      await attemptOnce();
    } finally {
      setManualBusy(false);
    }
  };

  if (view.state === "checking") {
    return (
      <div className={styles.confirmation} aria-busy="true">
        <h1 className={styles.confirmTitle}>Zahlung wird bestätigt …</h1>
        <p className={styles.confirmText}>
          Einen Moment — wir warten auf die Bestätigung der Zahlung. Bitte
          dieses Fenster nicht schliessen.
        </p>
      </div>
    );
  }

  if (view.state === "still-pending") {
    return (
      <div className={styles.confirmation} aria-busy="true">
        <h1 className={styles.confirmTitle}>
          Die Bestätigung dauert gerade länger
        </h1>
        <p className={styles.confirmText}>
          Deine Zahlung ist unterwegs, die Bestätigung steht noch aus. Wir
          fragen weiter nach und leiten dich automatisch weiter, sobald sie da
          ist — du musst nichts tun und{" "}
          <strong>auf keinen Fall erneut bezahlen</strong>.
        </p>
        <p className={styles.confirmText}>
          Kommt sie gar nicht an, schliessen wir die Bestellung trotzdem ab,
          sobald der Zahlungsanbieter sie meldet. Die Bestätigung mit allen
          Details bekommst du dann per E-Mail.
        </p>
        <button
          type="button"
          className={styles.secondaryCta}
          onClick={checkNow}
          disabled={manualBusy}
        >
          {manualBusy ? "Wird geprüft …" : "Jetzt prüfen"}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.confirmation}>
      <h1 className={styles.confirmTitle}>Keine offene Bestellung gefunden</h1>
      <p className={styles.confirmText}>
        In diesem Browser liegt kein offener Warenkorb. Falls du gerade bezahlt
        hast, wird die Bestellung automatisch abgeschlossen — die Bestätigung
        mit allen Details kommt per E-Mail.
      </p>
      <Link href="/shop" className={styles.secondaryCta}>
        Zurück zum Shop
      </Link>
    </div>
  );
}
