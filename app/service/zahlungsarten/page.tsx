import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/Prose";

export const metadata: Metadata = {
  title: "Zahlungsarten",
  description:
    "Bezahlen mit TWINT, Kreditkarte oder PostFinance. Abgewickelt über den Schweizer Zahlungsdienstleister zahls.ch.",
};

export default function ZahlungsartenPage() {
  return (
    <Prose
      title="Zahlungsarten"
      intro="TWINT direkt vom Handy, Kreditkarte oder PostFinance — abgewickelt über den Schweizer Zahlungsdienstleister zahls.ch."
    >
      <h2>TWINT</h2>
      <p>
        Die schnellste Variante. Du wirst nach der Bestellung zur Bezahlseite
        weitergeleitet beziehungsweise scannst den QR-Code mit deiner
        TWINT-App und bestätigst die Zahlung. Der Betrag wird direkt deinem
        hinterlegten Konto belastet.
      </p>
      <p>
        Sobald die Zahlung bestätigt ist, geht die Bestellung bei uns in die
        Verarbeitung — das ist auch der schnellste Weg zum Versand.
      </p>

      <h2>Kreditkarte und PostFinance</h2>
      <p>
        Visa und Mastercard sowie PostFinance Card / PostFinance E-Finance.
        Auch Apple&nbsp;Pay, Google&nbsp;Pay und Samsung&nbsp;Pay stehen auf
        der Bezahlseite zur Verfügung, wenn dein Gerät sie unterstützt.
      </p>

      <h2>Kauf auf Rechnung</h2>
      <p>
        Kauf auf Rechnung bieten wir derzeit nicht an. Sobald sich das ändert,
        steht es hier zuerst.
      </p>

      <h2>Sicherheit</h2>
      <p>
        Die gesamte Zahlungsabwicklung läuft über zahls.ch. Wir sehen und
        speichern keine vollständigen Zahlungsdaten — diese werden ausschliesslich
        verschlüsselt zwischen dir und dem Zahlungsdienstleister übertragen.
      </p>

      <h2>Währung und Mehrwertsteuer</h2>
      <p>
        Alle Preise sind in Schweizer Franken (CHF) angegeben und verstehen sich als
        Endpreise. Wir sind nicht mehrwertsteuerpflichtig, daher wird keine
        Mehrwertsteuer erhoben und keine ausgewiesen. Versandkosten weisen wir vor
        Abschluss der Bestellung separat aus.
      </p>

      <h2>Rückerstattungen</h2>
      <p>
        Erstattungen laufen immer über denselben Weg zurück, den du beim Bezahlen
        genutzt hast. Details dazu unter{" "}
        <Link href="/service/rueckgabe">Rückgaberecht &amp; Reklamation</Link>.
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
