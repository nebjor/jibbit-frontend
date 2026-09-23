import type { MetadataRoute } from "next";
import { getTenantContext } from "@/lib/tenant/context";
import { isSiteIndexable } from "@/lib/seo/indexing";

/** MULTI-TENANT: sitemap URL must point at the resolved tenant's own domain. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  // Vor dem Schalter aufgelöst, nicht dahinter: `getTenantContext` liest den
  // Request-Header und hält diese Route damit DYNAMISCH. Ohne Request-API
  // würde Next die robots.txt beim Build einfrieren — samt dem Wert, den
  // SITE_INDEXABLE im Build-Container zufällig hatte.
  const tenant = await getTenantContext();

  if (!isSiteIndexable()) {
    // GESPERRTES DEPLOYMENT (Staging) — und trotzdem `Allow: /`. Das ist
    // kein Versehen: ein `Disallow: /` verbietet das CRAWLEN, nicht das
    // Indexieren. Google dürfte die Seiten dann nicht mehr abrufen, sähe
    // weder den `X-Robots-Tag`-Header noch das Meta-Tag und behielte bereits
    // bekannte URLs im Index («Indexiert, obwohl durch robots.txt
    // blockiert»). Noindex wirkt nur, wenn der Crawler es lesen darf.
    //
    // Keine `sitemap`-Zeile: eine Sitemap ist eine Einladung zum Indexieren.
    return { rules: { userAgent: "*", allow: "/" } };
  }

  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `https://${tenant.theme.domain}/sitemap.xml`,
  };
}
