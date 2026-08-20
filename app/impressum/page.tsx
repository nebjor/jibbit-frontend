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
      intro={`Angaben zum Betreiber von ${STORE.domain} gemäss Art. 3 Abs. 1 lit. s UWG (Anbieterkennzeichnung im elektronischen Geschäftsverkehr).`}
      updated="Entwurf vom 21. August 2026 — offene Angaben sind markiert"
    >
      <p>
        <strong>
          Hinweis für den Betreiber: alle markierten Felder vor dem Livegang
          durch die echten Angaben ersetzen. Es wurden bewusst keine Daten
          erfunden — eine erkennbare Lücke ist besser als eine falsche Adresse.
        </strong>
      </p>

      <h2>Verantwortlich für diese Website</h2>
      <dl>
        <div>
          <dt>Betreiber</dt>
          <dd>
            Joris Neber
            <br />
            Neber Import
              <br />
              Einzelunternehmen
          </dd>
        </div>
        <div>
          <dt>Adresse</dt>
          <dd>
            Unterwegli 1
            <br />
            8404 Winterthur
            <br />
            Schweiz
          </dd>
        </div>
        <div>
          <dt>E-Mail</dt>
          <dd>
            <a href="mailto:joris@jibbit.ch">joris@jibbit.ch</a>
          </dd>
        </div>
        <div>
          <dt>Telefon</dt>
          <dd>
            <a href="tel:+41764140890">076 414 08 90</a>
          </dd>
        </div>
        <div>
          <dt>Mehrwertsteuer</dt>
          <dd>
            Nicht mehrwertsteuerpflichtig. Auf den Preisen wird keine
              Mehrwertsteuer erhoben und keine ausgewiesen.
          </dd>
        </div>
      </dl>

      <h2>Sortiment — bewusst ohne Tabak und Nikotin</h2>
      <p>
        {STORE.domain} verkauft Raucherzubehör: Zigarettenpapier, Filter und
        Tips, Grinder, Aschenbecher, Hülsen und Aufbewahrung. Wir führen bewusst
        keinen Tabak, keine nikotinhaltigen Produkte und keine Produkte mit CBD
        oder THC.
      </p>

      <h2>Abgabe nur an Erwachsene</h2>
      <p>
        Unsere Artikel geben wir nur an Personen ab 18 Jahren ab. Mit einer
        Bestellung bestätigst du, dieses Alter erreicht zu haben.
      </p>

      <h2>Haftungsausschluss</h2>
      <p>
        Die Inhalte dieser Website werden mit Sorgfalt erstellt. Für Richtigkeit,
        Vollständigkeit und Aktualität der Angaben — insbesondere zu
        Produkteigenschaften, Verfügbarkeiten und Preisen — wird keine Gewähr
        übernommen. Der Betreiber haftet nicht für Schäden, die aus dem Zugriff
        auf oder der Nutzung dieser Website entstehen, soweit gesetzlich
        zulässig.
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
        bedarf der vorherigen schriftlichen Zustimmung des Betreibers. Marken-
        und Produktnamen der geführten Hersteller (u. a. RAW, Elements, PURIZE,
        OCB, Smoking, Greengo, Zig Zag) sind Eigentum der jeweiligen
        Rechteinhaber.
      </p>
    </Prose>
  );
}
