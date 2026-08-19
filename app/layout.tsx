import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { CartDrawer } from "@/components/CartDrawer";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { STORE } from "@/lib/config";
import { getTenantContext } from "@/lib/tenant/context";
import { readCartState } from "@/lib/cart/server";

/**
 * MULTI-TENANT: metadataBase, title and OG siteName come from the resolved
 * tenant (its own domain, its own store name) — a static `metadata` export
 * would bake ONE tenant's domain into every response this deployment serves.
 * `generateMetadata` runs per request instead.
 *
 * The tagline/description below remain jibbit's own marketing copy — full
 * per-tenant content theming (beyond name/domain/colour) is out of scope
 * here; see README's "Stubbed / pending" section for the same pattern
 * applied to the logo and product imagery.
 */
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantContext();
  const { storeName, domain } = tenant.theme;
  return {
    metadataBase: new URL(`https://${domain}`),
    title: {
      default: `${storeName} — Online Headshop Schweiz`,
      template: `%s | ${storeName}`,
    },
    description: STORE.tagline,
    openGraph: {
      type: "website",
      locale: "de_CH",
      siteName: storeName,
      title: `${storeName} — Online Headshop Schweiz`,
      description: STORE.tagline,
    },
    robots: { index: true, follow: true },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const tenant = await getTenantContext();
  return {
    width: "device-width",
    initialScale: 1,
    themeColor: tenant.theme.themeColor,
  };
}

/**
 * The cart is read SERVER-SIDE here and handed to the provider as its initial
 * state, so the header badge is right in the first paint instead of counting up
 * from 0 after hydration. `readCartState` is deliberately read-only — it never
 * creates a cart and never writes a cookie, because `cookies().set()` throws
 * outside a Server Action. Creating a cart is the job of the first mutation.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const initialCart = await readCartState();

  return (
    <html lang="de-CH">
      <body>
        <CartProvider initialCart={initialCart}>
          <a href="#main" className="srOnly">
            Zum Inhalt springen
          </a>
          <Header />
          <main id="main">{children}</main>
          <Footer />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
