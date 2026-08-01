import type { Metadata } from "next";
import { Prose, Platzhalter } from "@/components/Prose";
import { STORE } from "@/lib/config";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: `Wie ${STORE.domain} Personendaten bearbeitet — nach revidiertem Schweizer Datenschutzgesetz (revDSG).`,
};

export default function DatenschutzPage() {
  return (
    <Prose
      title="Datenschutzerklärung"
      intro="Diese Erklärung beschreibt, welche Personendaten wir bearbeiten, zu welchem Zweck, und welche Rechte du hast. Sie richtet sich nach dem revidierten Schweizer Datenschutzgesetz (revDSG)."
      updated="Entwurf – vor Livegang juristisch prüfen lassen"
    >
      <p>
        <strong>
          Hinweis für den Betreiber: Vorlage, keine Rechtsberatung. Die Liste der
          eingesetzten Dienste muss mit dem tatsächlichen Stand übereinstimmen –
          insbesondere Hosting, Analytics und Zahlungsabwicklung.
        </strong>
      </p>

      <h2>1. Verantwortliche Stelle</h2>
      <p>
        Verantwortlich für die Bearbeitung von Personendaten auf {STORE.domain}{" "}
        ist <Platzhalter>Firmenname und Adresse</Platzhalter>. Für Fragen zum
        Datenschutz erreichst du uns unter{" "}
        <Platzhalter>Datenschutz-E-Mail-Adresse</Platzhalter>.
      </p>

      <h2>2. Welche Daten wir bearbeiten</h2>
      <h3>Bestelldaten</h3>
      <p>
        Bei einer Bestellung erheben wir Name, Liefer- und Rechnungsadresse,
        E-Mail-Adresse, gegebenenfalls Telefonnummer sowie die Angaben zur
        gewählten Zahlungsart. Diese Daten brauchen wir, um den Kaufvertrag zu
        erfüllen.
      </p>
      <h3>Technische Daten</h3>
      <p>
        Beim Besuch der Website werden technisch notwendige Daten verarbeitet:
        IP-Adresse, Datum und Uhrzeit des Zugriffs, aufgerufene Seiten, Browser-
        und Gerätetyp. Diese Daten dienen dem sicheren Betrieb der Website.
      </p>
      <h3>Warenkorb</h3>
      <p>
        Dein Warenkorb wird lokal in deinem Browser gespeichert
        (Local Storage). Diese Daten verlassen dein Gerät nicht, bis du eine
        Bestellung auslöst, und du kannst sie jederzeit über die
        Browsereinstellungen löschen.
      </p>

      <h2>3. Zweck der Bearbeitung</h2>
      <ul>
        <li>Abwicklung von Bestellungen, Versand und Zahlung</li>
        <li>Kundenkommunikation und Support</li>
        <li>Erfüllung gesetzlicher Aufbewahrungspflichten</li>
        <li>Betrieb, Sicherheit und Verbesserung der Website</li>
      </ul>

      <h2>4. Weitergabe an Dritte</h2>
      <p>
        Wir geben Personendaten nur weiter, soweit dies zur Vertragserfüllung
        nötig ist oder wir gesetzlich dazu verpflichtet sind. Empfänger sind
        insbesondere:
      </p>
      <ul>
        <li>
          <strong>Zahlungsdienstleister:</strong> Payrexx (TWINT, Powerpay) – für
          die Abwicklung der Zahlung. Bei Kauf auf Rechnung kann eine
          Bonitätsprüfung durch den Rechnungsanbieter erfolgen.
        </li>
        <li>
          <strong>Logistikpartner:</strong>{" "}
          <Platzhalter>Versanddienstleister, z.B. Die Post</Platzhalter> – für
          die Zustellung.
        </li>
        <li>
          <strong>Hosting und IT:</strong>{" "}
          <Platzhalter>Hosting-Anbieter</Platzhalter> – für den Betrieb von Shop
          und Backend.
        </li>
      </ul>
      <p>
        Eine Bekanntgabe ins Ausland erfolgt nur an Staaten mit angemessenem
        Datenschutzniveau oder unter geeigneten vertraglichen Garantien.
      </p>

      <h2>5. Cookies und Analyse</h2>
      <p>
        Wir setzen technisch notwendige Speichermechanismen ein, damit der Shop
        funktioniert (z.B. Warenkorb, Sitzung). Für Analyse- oder Marketing-Tools
        holen wir – sofern eingesetzt – vorgängig deine Einwilligung ein.
      </p>
      <p>
        <Platzhalter>
          Falls Analytics (z.B. PostHog, Plausible) oder Marketing-Pixel
          eingesetzt werden: hier konkret auflisten und Consent-Banner ergänzen
        </Platzhalter>
      </p>

      <h2>6. Aufbewahrungsdauer</h2>
      <p>
        Wir bewahren Personendaten so lange auf, wie es für den jeweiligen Zweck
        nötig ist. Geschäfts- und Buchungsunterlagen bewahren wir gemäss Art. 958f
        OR während zehn Jahren auf.
      </p>

      <h2>7. Datensicherheit</h2>
      <p>
        Wir treffen angemessene technische und organisatorische Massnahmen zum
        Schutz deiner Daten, insbesondere verschlüsselte Übertragung (TLS) und
        beschränkte Zugriffsrechte.
      </p>

      <h2>8. Deine Rechte</h2>
      <p>Nach revDSG hast du das Recht:</p>
      <ul>
        <li>Auskunft über die zu deiner Person bearbeiteten Daten zu verlangen</li>
        <li>unrichtige Daten berichtigen zu lassen</li>
        <li>die Löschung von Daten zu verlangen</li>
        <li>der Bearbeitung zu widersprechen</li>
        <li>deine Daten in einem gängigen Format herauszuverlangen</li>
        <li>eine erteilte Einwilligung jederzeit zu widerrufen</li>
      </ul>
      <p>
        Melde dich dafür unter{" "}
        <Platzhalter>Datenschutz-E-Mail-Adresse</Platzhalter>. Du kannst dich
        zudem beim Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten
        (EDÖB) beschweren.
      </p>

      <h2>9. Änderungen</h2>
      <p>
        Wir können diese Datenschutzerklärung anpassen. Massgebend ist die jeweils
        auf dieser Seite veröffentlichte Fassung.
      </p>
    </Prose>
  );
}
