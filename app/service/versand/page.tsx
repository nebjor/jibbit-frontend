import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/Prose";
import { PICKUP, SHIPPING } from "@/lib/config";
import { formatOpeningHours, pickupAddressLines } from "@/lib/checkout/pickup";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Versand & Lieferung",
  // Eine Adresse je Seite, ohne Parameter (relativ zu `metadataBase`).
  alternates: { canonical: "/service/versand" },
  description: `Versandkosten, Lieferfristen und Versandgebiet. Gratisversand ab ${formatPrice(SHIPPING.freeThreshold)} — oder gratis abholen im Laden in Winterthur.`,
};

export default function VersandPage() {
  const hours = formatOpeningHours(PICKUP.hours);
  return (
    <Prose
      title="Versand & Lieferung"
      intro={`Ein Preis für jede Bestellung: ${formatPrice(SHIPPING.rate)} — ab ${formatPrice(SHIPPING.freeThreshold)} Bestellwert versenden wir gratis. Oder du holst deine Bestellung gratis bei uns im Laden in Winterthur ab. Keine versteckten Zuschläge an der Kasse.`}
      updated="5. Oktober 2026"
    >
      <h2>Versandkosten</h2>
      <ul>
        <li>
          Jede Bestellung: <strong>{formatPrice(SHIPPING.rate)}</strong>
        </li>
        <li>
          Bestellwert ab {formatPrice(SHIPPING.freeThreshold)}:{" "}
          <strong>gratis</strong>
        </li>
      </ul>
      <p>
        Das Paketporto kostet uns {formatPrice(SHIPPING.postage)} — die Hälfte
        davon übernehmen wir. Der Preis gilt pro Bestellung, unabhängig von
        Anzahl und Gewicht der Artikel. Im Warenkorb siehst du jederzeit, wie
        viel dir noch bis zum Gratisversand fehlt.
      </p>

      {PICKUP.enabled && (
        <>
          <h2 id="abholung">Abholung im Laden</h2>
          <p>
            Du kannst deine Bestellung auch <strong>gratis</strong> bei uns im
            Laden abholen. Wähle an der Kasse «{PICKUP.label}» — dann brauchen
            wir nur Name, E-Mail und Telefonnummer, keine Lieferadresse.
          </p>
          <ul>
            <li>
              Adresse: {pickupAddressLines().slice(1).join(", ")}
            </li>
            <li>
              Abholzeiten:{" "}
              {hours ? (
                <strong>{hours}</strong>
              ) : (
                <>nach Vereinbarung — wir melden uns, sobald die Bestellung bereit ist</>
              )}
            </li>
            <li>Bezahlt wird wie beim Versand online, an der Kasse im Shop.</li>
          </ul>
          <p>
            {PICKUP.note} Bitte warte diese Mail ab, bevor du vorbeikommst — so
            ist alles bereit, wenn du da bist. Nimm die Bestellbestätigung mit,
            auf dem Handy reicht.
          </p>
        </>
      )}

      <h2>Passt es in einen Brief? Dann bekommst du Geld zurück</h2>
      <p>
        Ob deine Bestellung als Brief oder als Paket reist, sehen wir erst beim
        Packen. Passt sie in einen Brief, schicken wir sie als Brief und
        schreiben dir die Differenz gut: Du bekommst per E-Mail einen
        Gutscheincode, den du bei deiner nächsten Bestellung im Shop einlösen
        kannst.
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
        Wir versenden mit der Schweizerischen Post. Die Sendungen sind neutral verpackt — von aussen ist nicht
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
