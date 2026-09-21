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
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `https://${tenant.theme.domain}/sitemap.xml`,
  };
}
