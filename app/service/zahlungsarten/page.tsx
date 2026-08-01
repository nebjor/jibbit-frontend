import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/Prose";

export const metadata: Metadata = {
  title: "Zahlungsarten",
  description:
    "Bezahlen mit TWINT oder Powerpay (Kauf auf Rechnung). Abgewickelt über Payrexx.",
};

export default function ZahlungsartenPage() {
  return (
    <Prose
      title="Zahlungsarten"
      intro="Zwei Wege, beide unkompliziert: TWINT direkt vom Handy, oder Powerpay auf Rechnung. Abgewickelt über den Schweizer Zahlungsdienstleister Payrexx."
    >
      <h2>TWINT</h2>
      <p>
        Die schnellste Variante. Du wirst nach der Bestellung zu TWINT
        weitergeleitet beziehungsweise scannst den QR-Code mit deiner
        TWINT-App und bestätigst die Zahlung. Der Betrag wird direkt deinem
        hinterlegten Konto belastet.
      </p>
      <p>
        Sobald die Zahlung bestätigt ist, geht die Bestellung bei uns in die
        Verarbeitung — das ist auch der schnellste Weg zum Versand.
      </p>

      <h2>Powerpay — Kauf auf Rechnung</h2>
      <p>
        Du bestellst jetzt und bezahlst später. Powerpay übernimmt die
        Rechnungsstellung; du erhältst die Rechnung separat und bezahlst
        innerhalb der dort angegebenen Frist.
      </p>
      <p>
        Für den Kauf auf Rechnung führt Powerpay eine Bonitätsprüfung durch. Wird
        die Zahlungsart abgelehnt, kannst du die Bestellung einfach mit TWINT
        abschliessen. Es gelten zusätzlich die Bedingungen von Powerpay.
      </p>

      <h2>Sicherheit</h2>
      <p>
        Die gesamte Zahlungsabwicklung läuft über Payrexx. Wir sehen und
        speichern keine vollständigen Zahlungsdaten — diese werden ausschliesslich
        verschlüsselt zwischen dir und dem Zahlungsdienstleister übertragen.
      </p>

      <h2>Währung und Mehrwertsteuer</h2>
      <p>
        Alle Preise sind in Schweizer Franken (CHF) angegeben und verstehen sich
        inklusive der gesetzlichen Mehrwertsteuer. Versandkosten weisen wir vor
        Abschluss der Bestellung separat aus.
      </p>

      <h2>Rückerstattungen</h2>
      <p>
        Erstattungen laufen immer über denselben Weg zurück, den du beim Bezahlen
        genutzt hast. Details dazu unter{" "}
        <Link href="/service/rueckgabe">Rückgabe &amp; Umtausch</Link>.
      </p>

      <h2>Rechtliches</h2>
      <p>
        Die vertragliche Grundlage zur Zahlung steht in unseren{" "}
        <Link href="/agb">AGB</Link>. Wie wir mit Zahlungsdaten umgehen, steht in
        der <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>
    </Prose>
  );
}
