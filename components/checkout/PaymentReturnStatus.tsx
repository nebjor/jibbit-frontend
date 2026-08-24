"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  completePendingOrderAction,
  confirmPaymentReturnAction,
} from "@/app/actions/checkout";
import styles from "./checkout.module.css";

/**
 * Rückkehr von der zahls.ch-Bezahlseite — für beide Provider.
 *
 * Mit `sessionId` (Payrexx-Modul, `?payment_session_id=…` in der URL):
 * fragt den Zahlungsstand server-seitig über `/store/payrexx/return` ab.
 *
 * Ohne `sessionId` (offizielles zahls.ch-Plugin, statische Redirect-URLs):
 * versucht server-seitig, den Cart abzuschliessen — Medusa autorisiert die
 * Zahlung dabei frisch beim PSP; unbezahlt entsteht keine Bestellung.
 *
 * In beiden Fällen wird der Browser nie nach seiner Meinung gefragt, und bei
 * `pending`/`unknown` wird einige Male nachgepollt: TWINT bestätigt oft erst
 * Sekunden nach der Weiterleitung. Kommt in der Zeit keine Bestätigung, ist
 * das KEIN Misserfolg — der Webhook schliesst die Bestellung unabhängig davon
 * ab, der Kunde bekommt die Bestätigung per Mail.
 */

const MAX_ATTEMPTS = 8;
const RETRY_DELAY_MS = 2500;

type View =
  | { state: "checking" }
  | { state: "paid" }
  | { state: "still-pending" }
  | { state: "canceled" }
  | { state: "no-cart" }
  | { state: "error"; message: string };

export function PaymentReturnStatus({ sessionId }: { sessionId?: string }) {
  const router = useRouter();
  const [view, setView] = useState<View>({ state: "checking" });
  const started = useRef(false);

  useEffect(() => {
    // React 18 StrictMode mounts twice — die Abfrage ist idempotent, aber ein
    // paralleler zweiter Poll-Lauf wäre sinnlos.
    if (started.current) return;
    started.current = true;

    let cancelled = false;

    (async () => {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const result = sessionId
          ? await confirmPaymentReturnAction(sessionId)
          : await completePendingOrderAction();
        if (cancelled) return;

        switch (result.kind) {
          case "order":
            router.replace(`/checkout/bestellung/${result.orderId}`);
            return;
          case "paid":
            setView({ state: "paid" });
            return;
          case "canceled":
            setView({ state: "canceled" });
            return;
          case "missing":
            setView({ state: "no-cart" });
            return;
          case "error":
            setView({ state: "error", message: result.message });
            return;
          case "pending":
          case "unknown":
            break; // weiter pollen
        }

        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          if (cancelled) return;
        }
      }
      setView({ state: "still-pending" });
    })();

    return () => {
      cancelled = true;
    };
    // sessionId kommt aus der URL und ändert sich auf dieser Seite nicht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (view.state === "paid") {
    return (
      <div className={styles.confirmation}>
        <h1 className={styles.confirmTitle}>Zahlung erhalten</h1>
        <p className={styles.confirmText}>
          Deine Zahlung ist bestätigt. Die Bestellbestätigung mit allen Details
          kommt per E-Mail.
        </p>
        <Link href="/shop" className={styles.secondaryCta}>
          Weiter einkaufen
        </Link>
      </div>
    );
  }

  if (view.state === "still-pending") {
    return (
      <div className={styles.confirmation}>
        <h1 className={styles.confirmTitle}>Die Bestätigung dauert gerade länger</h1>
        <p className={styles.confirmText}>
          Deine Zahlung ist unterwegs, die Bestätigung steht aber noch aus.
          Sobald sie da ist, schliessen wir die Bestellung automatisch ab und
          melden uns per E-Mail — du musst nichts weiter tun und{" "}
          <strong>nicht erneut bezahlen</strong>.
        </p>
        {!sessionId ? (
          <p className={styles.confirmText}>
            Falls du die Zahlung doch nicht abgeschlossen hast, ist dein
            Warenkorb unverändert da — du kannst jederzeit{" "}
            <Link href="/checkout">zur Kasse zurück</Link>.
          </p>
        ) : null}
        <Link href="/shop" className={styles.secondaryCta}>
          Zurück zum Shop
        </Link>
      </div>
    );
  }

  if (view.state === "canceled") {
    return (
      <div className={styles.confirmation}>
        <h1 className={styles.confirmTitle}>Zahlung nicht abgeschlossen</h1>
        <p className={styles.confirmText}>
          Die Zahlung wurde abgebrochen oder abgelehnt. Es wurde nichts
          belastet, dein Warenkorb ist unverändert da.
        </p>
        <Link href="/checkout" className={styles.secondaryCta}>
          Zurück zur Kasse
        </Link>
      </div>
    );
  }

  if (view.state === "no-cart") {
    return (
      <div className={styles.confirmation}>
        <h1 className={styles.confirmTitle}>Keine offene Bestellung gefunden</h1>
        <p className={styles.confirmText}>
          In diesem Browser liegt kein offener Warenkorb. Falls du gerade
          bezahlt hast, wird die Bestellung automatisch abgeschlossen — die
          Bestätigung mit allen Details kommt per E-Mail.
        </p>
        <Link href="/shop" className={styles.secondaryCta}>
          Zurück zum Shop
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.confirmation}>
      <h1 className={styles.confirmTitle}>Da ist etwas schiefgegangen</h1>
      <p className={styles.confirmText}>{view.message}</p>
      <Link href="/checkout" className={styles.secondaryCta}>
        Zurück zur Kasse
      </Link>
    </div>
  );
}
