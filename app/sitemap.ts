import type { MetadataRoute } from "next";
import { STORE } from "@/lib/config";
import { getProducts, getCategories } from "@/lib/data";

const BASE = `https://${STORE.domain}`;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);

  const staticRoutes = [
    "",
    "/shop",
    "/impressum",
    "/agb",
    "/datenschutz",
    "/widerrufsrecht",
    "/service/kontakt",
    "/service/versand",
    "/service/zahlungsarten",
    "/service/rueckgabe",
    "/service/faq",
  ];

  return [
    ...staticRoutes.map((path) => ({
      url: `${BASE}${path}`,
      lastModified: new Date(),
      priority: path === "" ? 1 : 0.6,
    })),
    ...categories.map((c) => ({
      url: `${BASE}/shop?kategorie=${c.handle}`,
      lastModified: new Date(),
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${BASE}/products/${p.handle}`,
      lastModified: new Date(),
      priority: 0.7,
    })),
  ];
}
