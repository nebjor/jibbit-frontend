import type { Metadata } from "next";
import Link from "next/link";
import { Prose, Platzhalter } from "@/components/Prose";

export const metadata: Metadata = {
  title: "Rückgabe & Umtausch",
  description:
    "So gibst du bei jibbit zurück oder tauschst um — Ablauf, Fristen und was ausgeschlossen ist.",
};

export default function RueckgabePage() {
  return (
    <Prose
      title="Rückgabe & Umtausch"
      intro="Falsch bestellt oder doch nicht das Richtige? Hier steht, wie du zurückgibst. Die rechtliche Grundlage dazu findest du unter Widerrufsrecht."
    >
      <h2>In Kürze</h2>
      <ul>
        <li>
          Rückgabe innerhalb von{" "}
          <Platzhalter>Anzahl Tage</Platzhalter> Tagen nach Erhalt
        </li>
        <li>Ware ungeöffnet, unbenutzt, in der Originalverpackung</li>
        <li>Vorher kurz melden — nicht einfach zurückschicken</li>
        <li>Defekte oder falsch gelieferte Ware: immer auf unsere Kosten</li>
      </ul>

      <h2>So gehst du vor</h2>
      <ol>
        <li>
          <strong>Melden.</strong> Schreib uns über{" "}
          <Link href="/service/kontakt">Kontakt</Link> mit deiner Bestellnummer
          und dem Grund der Rückgabe.
        </li>
        <li>
          <strong>Bestätigung abwarten.</strong> Wir melden uns mit der
          Rücksendeadresse und allem Weiteren.
        </li>
        <li>
          <strong>Verpacken und senden.</strong> Am besten in der
          Originalverpackung, gut gepolstert. Leg einen Zettel mit der
          Bestellnummer bei.
        </li>
        <li>
          <strong>Erstattung.</strong> Sobald die Ware bei uns ist und geprüft
          wurde, erstatten wir den Betrag über deine ursprüngliche Zahlungsart.
        </li>
      </ol>

      <h2>Was wir nicht zurücknehmen können</h2>
      <p>
        Aus hygienischen Gründen und wegen der Art der Produkte sind ausgeschlossen:
      </p>
      <ul>
        <li>geöffnete oder angebrauchte Papers und Filter</li>
        <li>
          angebrochene Displays und Boxen, aus denen bereits Einheiten entnommen
          wurden
        </li>
        <li>Gutscheine</li>
        <li>Artikel, die eigens für dich bestellt wurden</li>
      </ul>
      <p>
        Das gilt nicht für Mängel: ist etwas kaputt oder falsch geliefert, nehmen
        wir es selbstverständlich zurück.
      </p>

      <h2>Umtausch</h2>
      <p>
        Einen direkten Umtausch bieten wir nicht an — das dauert in der Praxis
        länger als der einfache Weg. Gib den Artikel zurück und bestell den
        richtigen neu; sobald die Retoure da ist, erstatten wir dir den ersten
        Betrag.
      </p>

      <h2>Defekte oder falsche Lieferung</h2>
      <p>
        Falls wir uns vertan haben oder ein Artikel beschädigt ankommt: melde
        dich mit einem Foto. Wir schicken Ersatz oder erstatten den Betrag, und
        die Rückversandkosten gehen in dem Fall auf uns.
      </p>

      <h2>Kosten des Rückversands</h2>
      <p>
        Bei einer Rückgabe ohne Mangel trägt die Rückversandkosten{" "}
        <Platzhalter>Betreiber festlegen: Kundin/Kunde oder wir</Platzhalter>.
      </p>

      <h2>Rechtliches</h2>
      <p>
        Details zu Fristen und zur rechtlichen Einordnung stehen unter{" "}
        <Link href="/widerrufsrecht">Widerrufsrecht</Link> und in unseren{" "}
        <Link href="/agb">AGB</Link>.
      </p>
    </Prose>
  );
}
