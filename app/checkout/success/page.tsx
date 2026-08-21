import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PaymentReturnStatus } from "@/components/checkout/PaymentReturnStatus";

export const metadata: Metadata = {
  title: "Zahlung wird bestätigt",
  robots: { index: false, follow: false },
};

/**
 * Landeplatz nach der Zahlung auf der zahls.ch/Payrexx-Seite.
 *
 * Das Backend hängt `?payment_session_id=…` an die Rückkehr-URL
 * (backend/src/modules/payrexx, `initiatePayment()`). Der Status kommt danach
 * ausschliesslich aus einer server-seitigen Abfrage — wer diese Seite von
 * Hand aufruft, bekommt keine bezahlte Bestellung.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ payment_session_id?: string }>;
}) {
  const { payment_session_id: sessionId } = await searchParams;
  if (!sessionId) redirect("/checkout");

  return <PaymentReturnStatus sessionId={sessionId} />;
}
