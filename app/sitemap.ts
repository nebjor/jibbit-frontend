import type { MetadataRoute } from "next";
import { getProducts, getCategories } from "@/lib/data";
import { getTenantContext } from "@/lib/tenant/context";
import { isSiteIndexable } from "@/lib/seo/indexing";

/** MULTI-TENANT: every URL below must be under the resolved tenant's own domain. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Zuerst der Tenant: der Header-Zugriff hält die Route dynamisch, der
  // Schalter darunter wird also je Anfrage gelesen und nicht beim Build
  // eingefroren (siehe app/robots.ts).
  const tenant = await getTenantContext();
  const BASE = `https://${tenant.theme.domain}`;

  // Gesperrtes Deployment (Staging): eine LEERE Sitemap — gültiges XML ohne
  // eine einzige URL, und ohne das Backend überhaupt zu fragen. Die
  // robots.txt verweist in diesem Zustand auch nicht mehr hierher.
  if (!isSiteIndexable()) return [];

  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);

  // "/shop" fehlt bewusst: die Adresse ist nur noch eine dauerhafte
  // Umleitung auf die Startseite — Umleitungen gehören nicht in die Sitemap.
  const staticRoutes = [
    "",
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

  // Kein `lastModified`: Google wertet <lastmod> nur aus, wenn es nachweislich
  // stimmt. Der Zeitpunkt des Abrufs («jetzt», bei jedem Abruf neu) sagt
  // nichts über die Seite und entwertet die Angabe für die ganze Sitemap.
  return [
    ...staticRoutes.map((path) => ({
      url: `${BASE}${path}`,
      priority: path === "" ? 1 : 0.6,
    })),
    ...categories.map((c) => ({
      // Kodieren: Handles können `&` oder Umlaute enthalten.
      url: `${BASE}/?kategorie=${encodeURIComponent(c.handle)}`,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${BASE}/products/${p.handle}`,
      priority: 0.7,
    })),
  ];
}
