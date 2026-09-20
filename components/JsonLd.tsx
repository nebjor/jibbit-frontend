import { serializeJsonLd } from "@/lib/seo/jsonld";

/**
 * Ein `<script type="application/ld+json">` mit strukturierten Daten.
 *
 * Bewusst ein natives `<script>` und NICHT `next/script`: das ist Daten, kein
 * ausführbarer Code — Nexts Ladestrategien haben hier nichts zu optimieren,
 * und ein nachgeladener Block stünde nicht im ausgelieferten HTML, das ein
 * Crawler liest.
 *
 * Serialisiert wird über `serializeJsonLd`, nie über blankes
 * `JSON.stringify` — die Begründung (`</script>` in einem Produkttext) steht
 * dort.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
