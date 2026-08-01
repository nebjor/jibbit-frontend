import type { MetadataRoute } from "next";
import { STORE } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `https://${STORE.domain}/sitemap.xml`,
  };
}
