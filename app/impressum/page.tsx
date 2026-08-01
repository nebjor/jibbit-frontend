import type { Metadata } from "next";
import { Prose, Platzhalter } from "@/components/Prose";
import { STORE } from "@/lib/config";

export const metadata: Metadata = {
  title: "Impressum",
  description: `Impressum und Anbieterkennzeichnung von ${STORE.domain}.`,
  robots: { index: true, follow: false },
};

export default function ImpressumPage() {
  return (
    <Prose
      title="Impressum"
      intro={`Angaben zum Betreiber von ${STORE.domain} gemäss Art. 3 Abs. 1 lit. s UWG.`}
    >
      <p>
        <strong>
          Hinweis für den Betreiber: alle rot markierten Felder müssen vor dem
          Livegang durch die echten Firmenangaben ersetzt werden. Es wurden
          bewusst keine Daten erfunden.
        </strong>
      </p>

      <h2>Verantwortlich für diese Website</h2>
      <dl>
        <div>
          <dt>Firma / Betreiber</dt>
          <dd>
            <Platzhalter>Firmenname bzw. Name des Inhabers</Platzhalter>
          </dd>
        </div>
        <div>
          <dt>Adresse</dt>
          <dd>
            <Platzhalter>Strasse und Nummer</Platzhalter>
            <br />
            <Platzhalter>PLZ und Ort</Platzhalter>
            <br />
            Schweiz
          </dd>
        </div>
        <div>
          <dt>E-Mail</dt>
          <dd>
            <Platzhalter>Kontakt-E-Mail-Adresse</Platzhalter>
          </dd>
        </div>
        <div>
          <dt>Telefon</dt>
          <dd>
            <Platzhalter>Telefonnummer (optional)</Platzhalter>
          </dd>
        </div>
        <div>
          <dt>Handelsregister / UID</dt>
          <dd>
            <Platzhalter>UID-Nummer, z.B. CHE-123.456.789</Platzhalter>
          </dd>
        </div>
        <div>
          <dt>Mehrwertsteuernummer</dt>
          <dd>
            <Platzhalter>MWST-Nummer, falls MWST-pflichtig</Platzhalter>
          </dd>
        </div>
      </dl>

      <h2>Haftungsausschluss</h2>
      <p>
        Die Inhalte dieser Website werden mit Sorgfalt erstellt. Für Richtigkeit,
        Vollständigkeit und Aktualität der Angaben – insbesondere zu
        Produkteigenschaften, Verfügbarkeiten und Preisen – wird keine Gewähr
        übernommen. Der Betreiber haftet nicht für Schäden, die aus dem Zugriff
        auf oder der Nutzung dieser Website entstehen.
      </p>

      <h2>Externe Links</h2>
      <p>
        Diese Website kann Links auf Websites Dritter enthalten. Für deren
        Inhalte ist ausschliesslich der jeweilige Anbieter verantwortlich. Eine
        laufende Kontrolle dieser Inhalte findet nicht statt.
      </p>

      <h2>Urheberrecht</h2>
      <p>
        Texte, Bilder und Gestaltung dieser Website sind urheberrechtlich
        geschützt. Eine Verwendung ausserhalb der Grenzen des Urheberrechts
        bedarf der vorherigen schriftlichen Zustimmung des Betreibers.
        Marken- und Produktnamen der geführten Hersteller (u.a. RAW, Elements,
        PURIZE, OCB, Smoking, Greengo, Zig Zag) sind Eigentum der jeweiligen
        Rechteinhaber.
      </p>

      <h2>Altersbeschränkung</h2>
      <p>
        Die in diesem Shop angebotenen Artikel richten sich ausschliesslich an
        Personen ab 18 Jahren. Mit einer Bestellung bestätigst du, dieses Alter
        erreicht zu haben.
      </p>
    </Prose>
  );
}
