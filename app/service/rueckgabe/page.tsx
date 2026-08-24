import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/Prose";

export const metadata: Metadata = {
  title: "Rückgabe & Reklamation",
  description:
    "Defekte oder falsch gelieferte Ware nehmen wir zurück — auf unsere Kosten. Ein Rückgaberecht bei Sinneswandel gibt es nicht.",
};

export default function RueckgabePage() {
  return (
    <Prose
      title="Rückgabe & Reklamation"
      intro="Ist etwas kaputt oder haben wir uns vertan, machen wir es auf unsere Kosten wieder gut. Eine Rückgabe, weil du es dir anders überlegt hast, ist dagegen nicht möglich."
      updated="Stand: 22. August 2026"
    >
      <h2>In Kürze</h2>
      <ul>
        <li>Defekte oder falsch gelieferte Ware: immer auf unsere Kosten</li>
        <li>Kein Rückgaberecht bei Sinneswandel</li>
        <li>Vorher kurz melden — nicht einfach zurückschicken</li>
        <li>Gesetzliche Gewährleistung: zwei Jahre ab Lieferung</li>
      </ul>

      <h2>Warum es kein Rückgaberecht auf Vorrat gibt</h2>
      <p>
        Das schweizerische Recht kennt für Onlinebestellungen kein gesetzliches
        Widerrufsrecht — anders als in der EU. Wir gewähren auch freiwillig
        keines.
      </p>
      <p>
        Der Grund ist die Art der Ware: Jeder Artikel ist im Shop mit Bild,
        Marke, Format und Stückzahl genau beschrieben. Du siehst vor der
        Bestellung, was du bekommst, und nichts davon muss anprobiert oder
        ausprobiert werden. Ein Rücknahmeapparat würde die Preise erhöhen, ohne
        jemandem zu nützen — und günstige Preise sind der Grund, warum du hier
        bestellst.
      </p>

      <h2>Defekte, Transportschäden und Falschlieferungen</h2>
      <p>
        Hier gilt die gesetzliche Sachgewährleistung nach Schweizer
        Obligationenrecht, zwei Jahre ab Lieferung. Melde dich mit einem Foto,
        deiner Bestellnummer und den betroffenen Artikeln über{" "}
        <Link href="/service/kontakt">Kontakt</Link>.
      </p>
      <p>
        Wir schicken Ersatz oder erstatten den Betrag. Die Rückversandkosten
        gehen in diesen Fällen auf uns — sende bitte nichts unfrei und nichts
        ohne vorherige Absprache, sonst können wir das Paket nicht annehmen.
      </p>
      <p>
        Bitte melde einen Mangel möglichst rasch nach der Entdeckung. Je früher
        wir davon wissen, desto einfacher lässt sich klären, was passiert ist.
      </p>

      <h2>So läuft eine Reklamation ab</h2>
      <ol>
        <li>
          <strong>Melden.</strong> Schreib uns über{" "}
          <Link href="/service/kontakt">Kontakt</Link> mit Bestellnummer, Artikel
          und einem Foto des Problems.
        </li>
        <li>
          <strong>Bestätigung abwarten.</strong> Wir melden uns mit der
          Rücksendeadresse und allem Weiteren. Oft brauchen wir die Ware gar
          nicht zurück.
        </li>
        <li>
          <strong>Ersatz oder Erstattung.</strong> Sobald der Fall klar ist,
          schicken wir Ersatz oder erstatten den Betrag über deine ursprüngliche
          Zahlungsart.
        </li>
      </ol>

      <h2>Falsch bestellt?</h2>
      <p>
        Melde dich trotzdem. Solange die Bestellung das Lager noch nicht
        verlassen hat, können wir sie in der Regel noch ändern oder stornieren.
        Ist sie bereits unterwegs, geht das nicht mehr.
      </p>

      <h2>Rechtliches</h2>
      <p>
        Die vertragliche Grundlage steht in Ziffer 9 und 10 unserer{" "}
        <Link href="/agb">AGB</Link>.
      </p>
    </Prose>
  );
}
