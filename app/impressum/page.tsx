import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { STORE, BUSINESS } from "@/lib/config";
import { robotsMetadata } from "@/lib/seo/indexing";

/**
 * Funktion statt `metadata`-Konstante: ein `robots` auf Seitenebene ersetzt
 * das des Layouts, und das feste `index: true` hätte die Noindex-Sperre eines
 * Staging-Deployments für genau diese Seite wieder aufgehoben. Der Schalter
 * wird zur Laufzeit gelesen — lib/seo/indexing.ts.
 */
export function generateMetadata(): Metadata {
  return {
    title: "Impressum",
    // Eine Adresse je Seite, ohne Parameter (relativ zu `metadataBase`).
    alternates: { canonical: "/impressum" },
    description: `Impressum und Anbieterkennzeichnung von ${STORE.domain}.`,
    robots: robotsMetadata({ index: true, follow: false }),
  };
}

export default function ImpressumPage() {
  return (
    <Prose
      title="Impressum"
      intro={`Angaben zum Betreiber von ${STORE.domain} gemäss Art. 3 Abs. 1 lit. s UWG (Anbieterkennzeichnung im elektronischen Geschäftsverkehr).`}
      updated="21. September 2026"
    >
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
            <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
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
