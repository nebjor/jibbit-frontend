import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/Prose";
import { BUSINESS, RETURNS } from "@/lib/config";

/**
 * Ziel von `merchantReturnLink` (lib/seo/jsonld.ts); Google Merchant Center
 * prüft sie als Rückgaberichtlinie. Muss zu AGB Ziffer 9/10 und
 * `MerchantReturnNotPermitted` passen: keine Rückgabe bei Sinneswandel,
 * Kulanz ohne Anspruch, keine Erstattungsfrist.
 */

export const metadata: Metadata = {
  title: "Rückgaberecht & Reklamation",
  description:
    "Rückgaberegel von jibbit: keine Rückgabe bei Sinneswandel, defekte oder falsch gelieferte Ware nehmen wir auf unsere Kosten zurück. Ablauf, Ausnahmen und Rücksendeadresse.",
};

export default function RueckgabePage() {
  const { warrantyYears } = RETURNS;
  const mail = BUSINESS.email;

  return (
    <Prose
      title="Rückgaberecht & Reklamation"
      intro="Ist etwas defekt, beschädigt oder falsch geliefert, machen wir es auf unsere Kosten wieder gut. Eine Rückgabe, weil du es dir anders überlegt hast, ist dagegen grundsätzlich nicht möglich."
      updated="21. September 2026"
    >
      <h2>Auf einen Blick</h2>
      <dl>
        <div>
          <dt>Rückgabe bei Sinneswandel</dt>
          <dd>
            Grundsätzlich nicht möglich — keine Rückgabefrist, kein
            Umtauschrecht. In besonderen Fällen kann der Inhaber eine Rückgabe
            aus Kulanz annehmen; einen Anspruch darauf gibt es nicht.
          </dd>
        </div>
        <div>
          <dt>Defekte, beschädigte oder falsch gelieferte Ware</dt>
          <dd>
            Ersatz oder Erstattung, gesetzliche Gewährleistung {warrantyYears}{" "}
            Jahre ab Lieferung
          </dd>
        </div>
        <div>
          <dt>Kosten der Rücksendung</dt>
          <dd>
            Bei berechtigter Reklamation übernehmen wir sie vollständig. Bei
            einer Kulanzrückgabe trägst du sie selbst.
          </dd>
        </div>
        <div>
          <dt>Erstattung</dt>
          <dd>Über deine ursprüngliche Zahlungsart</dd>
        </div>
        <div>
          <dt>Ausgeschlossen</dt>
          <dd>
            Geöffnete, angebrochene oder benutzte Artikel — ausser bei einem
            Mangel
          </dd>
        </div>
        <div>
          <dt>So startest du</dt>
          <dd>
            E-Mail an <a href={`mailto:${mail}`}>{mail}</a> mit Bestellnummer
            und Foto — bitte nichts ohne Absprache zurückschicken
          </dd>
        </div>
        <div>
          <dt>Gilt für</dt>
          <dd>Bestellungen mit Lieferadresse in der Schweiz</dd>
        </div>
      </dl>

      <h2>Kein Widerrufsrecht bei Onlinebestellungen</h2>
      <p>
        Das schweizerische Recht kennt für Bestellungen im Onlinehandel kein
        gesetzliches Widerrufsrecht — anders als in der EU. Ein Rückgaberecht
        könnte es also nur als freiwillige Leistung des Shops geben. Wir
        gewähren keines, und wir sagen das lieber deutlich, als es im
        Kleingedruckten zu verstecken.
      </p>
      <p>
        Der Grund ist die Art der Ware: Jeder Artikel ist im Shop mit Bild,
        Marke, Format und Stückzahl genau beschrieben. Du siehst vor der
        Bestellung, was du bekommst, und nichts davon muss anprobiert oder
        ausprobiert werden. Ein Rücknahmeapparat würde die Preise erhöhen, ohne
        jemandem zu nützen — und günstige Preise sind der Grund, warum du hier
        bestellst. Bitte prüfe deshalb Artikel und Menge im Warenkorb, bevor du
        die Bestellung absendest.
      </p>

      <h2>Kulanz im Einzelfall</h2>
      <p>
        Hast du dich vertan und ist die Ware noch ungeöffnet, frag trotzdem
        nach. In besonderen Fällen kann der Inhaber eine Rückgabe freiwillig
        annehmen. Das ist ein Entgegenkommen im Einzelfall, kein Anspruch, und
        es setzt voraus, dass wir vorher zugestimmt haben.
      </p>
      <p>
        Nimmt er sie an, muss die Ware ungeöffnet, unbenutzt und in der
        versiegelten beziehungsweise unbeschädigten Originalverpackung
        zurückkommen. Den Rückversand trägst du in diesem Fall selbst. Wir
        erstatten den Kaufpreis, sobald die Ware bei uns eingetroffen und
        geprüft ist.
      </p>

      <h2>Wann wir Ware zurücknehmen</h2>
      <p>
        Unabhängig davon gilt die gesetzliche Sachgewährleistung nach
        Schweizer Obligationenrecht (Art. 197 ff. OR), {warrantyYears} Jahre ab
        Ablieferung der Ware. Wir nehmen zurück oder ersetzen, wenn
      </p>
      <ul>
        <li>ein Artikel defekt ist oder einen Mangel hat,</li>
        <li>die Sendung beim Transport beschädigt wurde,</li>
        <li>
          du einen anderen Artikel oder eine andere Menge erhalten hast, als du
          bestellt hast, oder
        </li>
        <li>etwas in der Sendung fehlt.</li>
      </ul>

      <h2>Zustand der Ware</h2>
      <p>
        Behalte den betroffenen Artikel im Zustand, in dem du ihn erhalten
        hast, und verwende ihn nicht weiter. Bei einem Transportschaden hebe
        bitte auch die Verpackung auf, bis der Fall geklärt ist — sie ist
        oft der beste Beleg.
      </p>
      <p>
        Bei einer Falschlieferung schicke den falschen Artikel ungeöffnet und
        vollständig zurück. Öffnest du ihn, können wir ihn nicht mehr
        verkaufen.
      </p>

      <h2>Ausnahmen</h2>
      <p>
        Papers, Filter und Tips sind Verbrauchsartikel. Geöffnete,
        angebrochene oder benutzte Artikel nehmen wir aus hygienischen Gründen
        nicht zurück — auch nicht aus Kulanz. Das ist bei Schweizer
        Raucherbedarf-Shops üblich. Ausgenommen ist nur ein Mangel am Artikel
        selbst: Dann gilt die Gewährleistung wie oben beschrieben.
      </p>

      <h2>So läuft eine Reklamation ab</h2>
      <ol>
        <li>
          <strong>Melden.</strong> Schreib an{" "}
          <a href={`mailto:${mail}`}>{mail}</a> oder über{" "}
          <Link href="/service/kontakt">Kontakt</Link> — mit Bestellnummer,
          betroffenem Artikel und einem Foto des Problems. Melde einen Mangel
          möglichst rasch nach der Entdeckung.
        </li>
        <li>
          <strong>Antwort abwarten.</strong> Wir prüfen den Fall und sagen dir,
          wie es weitergeht. Oft brauchen wir die Ware gar nicht zurück; das
          Foto genügt.
        </li>
        <li>
          <strong>Zurückschicken, falls nötig.</strong> Brauchen wir die Ware,
          schickst du sie nach unserer Bestätigung an die Rücksendeadresse
          unten. Die Kosten dafür übernehmen wir — wie, sprechen wir mit dir
          ab. Sende bitte nichts unfrei und nichts ohne vorherige Absprache,
          solche Pakete können wir nicht annehmen.
        </li>
        <li>
          <strong>Ersatz oder Erstattung.</strong> Du erhältst gleichwertigen
          Ersatz oder den Kaufpreis zurück.
        </li>
      </ol>

      <h2>Rücksendeadresse</h2>
      <p>Nur nach vorheriger Absprache:</p>
      <address>
        {BUSINESS.legalName}
        <br />
        {BUSINESS.street}
        <br />
        {BUSINESS.postalCode} {BUSINESS.city}
        <br />
        Schweiz
      </address>

      <h2>Erstattung</h2>
      <p>
        Wir erstatten immer über den Weg, den du beim Bezahlen genutzt hast —
        TWINT, Kreditkarte oder PostFinance, abgewickelt über unseren
        Zahlungsdienstleister zahls.ch. Bis der Betrag auf deinem Konto
        erscheint, kann es je nach Bank oder Kartenherausgeber einige Tage
        dauern.
      </p>

      <h2>Falsch bestellt?</h2>
      <p>
        Melde dich so rasch wie möglich. Solange die Bestellung das Lager noch
        nicht verlassen hat, können wir sie in der Regel noch ändern oder
        stornieren. Ist sie bereits unterwegs, bleibt nur die Anfrage auf
        Kulanz (siehe oben).
      </p>

      <h2>Rechtliches</h2>
      <p>
        Die vertragliche Grundlage steht in Ziffer 9 und 10 unserer{" "}
        <Link href="/agb">AGB</Link>. Mehr zur Rechtslage unter{" "}
        <Link href="/widerrufsrecht">Widerrufsrecht</Link>.
      </p>
    </Prose>
  );
}
