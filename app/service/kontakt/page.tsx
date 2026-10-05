import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/Prose";
import { BUSINESS, PICKUP } from "@/lib/config";
import { formatOpeningHours } from "@/lib/checkout/pickup";
import { SUPPORT } from "@/lib/content/kundenservice";
import { displayPhone } from "@/lib/format";

export const metadata: Metadata = {
  title: "Kontakt",
  // Eine Adresse je Seite, ohne Parameter (relativ zu `metadataBase`).
  alternates: { canonical: "/service/kontakt" },
  description:
    "So erreichst du jibbit — bei Fragen zur Bestellung, zum Sortiment oder zur Community.",
};

export default function KontaktPage() {
  const hours = formatOpeningHours(PICKUP.hours);
  return (
    <Prose
      title="Kontakt"
      intro={`Frage zur Bestellung, Produktwunsch, oder einfach eine Rückmeldung? Schreib uns — wir antworten ${SUPPORT.replyTime}.`}
    >
      {/* Laden: Name, Adresse, Telefon und Zeiten EXAKT wie im Google-
          Unternehmensprofil (NAP-Konsistenz) — die Werte kommen aus
          BUSINESS/PICKUP, nicht aus freiem Text. */}
      {PICKUP.enabled && (
        <>
          <h2>Unser Laden in Winterthur</h2>
          <address>
            {BUSINESS.legalName} — {BUSINESS.street}, {BUSINESS.postalCode} {BUSINESS.city}
            <br />
            Telefon{" "}
            <a href={`tel:${BUSINESS.telephone}`}>{displayPhone(BUSINESS.telephone)}</a>
            <br />
            Öffnungszeiten: {hours || "nach Vereinbarung"}
          </address>
          <p>
            Abholung von Onlinebestellungen möglich — wähle an der Kasse «
            {PICKUP.label}», Details unter{" "}
            <Link href="/service/versand#abholung">Versand &amp; Lieferung</Link>.
          </p>
        </>
      )}

      <h2>Schreib uns</h2>
      <dl>
        <div>
          <dt>E-Mail — für Fragen, Bestellungen und Reklamationen</dt>
          <dd>
            <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
          </dd>
        </div>
        <div>
          <dt>Telefon</dt>
          <dd>
            <a href={`tel:${BUSINESS.telephone}`}>
              {displayPhone(BUSINESS.telephone)}
            </a>
          </dd>
        </div>
        <div>
          <dt>Erreichbarkeit</dt>
          <dd>
            {SUPPORT.hours}. Auf E-Mails antworten wir {SUPPORT.replyTime}.
          </dd>
        </div>
      </dl>

      <h2>Was uns hilft</h2>
      <p>
        Gib bei Fragen zu einer Bestellung immer die Bestellnummer an — dann
        müssen wir nicht erst nachfragen und du hast schneller eine Antwort.
      </p>

      <h2>Produktwünsche</h2>
      <p>
        jibbit ist gemeinschaftsorientiert gedacht: was wir ins Sortiment nehmen,
        entscheidet sich stark danach, was nachgefragt wird. Fehlt dir eine
        Marke, ein Format oder eine Grösse? Sag Bescheid. Wenn genug Leute
        dasselbe wollen, bestellen wir es.
      </p>

      <h2>Vorher vielleicht schneller</h2>
      <p>
        Viele Fragen sind schon beantwortet:{" "}
        <Link href="/service/faq">Häufige Fragen</Link>,{" "}
        <Link href="/service/versand">Versand &amp; Lieferung</Link>,{" "}
        <Link href="/service/zahlungsarten">Zahlungsarten</Link> und{" "}
        <Link href="/service/rueckgabe">Rückgaberecht &amp; Reklamation</Link>.
      </p>
    </Prose>
  );
}
