import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { requiresAccount } from "@/lib/checkout/account-requirement";
import { STORE, BUSINESS } from "@/lib/config";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  // Eine Adresse je Seite, ohne Parameter (relativ zu `metadataBase`).
  alternates: { canonical: "/datenschutz" },
  description: `Wie ${STORE.domain} Personendaten bearbeitet — nach dem Schweizer Datenschutzgesetz (DSG).`,
};

export default function DatenschutzPage() {
  return (
    <Prose
      title="Datenschutzerklärung"
      intro="Diese Erklärung beschreibt, welche Personendaten wir bearbeiten, zu welchem Zweck, und welche Rechte du hast. Sie richtet sich nach dem Schweizer Datenschutzgesetz (DSG, in Kraft seit 1. September 2023)."
      updated="5. Oktober 2026"
    >
      <h2>1. Verantwortliche Stelle</h2>
      <p>
        Verantwortlich für die Bearbeitung von Personendaten auf {STORE.domain}{" "}
        ist Joris Neber,{" "}
        Neber Import, Unterwegli 1, 8404 Winterthur. Für Fragen zum
        Datenschutz erreichst du uns unter{" "}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>.
      </p>

      <h2>2. Welches Recht gilt</h2>
      <p>
        Wir richten unser Angebot auf die Schweiz aus und liefern nur an
        Schweizer Adressen. Massgebend ist deshalb das Schweizer
        Datenschutzgesetz (DSG) — nicht die EU-Datenschutz-Grundverordnung
        (DSGVO).
      </p>

      <h2>3. Welche Daten wir bearbeiten</h2>
      <h3>Bestelldaten</h3>
      <p>
        Bei einer Bestellung erheben wir Name, Liefer- und Rechnungsadresse,
        E-Mail-Adresse, gegebenenfalls Telefonnummer sowie die Angaben zur
        gewählten Zahlungsart. Diese Daten brauchen wir, um den Kaufvertrag zu
        erfüllen.
      </p>
      <h3>Kundenkonto</h3>
      {/* Ob ein Konto Pflicht ist, steuert lib/checkout/account-requirement.ts.
          Dieser Absatz MUSS dem Schalter folgen — «freiwillig» zu behaupten,
          während die Kasse ein Konto verlangt, wäre falsch. Die Seite rendert
          dynamisch; der Text stellt also zusammen mit der Kasse um. */}
      {requiresAccount() ? (
        <p>
          Für eine Bestellung brauchst du ein Kundenkonto. Wir speichern dann
          zusätzlich deine Zugangsdaten (das Passwort nur in verschlüsselter
          Form) und deine Bestellhistorie. Du kannst die Löschung deines Kontos
          jederzeit verlangen, soweit keine gesetzliche Aufbewahrungspflicht
          entgegensteht.
        </p>
      ) : (
        <p>
          Wenn du ein Konto eröffnest, speichern wir zusätzlich deine
          Zugangsdaten (das Passwort nur in verschlüsselter Form) und deine
          Bestellhistorie. Ein Konto ist freiwillig — bestellen kannst du auch
          ohne. Du kannst die Löschung deines Kontos jederzeit verlangen.
        </p>
      )}
      <h3>Technische Daten</h3>
      <p>
        Beim Besuch der Website werden technisch notwendige Daten verarbeitet:
        IP-Adresse, Datum und Uhrzeit des Zugriffs, aufgerufene Seiten, Browser-
        und Gerätetyp. Diese Daten dienen dem sicheren Betrieb der Website.
      </p>
      <h3>Warenkorb</h3>
      <p>
        Dein Warenkorb wird deinem Browser über ein technisch notwendiges Cookie
        zugeordnet, damit er beim nächsten Besuch noch da ist. Ausgewertet wird
        dabei nichts.
      </p>

      <h2>4. Zweck der Bearbeitung</h2>
      <ul>
        <li>Abwicklung von Bestellungen, Versand und Zahlung</li>
        <li>Kundenkommunikation und Support</li>
        <li>Erfüllung gesetzlicher Pflichten, etwa Aufbewahrungspflichten</li>
        <li>Betrieb, Sicherheit und Verbesserung der Website</li>
      </ul>
      <p>
        Wir verkaufen keine Personendaten und verschicken keine Werbung ohne
        deine Einwilligung.
      </p>

      <h2>5. Weitergabe an Dritte</h2>
      <p>
        Wir geben Personendaten nur weiter, soweit dies zur Vertragserfüllung
        nötig ist oder wir gesetzlich dazu verpflichtet sind. Empfänger sind
        insbesondere:
      </p>
      <ul>
        <li>
          <strong>Zahlungsdienstleister:</strong>{" "}
          zahls.ch, betrieben von der siebenberge gmbh — wickelt die Zahlung
          ab und erhält dafür Betrag, Bestellnummer und die für die gewählte
          Zahlungsart nötigen Angaben — für die Abwicklung der Zahlung.
        </li>
        <li>
          <strong>Logistikpartner:</strong>{" "}
          Die Schweizerische Post — für die
          Zustellung erhält er Name und Lieferadresse.
        </li>
        <li>
          <strong>Hosting und IT:</strong>{" "}
          Infomaniak Network SA, Genf — Shop und Warenwirtschaft laufen auf
                einem Server in der Schweiz{" "}
          — für den technischen Betrieb.
        </li>
        <li>
          <strong>Webanalyse:</strong> PostHog, Inc. (USA) — nur mit deiner
          Einwilligung; wir nutzen die EU-Cloud von PostHog, die Daten werden
          auf Servern in der Europäischen Union verarbeitet. Was dabei erfasst
          wird, steht in Ziffer 7.
        </li>
        <li>
          <strong>Google Kundenrezensionen:</strong> Google Ireland Limited
          (Dublin) bzw. Google LLC (USA) — nur mit deiner Einwilligung und nur
          auf der Bestellbestätigung: Google fragt dich, ob du den Shop nach
          der Lieferung bewerten möchtest. Was dabei übermittelt wird, steht
          in Ziffer 7.
        </li>
      </ul>

      <h2>6. Bekanntgabe ins Ausland</h2>
      <p>
        Personendaten geben wir nur dann ins Ausland bekannt, wenn der
        Zielstaat nach Einschätzung des Bundesrates einen angemessenen
        Datenschutz gewährleistet oder geeignete Garantien wie
        Standardvertragsklauseln bestehen (Art. 16 f. DSG). Hosting
        (Infomaniak, Genf) und Zahlungsabwicklung (zahls.ch, siebenberge gmbh,
        Schweiz) liegen beide in der Schweiz. Eine Bekanntgabe ins Ausland
        findet nur bei der Webanalyse und bei Google Kundenrezensionen statt
        — und nur, wenn du eingewilligt hast: Die Analyse-Daten werden von
        PostHog auf Servern in der Europäischen Union verarbeitet. Die
        EU-Mitgliedstaaten gewährleisten nach der Liste des Bundesrates einen
        angemessenen Datenschutz. Google Ireland Limited kann Daten an Google
        LLC in die USA weitergeben; die USA gelten für Unternehmen, die nach
        dem Swiss-U.S. Data Privacy Framework zertifiziert sind, als Staat mit
        angemessenem Datenschutz — Google LLC ist dort zertifiziert.
      </p>

      <h2>7. Cookies, Altersabfrage und Analyse</h2>
      <h3>Zwingend notwendige Cookies</h3>
      <p>
        Wir setzen technisch notwendige Speichermechanismen ein, damit der Shop
        funktioniert (z. B. Warenkorb, Anmeldung). Diese brauchen keine
        Einwilligung und lassen sich nicht abwählen.
      </p>
      <h3>Altersabfrage</h3>
      <p>
        Beim ersten Besuch fragen wir, ob du 18 oder älter bist, weil sich
        unser Angebot gemäss unseren AGB nur an Erwachsene richtet. Deine
        Antwort speichern wir in einem Cookie in deinem Browser — bei «ja» für
        zwölf Monate, bei «nein» nur bis zum Schliessen des Browsers.
        Gespeichert wird ausschliesslich die Antwort selbst; sie wird weder
        ausgewertet noch mit anderen Daten verknüpft.
      </p>
      <h3>Einwilligung für Analyse-Cookies</h3>
      <p>
        Analyse-Cookies setzen wir nur mit deiner Einwilligung. Beim ersten
        Besuch kannst du im Cookie-Hinweis zwischen «Alle akzeptieren» und
        «Nur notwendige» wählen — beides ist gleich einfach. Deine Wahl
        speichern wir in einem Cookie (mit Zeitpunkt der Entscheidung) für
        sechs Monate; danach fragen wir erneut. Triffst du keine Wahl, bleibt
        die Analyse aus.
      </p>
      <h3>Webanalyse mit PostHog</h3>
      <p>
        Mit deiner Einwilligung setzen wir PostHog ein, ein Analysewerkzeug
        von PostHog, Inc. (San Francisco, USA). Wir nutzen die EU-Cloud von
        PostHog: Die Daten werden auf Servern in der Europäischen Union
        verarbeitet. Ohne Einwilligung wird PostHog nicht geladen — auch das
        Skript selbst wird dann nicht abgerufen.
      </p>
      <p>
        Erfasst werden: aufgerufene Seiten, Verweildauer und Klickwege sowie
        Ereignisse aus dem Shop — Produkt angesehen, in den Warenkorb gelegt,
        Kasse begonnen und Bestellung abgeschlossen, beim Abschluss mit
        Bestellwert, Währung und Bestellnummer. Dazu kommt eine Aufzeichnung
        der Sitzung, also des Bildschirminhalts während deines Besuchs. Dabei
        sind sämtliche Eingabefelder maskiert: Was du in Formulare eintippst —
        etwa Adresse, E-Mail-Adresse oder Telefonnummer — wird nicht
        aufgezeichnet. Die Analyse-Ereignisse enthalten weder Name, E-Mail,
        Adresse noch Telefonnummer; deine IP-Adresse wird nicht am Ereignis
        gespeichert, aus ihr wird lediglich der ungefähre Standort (Land,
        Stadt) abgeleitet, bevor sie verworfen wird.
      </p>
      <h3>Google Kundenrezensionen</h3>
      <p>
        Mit derselben Einwilligung binden wir auf der Seite, die deine
        Bestellung bestätigt, das Opt-in-Modul von Google Kundenrezensionen
        ein (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4,
        Irland). Es fragt dich, ob du den Shop nach der Lieferung bewerten
        möchtest — das ist eine zweite, freiwillige Entscheidung. Damit Google
        dich einladen kann, übermittelt dein Browser beim Einblenden des
        Moduls deine E-Mail-Adresse, die Bestellnummer, das Lieferland, das
        voraussichtliche Lieferdatum und die Artikelnummern (GTIN) der
        bestellten Produkte an Google; Google setzt dabei eigene Cookies.
        Lehnst du im Modul ab, verwendet Google die Daten nicht für eine
        Umfrage. Stimmst du zu, schickt dir Google nach dem Liefertermin eine
        E-Mail mit der Bewertungsfrage; deine Bewertung erscheint anonym als
        Teil der Shopbewertung von jibbit bei Google. Ohne Cookie-Einwilligung
        wird das Modul nicht geladen und nichts an Google übermittelt. Mehr
        dazu in der Datenschutzerklärung von Google unter
        policies.google.com/privacy.
      </p>
      <h3>Widerruf</h3>
      <p>
        Deine Einwilligung kannst du jederzeit widerrufen oder nachträglich
        erteilen: Der Link «Cookie-Einstellungen» im Footer öffnet die Wahl
        erneut. Ein Widerruf wirkt sofort — die Erfassung durch PostHog stoppt,
        ohne dass du die Seite neu laden musst, und das Google-Modul wird
        nicht mehr eingebunden — und ist genauso einfach wie das Erteilen.
        Die Altersabfrage kannst du zurücksetzen, indem du die Cookies dieser
        Website in deinem Browser löschst.
      </p>

      <h2>8. Aufbewahrungsdauer</h2>
      <p>
        Wir bewahren Personendaten so lange auf, wie es für den jeweiligen
        Zweck nötig ist. Geschäfts- und Buchungsunterlagen — dazu gehören auch
        Bestellungen und Rechnungen — bewahren wir gemäss Art. 958f OR während
        zehn Jahren auf.
      </p>

      <h2>9. Datensicherheit</h2>
      <p>
        Wir treffen angemessene technische und organisatorische Massnahmen zum
        Schutz deiner Daten, insbesondere verschlüsselte Übertragung (TLS) und
        beschränkte Zugriffsrechte.
      </p>

      <h2>10. Deine Rechte</h2>
      <p>Nach dem DSG hast du insbesondere das Recht:</p>
      <ul>
        <li>
          Auskunft darüber zu verlangen, ob und welche Daten wir über dich
          bearbeiten (Art. 25 DSG)
        </li>
        <li>unrichtige Daten berichtigen zu lassen (Art. 32 DSG)</li>
        <li>die Löschung deiner Daten zu verlangen, soweit keine gesetzliche Aufbewahrungspflicht entgegensteht</li>
        <li>
          die Herausgabe der Daten, die du uns gegeben hast, in einem gängigen
          elektronischen Format zu verlangen (Art. 28 DSG)
        </li>
        <li>einer Bearbeitung zu widersprechen und eine erteilte Einwilligung jederzeit zu widerrufen</li>
      </ul>
      <p>
        Melde dich dafür unter{" "}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>. Die Auskunft ist in
        der Regel kostenlos. Zuständige Aufsichtsbehörde ist der Eidgenössische
        Datenschutz- und Öffentlichkeitsbeauftragte (EDÖB).
      </p>

      <h2>11. Änderungen</h2>
      <p>
        Wir können diese Datenschutzerklärung anpassen. Massgebend ist die
        jeweils auf dieser Seite veröffentlichte Fassung.
      </p>
    </Prose>
  );
}
