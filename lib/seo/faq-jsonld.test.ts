import { describe, expect, it } from "vitest";
import { faqJsonLd } from "./faq-jsonld";

describe("faqJsonLd", () => {
  it("baut FAQPage mit Question/Answer", () => {
    expect(
      faqJsonLd([
        { q: "Frage 1?", a: "Antwort 1." },
        { q: "Frage 2?", a: "Antwort 2." },
      ]),
    ).toEqual({
      "@type": "FAQPage",
      mainEntity: [
        { "@type": "Question", name: "Frage 1?", acceptedAnswer: { "@type": "Answer", text: "Antwort 1." } },
        { "@type": "Question", name: "Frage 2?", acceptedAnswer: { "@type": "Answer", text: "Antwort 2." } },
      ],
    });
  });

  it("zeichnet nichts aus, wenn es keine Fragen gibt", () => {
    expect(faqJsonLd([])).toBeUndefined();
  });
});
