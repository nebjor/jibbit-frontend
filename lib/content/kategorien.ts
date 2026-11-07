/**
 * SEO-TEXTE JE KATEGORIE — Titel, Meta-Beschreibung, H1, Kurztext über dem
 * Raster, längerer Ratgebertext und FAQ unter dem Raster.
 *
 * QUELLEN, in dieser Reihenfolge:
 *   1. Medusa-Admin: `metadata` der Produktkategorie (Schlüssel unten). Wer
 *      dort etwas einträgt, überschreibt den jeweiligen Baustein, ohne dass
 *      jemand den Code anfasst.
 *   2. Standardtexte in diesem Modul, je Handle (`DEFAULTS`).
 *   3. Allgemeiner Rückfall für jede andere Kategorie (neue Kategorien im
 *      Admin müssen ohne Code-Änderung eine brauchbare Seite ergeben).
 *
 * METADATA-SCHLÜSSEL (alle optional, Text):
 *   seo_title        Titel ohne Shopnamen («Papers kaufen Schweiz»)
 *   seo_description  Meta-Beschreibung, höchstens ca. 155 Zeichen
 *   seo_h1           Überschrift der Seite
 *   seo_intro        Kurztext über dem Produktraster
 *   seo_text         Ratgebertext unter dem Raster. Absätze durch eine
 *                    Leerzeile, Zwischenüberschriften als «## Überschrift»
 *   seo_faq          JSON: [{"q":"Frage?","a":"Antwort."}, …] (3–5 Einträge)
 *
 * TEXTREGELN (Betreiber-Vorgabe): keine Gesundheitsversprechen, keine
 * Drogenbezüge, keine Superlative ohne Beleg (UWG Art. 3 Abs. 1 lit. e).
 * Schweizer Schreibweise, «ss» statt «ß». Versandwerte kommen aus der
 * Shop-Konfiguration, nicht aus dem Text.
 */

import { MIN_AGE, SHIPPING } from "@/lib/config";
import type { CategoryView } from "@/lib/types";

export interface CategoryFaq {
  q: string;
  a: string;
}

export interface CategorySection {
  heading?: string;
  paragraphs: string[];
}

export interface CategoryContent {
  /** Titel OHNE Shopnamen (das Layout hängt « | <Shop>» an). */
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  sections: CategorySection[];
  faqs: CategoryFaq[];
  /** Linktext für Verweise auf diese Kategorie («Papers kaufen»). */
  anchor: string;
}

type Defaults = Partial<CategoryContent>;

/** «CHF 69» bzw. «CHF 4.50» — ganze Beträge ohne Rappen, normales Leerzeichen. */
function franken(amount: number): string {
  return `CHF ${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

/* ─── Bausteine, die in jeder FAQ vorkommen dürfen ─────────────────── */

function shippingFaq(): CategoryFaq {
  return {
    q: "Ab wann ist der Versand gratis?",
    a: `Der Versand kostet ${franken(SHIPPING.rate)}, ab einem Bestellwert von ${franken(SHIPPING.freeThreshold)} liefern wir gratis. Wir versenden ab Lager in der Schweiz, es fällt also kein Zoll an. Die Details stehen unter Versand & Lieferung.`,
  };
}

function paymentFaq(): CategoryFaq {
  return {
    q: "Wie kann ich bezahlen?",
    a: "Du bezahlst mit TWINT, Kreditkarte oder PostFinance. Alle Zahlarten findest du unter Zahlungsarten.",
  };
}

function ageFaq(): CategoryFaq {
  return {
    q: "Ab welchem Alter kann ich bestellen?",
    a: `Wir geben unsere Artikel nur an Personen ab ${MIN_AGE} Jahren ab.`,
  };
}

/* ─── Standardtexte je Kategorie-Handle ────────────────────────────── */

function defaults(): Record<string, Defaults> {
  const frei = franken(SHIPPING.freeThreshold);
  return {
    papers: {
      title: "Papers kaufen Schweiz: Rolls, King Size & Slim",
      metaDescription: `Papers kaufen in der Schweiz: King Size Slim, Rolls und kurze Blättchen von RAW, Elements und mehr. Versand ab Lager, gratis ab ${frei}.`,
      h1: "Papers kaufen in der Schweiz",
      anchor: "Papers kaufen",
      intro:
        "Papers in allen gängigen Formaten: kurz, King Size Slim oder als Rolle für lange Runden. Du findest bekannte Marken wie RAW und Elements, einzeln oder im Display zum besseren Stückpreis. Versand ab Lager in der Schweiz.",
      sections: [
        {
          heading: "Welches Papers-Format passt zu dir?",
          paragraphs: [
            "King Size Slim ist ein beliebtes Format: lang genug für eine volle Zigarette und schmal geschnitten, sodass wenig Papier im Spiel ist. Kurze Papers (1¼) sind handlich und passen in jede Hosentasche. Rolls sind Endlosrollen, bei denen du die Länge selbst bestimmst. Das lohnt sich für alle, die viel und in verschiedenen Grössen drehen.",
          ],
        },
        {
          heading: "Material und Dicke",
          paragraphs: [
            "Papers unterscheiden sich in Material und Dicke. Es gibt weisse und ungebleichte (braune) Blättchen, dünnes Reispapier und etwas kräftigere Zellulosepapiere. Dünne Papers fühlen sich leichter an, dickere lassen sich für viele einfacher drehen. Welche Variante dir liegt, ist Geschmackssache; probier am besten zwei, drei Sorten aus. Ein Display ist dafür eine günstige Möglichkeit.",
          ],
        },
        {
          heading: "Papers bei jibbit bestellen",
          paragraphs: [
            `Alle Papers sind ab Lager lieferbar und werden aus der Schweiz verschickt. Ab ${frei} Bestellwert ist der Versand gratis. Passend zu den Papers findest du bei uns Filter Tips und Aschenbecher.`,
          ],
        },
      ],
      faqs: [
        {
          q: "Welches Papers-Format ist das richtige für mich?",
          a: "Für eine normale Zigarette ist King Size Slim das gängigste Format. Wer es kompakter mag, nimmt kurze Papers. Rolls eignen sich, wenn du die Länge selbst bestimmen möchtest.",
        },
        {
          q: "Was ist der Unterschied zwischen King Size Slim und Rolls?",
          a: "King Size Slim sind einzelne, fertig geschnittene Blättchen im Heftchen. Rolls sind eine Endlosrolle, von der du dir die gewünschte Länge abreisst. Rolls sind praktisch, wenn du oft grosse Mengen drehst.",
        },
        {
          q: "Welche Marken bekomme ich bei jibbit?",
          a: "Unser Sortiment umfasst unter anderem RAW und Elements. Die aktuelle Auswahl siehst du oben im Produktraster; neue Artikel nehmen wir laufend auf.",
        },
        shippingFaq(),
        ageFaq(),
      ],
    },

    "filter-tips": {
      title: "Filter Tips kaufen: Aktivkohle- & Slim-Filter",
      metaDescription: `Filter Tips kaufen in der Schweiz: Aktivkohlefilter, Slim Filter und Tips von PURIZE, dubi, Angel und mehr. Vorratspacks, gratis Versand ab ${frei}.`,
      h1: "Filter Tips kaufen in der Schweiz",
      anchor: "Filter Tips kaufen",
      intro:
        "Aktivkohlefilter, Slim Filter und Tips in verschiedenen Durchmessern, einzeln oder im Vorratspack. Wähle den Durchmesser passend zu deinen Papers; Versand ab Lager in der Schweiz.",
      sections: [
        {
          heading: "Der richtige Durchmesser",
          paragraphs: [
            "Filter gibt es in unterschiedlichen Durchmessern, meist zwischen 5 und 9 Millimetern. Schlanke Filter von rund 6 Millimetern passen zu Slim-Papers, dickere Filter geben dem Ganzen mehr Volumen. Achte beim Kauf auf die Millimeterangabe im Produkttitel, damit Filter und Papers zusammenpassen.",
          ],
        },
        {
          heading: "Aktivkohlefilter, Slim Filter und Tips",
          paragraphs: [
            "Aktivkohlefilter haben eine Einlage aus Aktivkohle und sind eine verbreitete Filterart. Slim Filter sind einfache Filter in schlankem Format. Filter Tips aus Karton sind als Mundstück gedacht und werden mit eingerollt. Welche Art dir gefällt, ist eine Frage von Geschmack und Gewohnheit.",
          ],
        },
        {
          heading: "Einzeln oder im Vorratspack",
          paragraphs: [
            `Viele Filter bekommst du als kleine Packung zum Ausprobieren oder als grosse Packung mit 100 und mehr Stück. Der Preis pro Stück sinkt dabei. Ab ${frei} Bestellwert ist der Versand gratis. Passend dazu: Papers und Aschenbecher.`,
          ],
        },
      ],
      faqs: [
        {
          q: "Welcher Filterdurchmesser passt zu welchem Paper?",
          a: "Zu Slim- und King-Size-Slim-Papers passen schlanke Filter von etwa 5.9 bis 6 Millimetern. Zu normalen Papers nimmst du eher 7 oder 8 Millimeter. Der Durchmesser steht im Produkttitel.",
        },
        {
          q: "Was sind Filter Tips?",
          a: "Filter Tips sind kleine Mundstücke, meist aus Karton, die du am Ende der Zigarette mit einrollst. Aktivkohlefilter und Slim Filter sind fertige Filter, die ebenfalls am Ende sitzen.",
        },
        {
          q: "Lohnt sich ein Vorratspack?",
          a: "Wenn du regelmässig Filter brauchst, ja: Grosse Packungen kosten pro Stück deutlich weniger als kleine. Zum Ausprobieren eignet sich eine kleine Packung.",
        },
        shippingFaq(),
        paymentFaq(),
      ],
    },

    aschenbecher: {
      title: "Aschenbecher kaufen Schweiz: Glas & Kristall",
      metaDescription: `Aschenbecher kaufen in der Schweiz: Modelle aus Kristallglas und mehr, zum Behalten und Verschenken. Versand ab Lager, gratis ab ${frei}.`,
      h1: "Aschenbecher kaufen in der Schweiz",
      anchor: "Aschenbecher kaufen",
      intro:
        "Aschenbecher aus Glas und Kristallglas: stabil, gut zu reinigen und schön genug für den Tisch. Eine Auswahl, die man behält oder verschenkt, mit Versand ab Lager in der Schweiz.",
      sections: [
        {
          heading: "Worauf du beim Aschenbecher achten kannst",
          paragraphs: [
            "Wichtig sind Material, Grösse und Gewicht. Ein Aschenbecher aus massivem Glas steht stabil, ein tiefer Rand hält die Asche im Becher. Mehrere Ablagen sind praktisch, wenn du ihn zu zweit nutzt. Für draussen sind schwere Modelle windfester als leichte.",
          ],
        },
        {
          heading: "Pflege und Reinigung",
          paragraphs: [
            "Glas und Kristallglas lassen sich mit warmem Wasser und etwas Spülmittel reinigen. Hartnäckige Rückstände weichen vorher ein paar Minuten ein. Handgefertigte Stücke wäschst du am besten von Hand ab.",
          ],
        },
        {
          heading: "Als Geschenk",
          paragraphs: [
            `Ein hochwertiger Aschenbecher ist ein Geschenk, das bleibt. Ab ${frei} Bestellwert schicken wir gratis. Passend dazu findest du Papers und Filter Tips.`,
          ],
        },
      ],
      faqs: [
        {
          q: "Aus welchem Material sind die Aschenbecher?",
          a: "Unsere Aschenbecher bestehen aus Glas oder Kristallglas. Das genaue Material und die Masse stehen auf der jeweiligen Produktseite.",
        },
        {
          q: "Wie reinige ich einen Glas-Aschenbecher?",
          a: "Mit warmem Wasser und Spülmittel. Bei festen Rückständen kurz einweichen und danach mit einem weichen Schwamm abwaschen.",
        },
        {
          q: "Eignet sich ein Aschenbecher als Geschenk?",
          a: "Ja, vor allem die handgefertigten Kristallglas-Modelle werden gern verschenkt. Beachte bei der Bestellung für andere die Altersgrenze.",
        },
        {
          q: "Was mache ich, wenn ein Artikel beschädigt ankommt?",
          a: "Schreib uns über das Kontaktformular, am besten mit einem Foto. Wir finden gemeinsam eine Lösung. Die Regeln zu Rückgabe und Reklamation stehen unter Rückgabe.",
        },
        shippingFaq(),
      ],
    },

    zubehoer: {
      title: "Zubehör & Glas kaufen Schweiz",
      metaDescription: `Zubehör und Glas kaufen in der Schweiz: Aschenbecher aus Kristallglas und weitere Artikel zum Behalten. Versand ab Lager, gratis ab ${frei}.`,
      h1: "Zubehör & Glas kaufen in der Schweiz",
      anchor: "Zubehör & Glas kaufen",
    },
  };
}

/* ─── Allgemeiner Rückfall ─────────────────────────────────────────── */

function generic(category: CategoryView): CategoryContent {
  const name = category.name;
  const frei = franken(SHIPPING.freeThreshold);
  return {
    title: `${name} kaufen in der Schweiz`,
    metaDescription: `${name} online bestellen: Auswahl, faire Preise und Versand ab Lager in der Schweiz, gratis ab ${frei}.`,
    h1: `${name} kaufen in der Schweiz`,
    anchor: `${name} kaufen`,
    intro:
      category.description ||
      `${name} im Sortiment: Versand ab Lager in der Schweiz, gratis ab ${frei}.`,
    sections: [],
    faqs: [shippingFaq(), paymentFaq(), ageFaq()],
  };
}

/* ─── Medusa-Metadaten lesen ───────────────────────────────────────── */

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** «## Überschrift» und Absätze (Leerzeile) werden zu Abschnitten. */
export function parseSeoText(raw: string): CategorySection[] {
  const sections: CategorySection[] = [];
  let current: CategorySection = { paragraphs: [] };
  for (const block of raw.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const part = block.trim();
    if (!part) continue;
    const heading = /^##\s+(.+)$/.exec(part);
    if (heading) {
      if (current.heading || current.paragraphs.length) sections.push(current);
      current = { heading: heading[1].trim(), paragraphs: [] };
    } else {
      current.paragraphs.push(part);
    }
  }
  if (current.heading || current.paragraphs.length) sections.push(current);
  return sections;
}

/** Ungültiges oder leeres JSON ergibt `undefined` — dann gilt der Standard. */
export function parseSeoFaq(raw: unknown): CategoryFaq[] | undefined {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(value)) return undefined;
  const faqs = value.flatMap((entry) => {
    const q = text((entry as { q?: unknown } | null)?.q);
    const a = text((entry as { a?: unknown } | null)?.a);
    return q && a ? [{ q, a }] : [];
  });
  return faqs.length ? faqs : undefined;
}

/**
 * Die Inhalte einer Kategorie: Admin-Metadaten vor Standardtext vor
 * Rückfall, Baustein für Baustein.
 */
export function categoryContent(category: CategoryView): CategoryContent {
  const base = generic(category);
  const known = defaults()[category.handle] ?? {};
  const meta = category.metadata ?? {};

  const seoText = text(meta.seo_text);

  return {
    title: text(meta.seo_title) ?? known.title ?? base.title,
    metaDescription:
      text(meta.seo_description) ?? known.metaDescription ?? base.metaDescription,
    h1: text(meta.seo_h1) ?? known.h1 ?? base.h1,
    intro: text(meta.seo_intro) ?? known.intro ?? base.intro,
    sections: seoText ? parseSeoText(seoText) : (known.sections ?? base.sections),
    faqs: parseSeoFaq(meta.seo_faq) ?? known.faqs ?? base.faqs,
    anchor: known.anchor ?? base.anchor,
  };
}

/** Linktext für Verweise auf eine Kategorie («Papers kaufen»). */
export function categoryAnchor(category: CategoryView): string {
  return defaults()[category.handle]?.anchor ?? `${category.name} kaufen`;
}
