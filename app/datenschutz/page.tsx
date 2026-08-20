import type { Metadata } from "next";
import { Prose, Platzhalter } from "@/components/Prose";
import { STORE } from "@/lib/config";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: `Wie ${STORE.domain} Personendaten bearbeitet — nach dem Schweizer Datenschutzgesetz (DSG).`,
};

export default function DatenschutzPage() {
  return (
    <Prose
      title="Datenschutzerklärung"
      intro="Diese Erklärung beschreibt, welche Personendaten wir bearbeiten, zu welchem Zweck, und welche Rechte du hast. Sie richtet sich nach dem Schweizer Datenschutzgesetz (DSG, in Kraft seit 1. September 2023)."
      updated="Entwurf vom 21. August 2026 — vor Livegang juristisch prüfen lassen"
    >
      <p>
        <strong>
          Hinweis für den Betreiber: Vorlage, keine Rechtsberatung. Die Liste
          der eingesetzten Dienste muss vor dem Livegang mit dem tatsächlichen
          Stand übereinstimmen — insbesondere Hosting, Analyse und
          Zahlungsabwicklung.
        </strong>
      </p>

      <h2>1. Verantwortliche Stelle</h2>
      <p>
        Verantwortlich für die Bearbeitung von Personendaten auf {STORE.domain}{" "}
        ist Joris Neber,{" "}
        <Platzhalter>Postanschrift eintragen</Platzhalter>. Für Fragen zum
        Datenschutz erreichst du uns unter{" "}
        <a href="mailto:demo@example.com">demo@example.com</a>.
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
      <p>
        Wenn du ein Konto eröffnest, speichern wir zusätzlich deine
        Zugangsdaten (das Passwort nur in verschlüsselter Form) und deine
        Bestellhistorie. Ein Konto ist freiwillig — bestellen kannst du auch
        ohne. Du kannst die Löschung deines Kontos jederzeit verlangen.
      </p>
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
          <Platzhalter>
            Zahlungsdienstleister eintragen, sobald der Anbieter feststeht —
            vorgesehen sind TWINT und Kauf auf Rechnung
          </Platzhalter>{" "}
          — für die Abwicklung der Zahlung. Bei Kauf auf Rechnung kann der
          Rechnungsanbieter eine Bonitätsprüfung durchführen.
        </li>
        <li>
          <strong>Logistikpartner:</strong>{" "}
          <Platzhalter>Versanddienstleister eintragen</Platzhalter> — für die
          Zustellung erhält er Name und Lieferadresse.
        </li>
        <li>
          <strong>Hosting und IT:</strong>{" "}
          <Platzhalter>
            Hosting-Anbieter von Shop und Backend eintragen, mit Serverstandort
          </Platzhalter>{" "}
          — für den technischen Betrieb.
        </li>
      </ul>

      <h2>6. Bekanntgabe ins Ausland</h2>
      <p>
        Personendaten geben wir nur dann ins Ausland bekannt, wenn der
        Zielstaat nach Einschätzung des Bundesrates einen angemessenen
        Datenschutz gewährleistet oder geeignete Garantien wie
        Standardvertragsklauseln bestehen (Art. 16 f. DSG).{" "}
        <Platzhalter>
          Nach Festlegung von Hosting und Diensten konkretisieren: welche Daten
          in welche Länder gehen
        </Platzhalter>
      </p>

      <h2>7. Cookies und Analyse</h2>
      <p>
        Wir setzen technisch notwendige Speichermechanismen ein, damit der Shop
        funktioniert (z. B. Warenkorb, Anmeldung). Diese brauchen keine
        Einwilligung.
      </p>
      <p>
        <Platzhalter>
          Falls Analyse- oder Marketing-Dienste eingesetzt werden (z. B.
          PostHog, Plausible, Meta-Pixel): hier konkret auflisten, sonst diesen
          Absatz durch &laquo;Weitere Cookies oder Trackingdienste setzen wir
          nicht ein.&raquo; ersetzen
        </Platzhalter>
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
        <a href="mailto:demo@example.com">demo@example.com</a>. Die Auskunft ist in
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
