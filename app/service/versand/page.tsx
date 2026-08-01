import type { Metadata } from "next";
import Link from "next/link";
import { Prose, Platzhalter } from "@/components/Prose";
import { SHIPPING } from "@/lib/config";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Versand & Lieferung",
  description: `Versandkosten, Lieferfristen und Versandgebiet. Gratisversand ab ${formatPrice(SHIPPING.freeThreshold)}.`,
};

export default function VersandPage() {
  return (
    <Prose
      title="Versand & Lieferung"
      intro={`Pauschal ${formatPrice(SHIPPING.flatRate)} innerhalb der Schweiz — ab ${formatPrice(SHIPPING.freeThreshold)} Bestellwert versenden wir gratis. Keine versteckten Zuschläge an der Kasse.`}
    >
      <h2>Versandkosten</h2>
      <ul>
        <li>
          Schweiz, Bestellwert unter {formatPrice(SHIPPING.freeThreshold)}:{" "}
          <strong>{formatPrice(SHIPPING.flatRate)}</strong> pauschal
        </li>
        <li>
          Schweiz, Bestellwert ab {formatPrice(SHIPPING.freeThreshold)}:{" "}
          <strong>gratis</strong>
        </li>
      </ul>
      <p>
        Die Pauschale gilt pro Bestellung, unabhängig von Anzahl und Gewicht der
        Artikel. Im Warenkorb siehst du jederzeit, wie viel dir noch bis zum
        Gratisversand fehlt.
      </p>

      <h2>Versandgebiet</h2>
      <p>
        Wir versenden innerhalb der Schweiz und aus der Schweiz — es fallen also
        keine Zollgebühren und keine Wartezeiten an der Grenze an.
      </p>
      <p>
        <Platzhalter>
          Betreiber festlegen: Liefern wir nach Liechtenstein? Ins Ausland?
        </Platzhalter>
      </p>

      <h2>Lieferfrist</h2>
      <p>
        Bestellungen, die an einem Werktag bis{" "}
        <Platzhalter>Bestellschluss, z.B. 14:00 Uhr</Platzhalter> eingehen,
        verpacken wir in der Regel am selben Tag. Danach dauert die Zustellung
        üblicherweise{" "}
        <Platzhalter>Anzahl Werktage</Platzhalter> Werktage.
      </p>
      <p>
        Angegebene Fristen sind Richtwerte. In Spitzenzeiten oder bei
        Verzögerungen bei der Post kann es länger dauern — wir melden uns, wenn
        etwas Grösseres dazwischenkommt.
      </p>

      <h2>Versandart</h2>
      <p>
        Wir versenden mit{" "}
        <Platzhalter>Versanddienstleister und Produkt, z.B. Post A/B</Platzhalter>
        . Die Sendungen sind neutral verpackt — von aussen ist nicht ersichtlich,
        was drin ist.
      </p>

      <h2>Sendungsverfolgung</h2>
      <p>
        Sobald dein Paket unterwegs ist, bekommst du eine E-Mail mit der
        Sendungsnummer.{" "}
        <Platzhalter>
          Betreiber bestätigen: wird Tracking angeboten?
        </Platzhalter>
      </p>

      <h2>Etwas stimmt nicht?</h2>
      <p>
        Paket beschädigt, unvollständig oder gar nicht angekommen? Melde dich
        über <Link href="/service/kontakt">Kontakt</Link> mit deiner
        Bestellnummer — wir klären das.
      </p>
    </Prose>
  );
}
