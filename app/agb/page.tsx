import type { Metadata } from "next";
import Link from "next/link";
import { Prose, Platzhalter } from "@/components/Prose";
import { STORE, SHIPPING, MIN_AGE } from "@/lib/config";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "AGB",
  description: `Allgemeine Geschäftsbedingungen von ${STORE.domain}.`,
};

export default function AgbPage() {
  return (
    <Prose
      title="Allgemeine Geschäftsbedingungen"
      intro={`Diese AGB regeln alle Bestellungen über ${STORE.domain}. Bitte lies sie durch, bevor du bestellst.`}
      updated="Entwurf – vor Livegang juristisch prüfen lassen"
    >
      <p>
        <strong>
          Hinweis für den Betreiber: dieser Text ist eine inhaltlich vollständige
          Vorlage, aber keine Rechtsberatung. Vor dem Livegang durch eine
          juristische Fachperson prüfen lassen und die markierten Felder füllen.
        </strong>
      </p>

      <h2>1. Geltungsbereich</h2>
      <p>
        Diese Allgemeinen Geschäftsbedingungen gelten für sämtliche Bestellungen,
        die über den Onlineshop {STORE.domain} getätigt werden. Betreiberin ist{" "}
        <Platzhalter>Firmenname</Platzhalter> (nachfolgend &laquo;wir&raquo;).
        Abweichende Bedingungen der Kundin oder des Kunden gelten nur, wenn wir
        ihnen ausdrücklich schriftlich zustimmen.
      </p>

      <h2>2. Vertragsschluss</h2>
      <p>
        Die Darstellung der Produkte im Shop stellt kein bindendes Angebot dar,
        sondern eine Einladung zur Bestellung. Mit dem Absenden der Bestellung
        gibst du ein verbindliches Angebot ab. Der Vertrag kommt zustande, sobald
        wir die Bestellung per E-Mail bestätigen oder die Ware versenden.
      </p>
      <p>
        Wir behalten uns vor, Bestellungen ohne Angabe von Gründen abzulehnen,
        etwa bei Nichtverfügbarkeit, offensichtlichen Preisfehlern oder
        begründeten Zweifeln an der Altersangabe.
      </p>

      <h2>3. Mindestalter</h2>
      <p>
        Unsere Artikel werden ausschliesslich an Personen ab {MIN_AGE} Jahren
        abgegeben. Mit der Bestellung bestätigst du, dass du dieses Alter
        erreicht hast. Bei berechtigten Zweifeln können wir einen Altersnachweis
        verlangen oder die Bestellung stornieren.
      </p>

      <h2>4. Preise</h2>
      <p>
        Alle Preise verstehen sich in Schweizer Franken (CHF) und inklusive der
        gesetzlichen Mehrwertsteuer. Massgeblich ist der Preis, der zum Zeitpunkt
        der Bestellung im Shop angezeigt wird. Versandkosten werden im Warenkorb
        und vor Abschluss der Bestellung separat ausgewiesen.
      </p>

      <h2>5. Versand und Lieferung</h2>
      <p>
        Wir versenden innerhalb der Schweiz. Die Versandkosten betragen pauschal{" "}
        {formatPrice(SHIPPING.flatRate)}. Ab einem Bestellwert von{" "}
        {formatPrice(SHIPPING.freeThreshold)} liefern wir versandkostenfrei.
      </p>
      <p>
        Angegebene Lieferfristen sind Richtwerte und nicht verbindlich zugesagt.
        Verzögerungen durch die Post oder durch Lieferengpässe begründen keinen
        Schadenersatzanspruch. Details unter{" "}
        <Link href="/service/versand">Versand &amp; Lieferung</Link>.
      </p>

      <h2>6. Zahlung</h2>
      <p>
        Wir akzeptieren TWINT und Powerpay (Kauf auf Rechnung). Die
        Zahlungsabwicklung erfolgt über unseren Zahlungsdienstleister Payrexx.
        Bei Zahlung auf Rechnung gelten zusätzlich die Bedingungen des
        Rechnungsanbieters, insbesondere zur Bonitätsprüfung.
      </p>

      <h2>7. Eigentumsvorbehalt</h2>
      <p>
        Die gelieferte Ware bleibt bis zur vollständigen Bezahlung unser
        Eigentum.
      </p>

      <h2>8. Rückgabe</h2>
      <p>
        Das schweizerische Recht kennt für Bestellungen im Onlinehandel kein
        gesetzliches Widerrufsrecht. Wir gewähren dir freiwillig ein
        vertragliches Rückgaberecht. Die Bedingungen dazu findest du unter{" "}
        <Link href="/widerrufsrecht">Widerrufsrecht</Link> und{" "}
        <Link href="/service/rueckgabe">Rückgabe &amp; Umtausch</Link>.
      </p>

      <h2>9. Gewährleistung</h2>
      <p>
        Es gelten die gesetzlichen Bestimmungen zur Sachgewährleistung nach
        Schweizer Obligationenrecht. Offensichtliche Mängel sind uns unverzüglich
        nach Erhalt der Ware zu melden. Bei berechtigten Mängelrügen ersetzen wir
        die Ware oder erstatten den Kaufpreis.
      </p>

      <h2>10. Haftung</h2>
      <p>
        Unsere Haftung beschränkt sich auf Vorsatz und grobe Fahrlässigkeit,
        soweit gesetzlich zulässig. Eine Haftung für indirekte Schäden oder
        entgangenen Gewinn ist ausgeschlossen. Die Haftung für Personenschäden
        bleibt in jedem Fall vorbehalten.
      </p>

      <h2>11. Datenschutz</h2>
      <p>
        Wie wir mit deinen Daten umgehen, steht in unserer{" "}
        <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>

      <h2>12. Änderungen dieser AGB</h2>
      <p>
        Wir können diese AGB jederzeit ändern. Massgebend ist die Fassung, die
        zum Zeitpunkt deiner Bestellung im Shop veröffentlicht war.
      </p>

      <h2>13. Anwendbares Recht und Gerichtsstand</h2>
      <p>
        Es gilt ausschliesslich schweizerisches Recht unter Ausschluss des
        UN-Kaufrechts (CISG). Gerichtsstand ist{" "}
        <Platzhalter>Sitz der Betreiberin</Platzhalter>, soweit nicht zwingende
        gesetzliche Bestimmungen einen anderen Gerichtsstand vorschreiben.
      </p>
    </Prose>
  );
}
