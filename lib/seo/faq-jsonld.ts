/**
 * FAQPage-Schema für Kategorieseiten — bewusst eigenes Modul neben
 * lib/seo/jsonld.ts, damit Produkt-JSON-LD und FAQ-Schema unabhängig
 * gepflegt werden.
 *
 * Der Knoten kommt zusammen mit Brotkrümeln und ItemList in EINEN `@graph`
 * (`graph()` aus lib/seo/jsonld.ts). Die Fragen und Antworten müssen auf der
 * Seite SICHTBAR stehen und wortgleich sein — Google verlangt das, und die
 * Seite rendert dieselbe Liste (`CategoryFaqList`).
 */

export interface FaqEntry {
  q: string;
  a: string;
}

/** `FAQPage` oder `undefined`, wenn es nichts zu fragen gibt. */
export function faqJsonLd(faqs: readonly FaqEntry[]): Record<string, unknown> | undefined {
  if (faqs.length === 0) return undefined;
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
