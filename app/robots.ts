import type { MetadataRoute } from "next";
import { getTenantContext } from "@/lib/tenant/context";

/** MULTI-TENANT: sitemap URL must point at the resolved tenant's own domain. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const tenant = await getTenantContext();
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `https://${tenant.theme.domain}/sitemap.xml`,
  };
}
