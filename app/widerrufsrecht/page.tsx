import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/Prose";
import { STORE } from "@/lib/config";

export const metadata: Metadata = {
  title: "Widerrufsrecht",
  description: `Widerrufs- und Rückgaberecht bei ${STORE.domain}: In der Schweiz besteht für Onlinebestellungen kein gesetzliches Widerrufsrecht.`,
};

export default function WiderrufsrechtPage() {
  return (
    <Prose
      title="Widerrufsrecht"
      intro="Kurz gesagt: Ein gesetzliches Widerrufsrecht für Online-Bestellungen gibt es in der Schweiz nicht, und wir gewähren auch kein freiwilliges — Kulanz im Einzelfall bleibt möglich. Bei Mängeln und Falschlieferungen stehen wir dagegen vollumfänglich gerade."
      updated="21. September 2026"
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

      <h2>2. Kein freiwilliges Rückgaberecht</h2>
      <p>
        Manche Schweizer Shops gewähren darüber hinaus ein vertragliches
        Rückgaberecht. Wir tun das nicht, und wir sagen das lieber deutlich,
        als es im Kleingedruckten zu verstecken.
      </p>
      <p>
        Der Grund liegt in der Art der Ware. Jeder Artikel ist im Shop mit
        Bild, Marke, Format und Stückzahl genau beschrieben. Du siehst vor der
        Bestellung, was du bekommst, und nichts davon muss anprobiert oder
        ausprobiert werden. Eine Rücknahmeorganisation kostet Geld, das am Ende
        auf die Preise geschlagen wird — und günstige Preise sind der Grund,
        warum du hier bestellst.
      </p>
      <p>
        In besonderen Fällen kann der Inhaber eine Rückgabe ungeöffneter,
        unbenutzter Ware in der Originalverpackung aus Kulanz annehmen. Das
        ist ein freiwilliges Entgegenkommen im Einzelfall, ohne Anspruch und
        nur nach vorheriger Zustimmung; den Rückversand trägst du dann selbst.
        Geöffnete oder benutzte Verbrauchsartikel sind davon ausgeschlossen.
      </p>
      <p>
        Bitte prüfe deine Bestellung deshalb vor dem Absenden. Im Warenkorb
        siehst du Artikel, Menge und Gesamtpreis, und bis zum letzten Schritt
        kannst du alles ändern.
      </p>

      <h2>3. Mängel, Transportschäden und Falschlieferungen</h2>
      <p>
        Davon unberührt bleibt die gesetzliche Sachgewährleistung nach Schweizer
        Obligationenrecht (Art. 197 ff. OR). Sie beträgt zwei Jahre ab
        Ablieferung der Ware (Art. 210 OR), und wir schränken sie nicht ein.
      </p>
      <p>
        Ist ein Artikel defekt, beschädigt angekommen oder falsch geliefert,
        melde dich über unsere{" "}
        <Link href="/service/kontakt">Kontaktseite</Link> — mit Bestellnummer,
        betroffenem Artikel und nach Möglichkeit einem Foto. Wir ersetzen die
        Ware oder erstatten den Betrag, und die Rückversandkosten gehen in
        diesen Fällen auf uns.
      </p>
      <p>
        Melde einen Mangel möglichst rasch nach der Entdeckung. Sende bitte
        nichts unfrei und nichts ohne vorherige Absprache zurück — solche Pakete
        können wir nicht annehmen.
      </p>

      <h2>4. Stornieren vor dem Versand</h2>
      <p>
        Hat deine Bestellung das Lager noch nicht verlassen, können wir sie in
        der Regel noch ändern oder stornieren. Melde dich einfach so rasch wie
        möglich.
      </p>

      <h2>5. Weitere Informationen</h2>
      <p>
        Den praktischen Ablauf einer Reklamation findest du unter{" "}
        <Link href="/service/rueckgabe">Rückgaberecht &amp; Reklamation</Link>. Die
        vertragliche Grundlage steht in Ziffer 9 und 10 unserer{" "}
        <Link href="/agb">AGB</Link>.
      </p>
    </Prose>
  );
}
