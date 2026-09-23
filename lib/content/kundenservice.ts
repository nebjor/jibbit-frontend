/**
 * Kundenservice-Inhalte: Footer-Navigation und Erreichbarkeit. Statisch im
 * Repo wie alle Service- und Rechtsseiten; admin-pflegbar wäre ein eigener
 * Folgeschritt.
 */

export type FooterLink = { href: string; label: string };
export type FooterGroup = { title: string; links: readonly FooterLink[] };

/** Die Spalten des Footers, in Anzeigereihenfolge. */
export const FOOTER_GROUPS: readonly FooterGroup[] = [
  {
    title: "Kundenservice",
    links: [
      { href: "/service/kontakt", label: "Kontakt" },
      { href: "/service/versand", label: "Versand & Lieferung" },
      { href: "/service/zahlungsarten", label: "Zahlungsarten" },
      { href: "/service/rueckgabe", label: "Rückgaberecht & Reklamation" },
      { href: "/service/faq", label: "Häufige Fragen" },
    ],
  },
  {
    title: "Shop",
    links: [
      { href: "/", label: "Ganzes Sortiment" },
      { href: "/suche", label: "Suche" },
      { href: "/konto", label: "Mein Konto" },
      { href: "/konto/bestellungen", label: "Meine Bestellungen" },
    ],
  },
  {
    title: "Rechtliches",
    links: [
      { href: "/impressum", label: "Impressum" },
      { href: "/agb", label: "AGB" },
      { href: "/datenschutz", label: "Datenschutzerklärung" },
      { href: "/widerrufsrecht", label: "Widerrufsrecht" },
    ],
  },
] as const;

/** Erreichbarkeit, Wortlaut wie bei Schweizer Mitbewerbern üblich. */
export const SUPPORT = {
  hours: "Mo–Fr, 9–17 Uhr",
  replyTime: "in der Regel innerhalb eines Werktags",
} as const;
