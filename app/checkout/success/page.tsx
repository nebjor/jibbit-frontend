import type { Metadata } from "next";
import { PaymentReturnStatus } from "@/components/checkout/PaymentReturnStatus";

export const metadata: Metadata = {
  title: "Zahlung wird bestätigt",
  robots: { index: false, follow: false },
};

/**
 * Landeplatz nach der Zahlung auf der zahls.ch-Bezahlseite
 * (offizielles Plugin, pp_zahls_zahls).
 *
 * Die Redirect-URLs des Plugins sind STATISCH — keine Query, keine
 * Zahlungsreferenz. Die Seite versucht deshalb server-seitig den
 * Cart-Abschluss; Medusa autorisiert dabei die Zahlung frisch beim PSP
 * (lib/checkout/return.ts). Der Status kommt ausschliesslich aus
 * server-seitigen Abfragen — wer diese Seite von Hand aufruft, bekommt
 * keine bezahlte Bestellung.
 */
export default function CheckoutSuccessPage() {
  return <PaymentReturnStatus />;
}
