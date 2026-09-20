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
      intro={`Kleinsendungen ${formatPrice(SHIPPING.letterRate)}, Pakete ${formatPrice(SHIPPING.parcelRate)} — ab ${formatPrice(SHIPPING.freeThreshold)} Bestellwert versenden wir gratis. Keine versteckten Zuschläge an der Kasse.`}
      updated="Entwurf vom 21. August 2026"
    >
      <h2>Versandkosten</h2>
      <ul>
        <li>
          Kleinsendung im Briefformat:{" "}
          <strong>{formatPrice(SHIPPING.letterRate)}</strong>
        </li>
        <li>
          Paket, zum Beispiel eine ganze Box oder ein Display:{" "}
          <strong>{formatPrice(SHIPPING.parcelRate)}</strong>
        </li>
        <li>
          Bestellwert ab {formatPrice(SHIPPING.freeThreshold)}:{" "}
          <strong>gratis</strong>
        </li>
      </ul>
      <p>
        Die Pauschale gilt pro Bestellung, unabhängig von Anzahl und Gewicht
        der Artikel. Im Warenkorb siehst du jederzeit, wie viel dir noch bis
        zum Gratisversand fehlt.
      </p>

      <h2>Versandgebiet</h2>
      <p>
        Wir liefern derzeit an Adressen in der Schweiz. Versendet wird ab
        unserem Lager in der Schweiz — es fallen also keine Zollgebühren und
        keine Wartezeiten an der Grenze an.
      </p>

      <h2>Lieferfrist</h2>
      <p>
        Wir versenden in der Regel innerhalb von 1–3 Werktagen nach
        Bestelleingang. Danach ist die Sendung mit A-Post 1–2 Werktage
        unterwegs, mit B-Post 2–3 — was es wird, hängt auch davon ab, zu
        welcher Tageszeit du bestellst.
      </p>
      <p>
        Angegebene Fristen sind Richtwerte. In Spitzenzeiten oder bei
        Verzögerungen beim Transport kann es länger dauern — wir melden uns,
        wenn etwas Grösseres dazwischenkommt.
      </p>

      <h2>Versandart</h2>
      <p>
        Wir versenden mit{" "}
        Die Schweizerische Post
        . Die Sendungen sind neutral verpackt — von aussen ist nicht
        ersichtlich, was drin ist.
      </p>

      <h2>Sendungsverfolgung</h2>
      <p>
        Sofern die gewählte Versandart eine Sendungsverfolgung bietet,
        erhältst du die Sendungsnummer per E-Mail, sobald dein Paket unterwegs
        ist.
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
