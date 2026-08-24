import type { Metadata } from "next";
import { PaymentReturnStatus } from "@/components/checkout/PaymentReturnStatus";

export const metadata: Metadata = {
  title: "Zahlung wird bestätigt",
  robots: { index: false, follow: false },
};

/**
 * Landeplatz nach der Zahlung auf der zahls.ch-Bezahlseite — für beide
 * Provider:
 *
 * - Payrexx-Modul (pp_payrexx_payrexx): hängt `?payment_session_id=…` an die
 *   Rückkehr-URL (backend/src/modules/payrexx, `initiatePayment()`); der
 *   Status wird server-seitig über `/store/payrexx/return` abgeglichen.
 * - Offizielles zahls.ch-Plugin (pp_zahls_zahls): dessen Redirect-URLs sind
 *   STATISCH — keine Query. Ohne `payment_session_id` versucht die Seite
 *   deshalb server-seitig den Cart-Abschluss; Medusa autorisiert dabei die
 *   Zahlung frisch beim PSP (lib/checkout/return.ts).
 *
 * In beiden Fällen kommt der Status ausschliesslich aus server-seitigen
 * Abfragen — wer diese Seite von Hand aufruft, bekommt keine bezahlte
 * Bestellung.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ payment_session_id?: string }>;
}) {
  const { payment_session_id: sessionId } = await searchParams;

  return <PaymentReturnStatus sessionId={sessionId} />;
}
