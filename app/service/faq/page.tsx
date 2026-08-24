import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/Prose";
import { SHIPPING, MIN_AGE, STORE } from "@/lib/config";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Häufige Fragen",
  description:
    "Antworten zu Versand, Bezahlung, Mindestalter, Mengenrabatten und Rückgabe bei jibbit.",
};

const FAQS = [
  {
    q: "Was kostet der Versand?",
    a: `Kleinsendungen im Briefformat kosten ${formatPrice(SHIPPING.letterRate)}, Pakete ${formatPrice(SHIPPING.parcelRate)} — zum Beispiel eine ganze Box Papers. Ab einem Bestellwert von ${formatPrice(SHIPPING.freeThreshold)} versenden wir gratis. Im Warenkorb siehst du laufend, wie viel dir noch bis zum Gratisversand fehlt.`,
  },
  {
    q: "Wie kann ich bezahlen?",
    a: "Mit TWINT, Kreditkarte (Visa/Mastercard) oder PostFinance. Die Zahlung läuft über den Schweizer Zahlungsdienstleister zahls.ch. Kauf auf Rechnung bieten wir derzeit nicht an.",
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
    a: "Bei blossem Sinneswandel nicht — in der Schweiz gibt es für Onlinebestellungen kein gesetzliches Widerrufsrecht, und wir gewähren auch kein freiwilliges. Ist etwas defekt, beschädigt angekommen oder falsch geliefert, nehmen wir es dagegen immer zurück, und der Rückversand geht auf uns.",
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
            <Link href="/service/rueckgabe">Rückgabe &amp; Umtausch</Link>.
          </p>
        </section>
      </Prose>
    </>
  );
}
