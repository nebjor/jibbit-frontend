import { permanentRedirect } from "next/navigation";
import { categoryPath } from "@/lib/seo/category-url";

/**
 * /shop IST UMGEZOGEN: der Katalog liegt jetzt direkt auf der Startseite
 * («shop ist die neue startseite»). Diese Route bleibt als DAUERHAFTE
 * Umleitung (308) bestehen, weil die Adresse draussen verlinkt ist —
 * Suchmaschinen, gespeicherte Links, geteilte Kategorie-URLs. Interne
 * Links zeigen alle direkt auf «/»; hier landet nur, was von aussen kommt.
 *
 * Bewusst als Seiten-Umleitung statt in next.config oder proxy.ts gelöst:
 * Domain- und Mandantenauflösung bleiben unangetastet, und die Umleitung
 * wirkt auf jedem Host gleich. Der Query-String zieht vollständig mit
 * (/shop?kategorie=x wird zu /kategorie/x), damit alte Kategorielinks
 * weiter auf der Kategorieseite landen.
 */
export default async function ShopRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const values = Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value];
    for (const v of values) qs.append(key, v);
  }

  const query = qs.toString();
  // Kategorieadresse (/shop?kategorie=x) gleich auf die Kategorieseite — ein Sprung.
  const kategorie = qs.get("kategorie");
  if (kategorie) {
    qs.delete("kategorie");
    const rest = qs.toString();
    permanentRedirect(categoryPath(kategorie) + (rest ? `?${rest}` : ""));
  }
  permanentRedirect(query ? `/?${query}` : "/");
}
