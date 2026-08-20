import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/Prose";
import { STORE } from "@/lib/config";

export const metadata: Metadata = {
  title: "Widerrufsrecht",
  description: `Freiwilliges vertragliches Rückgaberecht bei ${STORE.domain} — 14 Tage, ohne Angabe von Gründen.`,
};

export default function WiderrufsrechtPage() {
  return (
    <Prose
      title="Widerrufsrecht"
      intro="Kurz gesagt: Ein gesetzliches Widerrufsrecht für Online-Bestellungen gibt es in der Schweiz nicht. Wir gewähren dir trotzdem eines — freiwillig und vertraglich, 14 Tage lang."
      updated="Entwurf vom 21. August 2026 — vor Livegang juristisch prüfen lassen"
    >
      <h2>1. Die Rechtslage in der Schweiz</h2>
      <p>
        Anders als in der EU kennt das schweizerische Recht kein allgemeines
        gesetzliches Widerrufsrecht für Bestellungen im Onlinehandel. Das
        Widerrufsrecht des Obligationenrechts (Art. 40a ff. OR) gilt nur für
        Haustürgeschäfte und ähnliche Situationen wie Verträge am Telefon —
        nicht für den Kauf in einem Onlineshop. Ein Kaufvertrag ist hier
        grundsätzlich verbindlich, sobald er zustande gekommen ist.
      </p>
      <p>
        Wir finden das kundenunfreundlich. Darum gewähren wir dir freiwillig
        ein vertragliches Rückgaberecht. Es ist eine Zusage von uns, keine
        gesetzliche Pflicht — und es gilt im Umfang, wie er auf dieser Seite
        beschrieben ist.
      </p>

      <h2>2. Unser freiwilliges Rückgaberecht</h2>
      <p>
        Du kannst deine Bestellung innerhalb von <strong>14 Tagen</strong> nach
        Erhalt der Ware ohne Angabe von Gründen zurückgeben. Massgebend ist das
        Datum, an dem du oder eine von dir bezeichnete Person die Ware in
        Empfang genommen hat.
      </p>

      <h2>3. So gibst du zurück</h2>
      <ol>
        <li>
          Melde dich vor dem Rückversand über unsere{" "}
          <Link href="/service/kontakt">Kontaktseite</Link> oder per E-Mail an{" "}
          <a href="mailto:demo@example.com">demo@example.com</a> — mit deiner
          Bestellnummer.
        </li>
        <li>
          Wir bestätigen dir die Rücksendung und nennen dir die
          Rücksendeadresse.
        </li>
        <li>
          Schicke die Ware innerhalb von 14 Tagen nach unserer Bestätigung
          zurück.
        </li>
      </ol>
      <p>
        Die Kosten des Rückversands trägst du, ausser die Rückgabe geht auf
        einen Fehler von uns zurück (siehe Ziffer 6). Unfrei gesendete Pakete
        können wir nicht annehmen.
      </p>

      <h2>4. Zustand der Ware</h2>
      <p>
        Zurückgegebene Artikel müssen ungeöffnet, unbenutzt und in der
        Originalverpackung sein. Aus hygienischen Gründen und wegen der Art der
        Produkte können wir geöffnete Papers, Filter und angebrauchte Artikel
        nicht zurücknehmen.
      </p>
      <p>Ausgenommen von der Rückgabe sind zudem:</p>
      <ul>
        <li>Gutscheine</li>
        <li>Artikel, die eigens für dich bestellt oder angefertigt wurden</li>
        <li>
          bereits geöffnete Displays und Boxen, bei denen einzelne Einheiten
          entnommen wurden
        </li>
      </ul>

      <h2>5. Rückerstattung</h2>
      <p>
        Sobald die Ware bei uns eingetroffen und geprüft ist, erstatten wir dir
        den Kaufpreis innerhalb von 14 Tagen. Die Rückerstattung erfolgt über
        dieselbe Zahlungsart, die du für die Bestellung genutzt hast. Gibst du
        die ganze Bestellung zurück, erstatten wir auch die bezahlten
        Versandkosten; bei einer Teilrückgabe erstatten wir den Warenwert der
        zurückgegebenen Artikel.
      </p>

      <h2>6. Mängel und Falschlieferungen</h2>
      <p>
        Ist ein Artikel defekt oder falsch geliefert, greift unabhängig von
        diesem freiwilligen Rückgaberecht die gesetzliche Gewährleistung
        (Art. 197 ff. OR). Melde dich in dem Fall einfach bei uns — wir
        ersetzen die Ware oder erstatten den Betrag, und die Rückversandkosten
        gehen auf uns.
      </p>

      <h2>7. Weitere Informationen</h2>
      <p>
        Praktische Hinweise zum Ablauf findest du unter{" "}
        <Link href="/service/rueckgabe">Rückgabe &amp; Umtausch</Link>. Die
        vertragliche Grundlage steht in unseren <Link href="/agb">AGB</Link>.
      </p>
    </Prose>
  );
}
