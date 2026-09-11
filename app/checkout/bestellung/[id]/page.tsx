import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClearCartOnMount } from "@/components/checkout/ClearCartOnMount";
import { TrackOrderCompleted } from "@/components/analytics/TrackOrderCompleted";
import { formatPrice } from "@/lib/format";
import { getOrder } from "@/lib/checkout/order";
import styles from "@/components/checkout/checkout.module.css";

export const metadata: Metadata = {
  title: "Bestellung bestätigt",
  // The order id is the only thing protecting this page; it must never be
  // indexed or followed.
  robots: { index: false, follow: false },
};

/**
 * Order confirmation.
 *
 * Reachable without a login on purpose, even now that the checkout can require
 * an account (`lib/checkout/account-requirement.ts`): the customer arrives here
 * straight from the payment provider, possibly after the session expired, and
 * with the switch off a guest's order id is their only handle on the order. The
 * id in the URL is what protects the page — hence `noindex, nofollow`, and
 * never linked from anywhere public.
 */
export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  return (
    <div className={styles.confirmation}>
      {/* The cart lives in client state; the cookie is already gone. */}
      <ClearCartOnMount />

      {/* «Bestellung abgeschlossen» — mit Wert und Währung für Trichter und
          Umsatz. Die Props werden hier Feld für Feld gebaut: order.email,
          order.address und die Telefonnummer bleiben BEWUSST draussen
          (Begründung: lib/analytics/events.ts). */}
      <TrackOrderCompleted
        orderId={order.id}
        displayId={order.displayId}
        total={order.total}
        subtotal={order.subtotal}
        shipping={order.shipping}
        currency={order.currency}
        lines={order.lines.map((l) => ({
          productHandle: l.productHandle,
          quantity: l.quantity,
        }))}
      />

      <p className="eyebrow">Bestellung {order.displayId || ""}</p>
      <h1 className={styles.confirmTitle}>Danke — das ist bestellt.</h1>
      <p className={styles.confirmText}>
        Wir haben deine Bestellung erhalten. Eine Bestätigung geht an{" "}
        <strong>{order.email}</strong>.{" "}
        {order.address?.phone ? (
          <>
            Sobald dein Paket unterwegs ist, melden wir uns per WhatsApp unter{" "}
            <strong>{order.address.phone}</strong>.
          </>
        ) : (
          <>Sobald dein Paket unterwegs ist, melden wir uns per E-Mail.</>
        )}
      </p>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Deine Artikel</h2>
        <ul className={styles.summaryList}>
          {order.lines.map((line) => (
            <li key={line.id} className={styles.summaryLine}>
              <span>
                {line.title}
                {line.variantTitle && ` · ${line.variantTitle}`}
                <span className={styles.summaryQty}> × {line.quantity}</span>
              </span>
              <span className="tnum">{formatPrice(line.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className={styles.totals}>
          <div>
            <dt>Zwischensumme</dt>
            <dd className="tnum">{formatPrice(order.subtotal)}</dd>
          </div>
          <div>
            <dt>Versand</dt>
            <dd className="tnum">
              {order.shipping === 0 ? "Gratis" : formatPrice(order.shipping)}
            </dd>
          </div>
          <div className={styles.grand}>
            <dt>Total</dt>
            <dd className="tnum">{formatPrice(order.total)}</dd>
          </div>
        </dl>
      </section>

      {order.address && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Lieferadresse</h2>
          <address className={styles.address}>
            {order.address.firstName} {order.address.lastName}
            <br />
            {order.address.company && (
              <>
                {order.address.company}
                <br />
              </>
            )}
            {order.address.address1}
            <br />
            {order.address.address2 && (
              <>
                {order.address.address2}
                <br />
              </>
            )}
            {order.address.postalCode} {order.address.city}
          </address>
        </section>
      )}

      <Link href="/" className={styles.secondaryCta}>
        Weiter einkaufen
      </Link>
    </div>
  );
}
