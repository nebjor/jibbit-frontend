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
      updated="Entwurf vom 21. August 2026 — vor Livegang juristisch prüfen lassen"
    >
      <p>
        <strong>
          Hinweis für den Betreiber: dieser Text ist eine inhaltlich
          vollständige Vorlage, aber keine Rechtsberatung. Vor dem Livegang
          durch eine juristische Fachperson prüfen lassen und die markierten
          Felder füllen.
        </strong>
      </p>

      <h2>1. Geltungsbereich</h2>
      <p>
        Diese Allgemeinen Geschäftsbedingungen gelten für sämtliche
        Bestellungen, die über den Onlineshop {STORE.domain} getätigt werden.
        Betreiber ist Joris Neber,{" "}
        Neber Import, Einzelunternehmen, Unterwegli 1, 8404 Winterthur{" "}
        (nachfolgend &laquo;wir&raquo;). Abweichende Bedingungen der Kundin
        oder des Kunden gelten nur, wenn wir ihnen ausdrücklich schriftlich
        zustimmen.
      </p>

      <h2>2. Sortiment</h2>
      <p>
        Wir verkaufen Raucherzubehör: Zigarettenpapier, Filter und Tips,
        Grinder, Aschenbecher, Hülsen und Aufbewahrung. Wir führen bewusst
        keinen Tabak, keine nikotinhaltigen Produkte und keine Produkte mit
        CBD oder THC.
      </p>

      <h2>3. Mindestalter</h2>
      <p>
        Unsere Artikel geben wir ausschliesslich an Personen ab {MIN_AGE}{" "}
        Jahren ab. Mit der Bestellung bestätigst du, dass du dieses Alter
        erreicht hast. Bei berechtigten Zweifeln können wir einen
        Altersnachweis verlangen oder die Bestellung stornieren.
      </p>

      <h2>4. Bestellablauf und Vertragsschluss</h2>
      <p>
        Die Darstellung der Produkte im Shop ist kein bindendes Angebot,
        sondern eine Einladung zur Bestellung. Vor dem Absenden siehst du eine
        Übersicht deiner Bestellung mit allen Positionen, Preisen und
        Versandkosten und kannst deine Eingaben dort prüfen und korrigieren.
      </p>
      <p>
        Mit dem Absenden der Bestellung gibst du ein verbindliches Angebot ab.
        Den Eingang deiner Bestellung bestätigen wir dir unverzüglich per
        E-Mail; diese Eingangsbestätigung ist noch keine Annahme. Der Vertrag
        kommt zustande, sobald wir die Bestellung ausdrücklich bestätigen oder
        die Ware versenden.
      </p>
      <p>
        Wir können Bestellungen ohne Angabe von Gründen ablehnen, etwa bei
        Nichtverfügbarkeit, offensichtlichen Preisfehlern oder begründeten
        Zweifeln an der Altersangabe.
      </p>

      <h2>5. Preise</h2>
      <p>
        Alle Preise verstehen sich in Schweizer Franken (CHF) und inklusive
        Endpreise; wir sind nicht mehrwertsteuerpflichtig. Massgeblich ist der Preis, der zum
        Zeitpunkt der Bestellung im Shop angezeigt wird. Versandkosten werden
        im Warenkorb und vor Abschluss der Bestellung separat ausgewiesen.
      </p>

      <h2>6. Versand und Lieferung</h2>
      <p>
        Wir liefern an Adressen in der Schweiz und versenden ab Lager in der
        Schweiz. Die Versandkosten betragen pauschal{" "}
        {formatPrice(SHIPPING.flatRate)}; ab einem Bestellwert von{" "}
        {formatPrice(SHIPPING.freeThreshold)} liefern wir versandkostenfrei.
      </p>
      <p>
        Wir versenden in der Regel innerhalb von 1–3 Werktagen nach
        Bestelleingang. Angegebene Lieferfristen sind Richtwerte und nicht
        verbindlich zugesagt; Verzögerungen beim Transport begründen keinen
        Schadenersatzanspruch. Details unter{" "}
        <Link href="/service/versand">Versand &amp; Lieferung</Link>.
      </p>

      <h2>7. Zahlung</h2>
      <p>
        Es gelten die im Bestellprozess angezeigten Zahlungsarten; vorgesehen
        sind TWINT und Kauf auf Rechnung. Die Zahlungsabwicklung erfolgt über
        einen externen Zahlungsdienstleister:{" "}
        Payrexx AG, Thun
        . Beim Kauf auf Rechnung gelten zusätzlich die Bedingungen des
        Rechnungsanbieters, insbesondere zur Bonitätsprüfung.
      </p>

      <h2>8. Eigentumsvorbehalt</h2>
      <p>
        Die gelieferte Ware bleibt bis zur vollständigen Bezahlung unser
        Eigentum.
      </p>

      <h2>9. Rückgabe</h2>
      <p>
        Das schweizerische Recht kennt für Bestellungen im Onlinehandel kein
        gesetzliches Widerrufsrecht. Wir gewähren dir freiwillig ein
        vertragliches Rückgaberecht von 14 Tagen ab Erhalt der Ware. Die
        Bedingungen dazu findest du unter{" "}
        <Link href="/widerrufsrecht">Widerrufsrecht</Link>, den praktischen
        Ablauf unter{" "}
        <Link href="/service/rueckgabe">Rückgabe &amp; Umtausch</Link>.
      </p>

      <h2>10. Gewährleistung</h2>
      <p>
        Es gelten die gesetzlichen Bestimmungen zur Sachgewährleistung nach
        Schweizer Obligationenrecht (Art. 197 ff. OR); die Ansprüche verjähren
        zwei Jahre nach Ablieferung der Ware. Bitte melde uns Mängel möglichst
        bald nach der Entdeckung. Bei berechtigten Mängelrügen ersetzen wir
        die Ware oder erstatten den Kaufpreis; die Rückversandkosten gehen in
        diesem Fall auf uns.
      </p>

      <h2>11. Haftung</h2>
      <p>
        Unsere Haftung beschränkt sich auf Vorsatz und grobe Fahrlässigkeit,
        soweit gesetzlich zulässig. Eine Haftung für indirekte Schäden oder
        entgangenen Gewinn ist ausgeschlossen. Die Haftung für Personenschäden
        bleibt in jedem Fall vorbehalten.
      </p>

      <h2>12. Datenschutz</h2>
      <p>
        Wie wir mit deinen Daten umgehen, steht in unserer{" "}
        <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>

      <h2>13. Änderungen dieser AGB</h2>
      <p>
        Wir können diese AGB jederzeit ändern. Für deine Bestellung ist die
        Fassung massgebend, die zum Zeitpunkt der Bestellung im Shop
        veröffentlicht war.
      </p>

      <h2>14. Anwendbares Recht und Gerichtsstand</h2>
      <p>
        Es gilt ausschliesslich schweizerisches Recht unter Ausschluss des
        UN-Kaufrechts (CISG). Gerichtsstand ist Winterthur, soweit nicht
        zwingende gesetzliche Bestimmungen einen anderen Gerichtsstand
        vorschreiben.
      </p>
    </Prose>
  );
}
