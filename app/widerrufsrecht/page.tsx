import type { Metadata } from "next";
import Link from "next/link";
import { Prose, Platzhalter } from "@/components/Prose";
import { STORE } from "@/lib/config";

export const metadata: Metadata = {
  title: "Widerrufsrecht",
  description: `Freiwilliges vertragliches Rückgabe- und Widerrufsrecht bei ${STORE.domain}.`,
};

export default function WiderrufsrechtPage() {
  return (
    <Prose
      title="Widerrufsrecht"
      intro="Kurz gesagt: gesetzlich müssten wir in der Schweiz gar keins gewähren. Wir tun es trotzdem — freiwillig und vertraglich."
      updated="Entwurf – Konditionen durch den Betreiber festzulegen"
    >
      <p>
        <strong>
          Hinweis für den Betreiber: Anders als in der EU gibt es im
          schweizerischen Recht für Online-Bestellungen kein gesetzliches
          Widerrufsrecht. Die untenstehenden Fristen und Bedingungen sind eine
          freiwillige Leistung und müssen von dir festgelegt werden.
        </strong>
      </p>

      <h2>1. Warum diese Seite anders klingt als in Deutschland</h2>
      <p>
        In der EU haben Konsumentinnen und Konsumenten bei Fernabsatzverträgen
        ein gesetzliches Widerrufsrecht von 14 Tagen. Das schweizerische
        Obligationenrecht kennt eine solche Regelung für Online-Bestellungen
        nicht. Ein Kaufvertrag ist hier grundsätzlich verbindlich, sobald er
        zustande gekommen ist.
      </p>
      <p>
        Wir finden das kundenunfreundlich. Darum gewähren wir dir freiwillig ein
        vertragliches Rückgaberecht, das inhaltlich einem Widerrufsrecht
        entspricht.
      </p>

      <h2>2. Unser freiwilliges Rückgaberecht</h2>
      <p>
        Du kannst deine Bestellung innerhalb von{" "}
        <Platzhalter>Anzahl Tage, z.B. 14</Platzhalter> Tagen nach Erhalt der Ware
        ohne Angabe von Gründen zurückgeben. Massgebend ist das Datum, an dem du
        oder eine von dir bezeichnete Person die Ware in Empfang genommen hat.
      </p>

      <h2>3. Wie du zurückgibst</h2>
      <ol>
        <li>
          Melde dich vor dem Rückversand bei uns unter{" "}
          <Platzhalter>Retouren-E-Mail-Adresse</Platzhalter> mit deiner
          Bestellnummer.
        </li>
        <li>Wir bestätigen dir die Rücksendung und nennen dir die Adresse.</li>
        <li>
          Schicke die Ware innerhalb von{" "}
          <Platzhalter>Frist für den Rückversand</Platzhalter> Tagen ab
          Rückmeldung zurück.
        </li>
      </ol>
      <p>
        Die Kosten des Rückversands trägt{" "}
        <Platzhalter>
          Betreiber festlegen: Kundin/Kunde oder wir
        </Platzhalter>
        . Unfrei gesendete Pakete können wir nicht annehmen.
      </p>

      <h2>4. Zustand der Ware</h2>
      <p>
        Zurückgegebene Artikel müssen ungeöffnet, unbenutzt und in der
        Originalverpackung sein. Aus hygienischen Gründen und wegen der Natur der
        Produkte können wir geöffnete Papers, Filter und angebrauchte Artikel
        nicht zurücknehmen.
      </p>
      <p>
        Ausgenommen von der Rückgabe sind zudem:
      </p>
      <ul>
        <li>Gutscheine und digitale Produkte</li>
        <li>Artikel, die eigens für dich bestellt oder angefertigt wurden</li>
        <li>
          bereits geöffnete Displays und Boxen, bei denen einzelne Einheiten
          entnommen wurden
        </li>
      </ul>

      <h2>5. Rückerstattung</h2>
      <p>
        Sobald die Ware bei uns eingetroffen und geprüft ist, erstatten wir dir
        den Kaufpreis innerhalb von{" "}
        <Platzhalter>Anzahl Tage für die Erstattung</Platzhalter> Tagen. Die
        Rückerstattung erfolgt über denselben Weg, den du für die Zahlung genutzt
        hast (TWINT bzw. Powerpay über Payrexx). Bereits bezahlte Versandkosten
        erstatten wir{" "}
        <Platzhalter>Betreiber festlegen: ja / nein</Platzhalter>.
      </p>

      <h2>6. Mängel</h2>
      <p>
        Ist ein Artikel defekt oder falsch geliefert, greift unabhängig von
        diesem freiwilligen Rückgaberecht die gesetzliche Gewährleistung. Melde
        dich in dem Fall einfach bei uns — wir ersetzen die Ware oder erstatten
        den Betrag, und die Rückversandkosten gehen auf uns.
      </p>

      <h2>7. Weitere Informationen</h2>
      <p>
        Praktische Hinweise zum Ablauf findest du unter{" "}
        <Link href="/service/rueckgabe">Rückgabe &amp; Umtausch</Link>. Die
        vertragliche Grundlage steht in unseren{" "}
        <Link href="/agb">AGB</Link>.
      </p>
    </Prose>
  );
}
