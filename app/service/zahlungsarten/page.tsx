import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/Prose";

export const metadata: Metadata = {
  title: "Zahlungsarten",
  // Eine Adresse je Seite, ohne Parameter (relativ zu `metadataBase`).
  alternates: { canonical: "/service/zahlungsarten" },
  description:
    "Bezahlen mit TWINT, Kreditkarte, PostFinance, Apple Pay oder Google Pay. Abgewickelt über den Schweizer Zahlungsdienstleister zahls.ch.",
};

export default function ZahlungsartenPage() {
  return (
    <Prose
      title="Zahlungsarten"
      intro="TWINT direkt vom Handy, Kreditkarte, PostFinance oder das Wallet auf deinem Handy (Apple Pay, Google Pay) — abgewickelt über den Schweizer Zahlungsdienstleister zahls.ch."
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
        Visa und Mastercard sowie PostFinance Card / PostFinance E-Finance. Du
        gibst deine Kartendaten auf der Bezahlseite von zahls.ch ein; bei uns
        landen sie nie.
      </p>

      <h2>Apple Pay &amp; Google Pay</h2>
      <p>
        Auf der zahls.ch-Bezahlseite kannst du mit dem Wallet bezahlen, das auf
        deinem Handy hinterlegt ist: Apple&nbsp;Pay auf iPhone und Mac mit
        Safari, Google&nbsp;Pay auf Android und in Chrome. Die Option erscheint
        automatisch, wenn dein Gerät sie unterstützt — bestätigt wird wie
        gewohnt per Face&nbsp;ID, Fingerabdruck oder Gerätecode, ohne
        Kartendaten abzutippen.
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
