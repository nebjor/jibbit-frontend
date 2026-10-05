import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/Prose";
import { STORE, SHIPPING, MIN_AGE, BUSINESS, PICKUP } from "@/lib/config";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "AGB",
  // Eine Adresse je Seite, ohne Parameter. Hier zusätzlich nötig: /terms
  // liefert denselben Inhalt aus (lib/seo/legacy-redirects.ts).
  alternates: { canonical: "/agb" },
  description: `Allgemeine Geschäftsbedingungen von ${STORE.domain}.`,
};

export default function AgbPage() {
  return (
    <Prose
      title="Allgemeine Geschäftsbedingungen"
      intro={`Diese AGB regeln alle Bestellungen über ${STORE.domain}. Bitte lies sie durch, bevor du bestellst.`}
      updated="21. September 2026"
    >
      <h2>1. Geltungsbereich</h2>
      <p>
        Diese Allgemeinen Geschäftsbedingungen gelten für sämtliche
        Bestellungen, die über den Onlineshop {STORE.domain} getätigt werden.
        Betreiber ist Joris Neber,{" "}
        Neber Import, Einzelunternehmen, Unterwegli 1, 8404 Winterthur,{" "}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>{" "}
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
        Zweifeln an der Altersangabe. Einen bereits bezahlten Betrag
        erstatten wir in diesem Fall umgehend über die ursprüngliche
        Zahlungsart.
      </p>

      <h2>5. Preise</h2>
      <p>
        Alle Preise verstehen sich in Schweizer Franken (CHF) als
        Endpreise. Wir sind nicht mehrwertsteuerpflichtig; es wird keine
        Mehrwertsteuer erhoben und keine ausgewiesen. Massgeblich ist der Preis, der zum
        Zeitpunkt der Bestellung im Shop angezeigt wird. Versandkosten werden
        im Warenkorb und vor Abschluss der Bestellung separat ausgewiesen.
      </p>

      <h2>6. Versand und Lieferung</h2>
      <p>
        Wir liefern an Adressen in der Schweiz und versenden ab Lager in der
        Schweiz. Der Versand kostet pro Bestellung{" "}
        {formatPrice(SHIPPING.rate)}; ab einem Bestellwert von{" "}
        {formatPrice(SHIPPING.freeThreshold)} liefern wir versandkostenfrei.
        Können wir eine Bestellung als Brief versenden, schreiben wir dir die
        Differenz als Gutscheincode für den Shop gut.
      </p>
      {PICKUP.enabled && (
        <p>
          Alternativ kannst du deine Bestellung kostenlos in unserem Laden
          abholen ({PICKUP.address.street}, {PICKUP.address.postalCode}{" "}
          {PICKUP.address.city}). Wir informieren dich per E-Mail, sobald sie
          abholbereit ist; die Gefahr geht mit der Übergabe im Laden auf dich
          über.
        </p>
      )}
      <p>
        Wir versenden in der Regel innerhalb von 1–3 Werktagen nach
        Bestelleingang. Angegebene Lieferfristen sind Richtwerte und nicht
        verbindlich zugesagt; Verzögerungen beim Transport begründen, soweit
        gesetzlich zulässig, keinen Schadenersatzanspruch. Die Gefahr eines
        Verlusts oder einer Beschädigung auf dem Transport tragen wir; sie
        geht mit der Zustellung auf dich über. Details unter{" "}
        <Link href="/service/versand">Versand &amp; Lieferung</Link>.
      </p>

      <h2>7. Zahlung</h2>
      <p>
        Es gelten die im Bestellprozess angezeigten Zahlungsarten; angeboten
        werden TWINT, Kreditkarte und PostFinance. Die Zahlungsabwicklung
        erfolgt über einen externen Zahlungsdienstleister:{" "}
        zahls.ch, betrieben von der siebenberge gmbh.
      </p>

      <h2>8. Eigentumsvorbehalt</h2>
      <p>
        Die gelieferte Ware bleibt bis zur vollständigen Bezahlung unser
        Eigentum.
      </p>

      <h2>9. Rückgabe</h2>
      <p>
        Das schweizerische Recht kennt für Bestellungen im Onlinehandel kein
        gesetzliches Widerrufsrecht. Wir gewähren auch kein freiwilliges
        Rückgabe- oder Umtauschrecht bei blossem Sinneswandel. In besonderen
        Fällen kann der Inhaber eine Rückgabe ungeöffneter, unbenutzter Ware
        in der Originalverpackung aus Kulanz annehmen; ein Anspruch darauf
        besteht nicht. Die Kosten der Rücksendung trägst in diesem Fall du.
        Geöffnete oder benutzte Verbrauchsartikel (Papers, Filter, Tips) sind
        davon ausgeschlossen.
      </p>
      <p>
        Der Grund: Unsere Artikel sind im Shop mit Bild, Marke, Format und Menge
        genau beschrieben. Du siehst vor der Bestellung, was du bekommst, und
        nichts davon muss anprobiert oder ausprobiert werden.
      </p>
      <p>
        Davon unberührt bleiben deine gesetzlichen Rechte bei Mängeln,
        beschädigter Ware und Falschlieferungen. Diese Fälle regelt Ziffer 10,
        und dort tragen wir die Kosten. Den praktischen Ablauf findest du unter{" "}
        <Link href="/service/rueckgabe">Rückgaberecht &amp; Reklamation</Link>.
      </p>

      <h2>10. Gewährleistung</h2>
      <p>
        Es gelten die gesetzlichen Bestimmungen zur Sachgewährleistung nach
        Schweizer Obligationenrecht (Art. 197 ff. OR); die Ansprüche verjähren
        zwei Jahre nach Ablieferung der Ware. Bitte melde uns Mängel möglichst
        bald nach der Entdeckung. Bei berechtigten Mängelrügen ersetzen wir
        die Ware oder erstatten den Kaufpreis; die Rückversandkosten gehen in
        diesem Fall auf uns. Erstattungen erfolgen über die ursprünglich
        genutzte Zahlungsart.
      </p>

      <h2>11. Haftung</h2>
      <p>
        Unsere Haftung beschränkt sich auf Vorsatz und grobe Fahrlässigkeit,
        soweit gesetzlich zulässig. Eine Haftung für indirekte Schäden oder
        entgangenen Gewinn ist ausgeschlossen. Die Haftung für Personenschäden
        sowie die Haftung nach dem Produktehaftpflichtgesetz bleiben in jedem
        Fall vorbehalten.
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
