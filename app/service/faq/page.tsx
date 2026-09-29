import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/Prose";
import { JsonLd } from "@/components/JsonLd";
import { SHIPPING, MIN_AGE, STORE } from "@/lib/config";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Häufige Fragen",
  // Eine Adresse je Seite, ohne Parameter (relativ zu `metadataBase`).
  alternates: { canonical: "/service/faq" },
  description:
    "Antworten zu Versand, Bezahlung, Mindestalter, Mengenrabatten und Rückgabe bei jibbit.",
};

const FAQS = [
  {
    q: "Was kostet der Versand?",
    a: `Jede Bestellung kostet ${formatPrice(SHIPPING.rate)} Versand, ab einem Bestellwert von ${formatPrice(SHIPPING.freeThreshold)} versenden wir gratis. Das Paketporto kostet uns ${formatPrice(SHIPPING.postage)}; die Hälfte davon übernehmen wir. Passt deine Bestellung in einen Brief, schicken wir sie als Brief und schreiben dir die Differenz als Gutscheincode für den Shop gut.`,
  },
  {
    q: "Wie kann ich bezahlen?",
    a: "Mit TWINT, Kreditkarte (Visa/Mastercard), PostFinance oder dem Wallet auf deinem Handy (Apple Pay, Google Pay). Die Zahlung läuft über den Schweizer Zahlungsdienstleister zahls.ch. Kauf auf Rechnung bieten wir derzeit nicht an.",
  },
  {
    q: "Ab welchem Alter kann ich bestellen?",
    a: `Ab ${MIN_AGE} Jahren. Mit der Bestellung bestätigst du, dass du dieses Alter erreicht hast.`,
  },
  {
    q: "Warum sind Boxen und Displays so viel günstiger?",
    a: "Weil wir den Mengenvorteil weitergeben statt ihn einzubehalten. Ein Display Smoking Brown kurz kostet bei uns weniger als die Hälfte dessen, was die 25 Hefte einzeln kosten würden. Wenn du regelmässig brauchst, lohnt sich das schnell.",
  },
  {
    q: "Ist die Verpackung neutral?",
    a: "Ja. Von aussen ist nicht ersichtlich, was im Paket ist.",
  },
  {
    q: "Wie lange dauert die Lieferung?",
    a: "Wir versenden ab Lager in der Schweiz — es gibt also keinen Zoll und keine Wartezeit an der Grenze. Die konkreten Fristen stehen unter Versand & Lieferung.",
  },
  {
    q: "Kann ich zurückgeben?",
    a: "Bei blossem Sinneswandel grundsätzlich nicht — in der Schweiz gibt es für Onlinebestellungen kein gesetzliches Widerrufsrecht, und wir gewähren auch kein freiwilliges. In besonderen Fällen kann der Inhaber ungeöffnete Ware aus Kulanz zurücknehmen, einen Anspruch darauf gibt es aber nicht. Ist etwas defekt, beschädigt angekommen oder falsch geliefert, nehmen wir es dagegen immer zurück, und der Rückversand geht auf uns.",
  },
  {
    q: "Ihr habt eine Marke nicht, die ich suche. Und jetzt?",
    a: `Schreib uns. ${STORE.name} ist gemeinschaftsorientiert gedacht: was ins Sortiment kommt, entscheidet sich stark danach, was nachgefragt wird. Wenn genug Leute dasselbe wollen, bestellen wir es.`,
  },
  {
    q: "Kann ich meine Bestellung noch ändern?",
    a: "Solange das Paket nicht raus ist, meistens ja. Melde dich möglichst schnell über die Kontaktseite mit deiner Bestellnummer.",
  },
];

export default function FaqPage() {
  // FAQPage schema so the answers can surface directly in Google.
  //
  // Gerendert über <JsonLd>, nicht über ein eigenes <script>: dort wird `<`
  // escaped. Die Antworten hier sind zwar redaktionell, aber der Ausgabeweg
  // soll shopweit derselbe sein — sonst ist genau die eine Stelle, die
  // später dynamischen Text bekommt, die ungeschützte.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <Prose
        title="Häufige Fragen"
        intro="Das Meiste ist hier schon beantwortet. Wenn nicht, schreib uns einfach."
      >
        {FAQS.map((f) => (
          <section key={f.q}>
            <h2>{f.q}</h2>
            <p>{f.a}</p>
          </section>
        ))}

        <section>
          <h2>Noch eine Frage offen?</h2>
          <p>
            Schreib uns über <Link href="/service/kontakt">Kontakt</Link>. Mehr
            Details gibt es unter{" "}
            <Link href="/service/versand">Versand &amp; Lieferung</Link>,{" "}
            <Link href="/service/zahlungsarten">Zahlungsarten</Link> und{" "}
            <Link href="/service/rueckgabe">Rückgaberecht &amp; Reklamation</Link>.
          </p>
        </section>
      </Prose>
    </>
  );
}
