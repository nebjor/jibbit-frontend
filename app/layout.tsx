import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { CartDrawer } from "@/components/CartDrawer";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ConsentGate } from "@/components/consent/ConsentGate";
import { AnalyticsGate } from "@/components/analytics/AnalyticsGate";
import { STORE } from "@/lib/config";
import { getTenantContext } from "@/lib/tenant/context";
import { readCartState } from "@/lib/cart/server";
import { readConsentCookies } from "@/lib/consent/server";
import { getAnalyticsRuntimeConfig } from "@/lib/analytics/server";
import { JsonLd } from "@/components/JsonLd";
import { graph, organizationJsonLd, webSiteJsonLd } from "@/lib/seo/jsonld";

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
 *
 * ALTERSABFRAGE & COOKIE-HINWEIS folgen demselben Prinzip: die beiden
 * Cookies werden HIER serverseitig gelesen und `ConsentGate` als
 * Anfangszustand mitgegeben. Beim ersten Besuch steckt die (deckende)
 * Altersabfrage damit schon im ausgelieferten HTML — der Shop blitzt nicht
 * erst auf, bevor ein Client-Effekt sie darüberlegt; wiederkehrende
 * Besucher bekommen gar kein Overlay ins HTML. Der Shop-Inhalt bleibt in
 * beiden Fällen vollständig im DOM (Overlay statt Redirect), Crawler ohne
 * Cookies indexieren also weiterhin die Produktseiten und nicht «nur die
 * Altersabfrage». Warum es die Abfrage überhaupt gibt: lib/consent/state.ts.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [initialCart, { age, consent }, tenant] = await Promise.all([
    readCartState(),
    readConsentCookies(),
    getTenantContext(),
  ]);

  /**
   * Betrieb und Website als strukturierte Daten — EINMAL im Layout, also auf
   * jeder Seite. Die Produktseite verweist mit `@id` darauf zurück, statt
   * Verkäufer und Rückgaberegel je Angebot zu wiederholen.
   *
   * MULTI-TENANT: Name und Domain kommen aus dem aufgelösten Mandanten. Die
   * Anbieterkennzeichnung (Adresse, Telefon) fügt `organizationJsonLd` nur
   * auf jibbits eigener Domain an — Begründung dort.
   */
  const siteJsonLd = graph(
    organizationJsonLd(tenant.theme),
    webSiteJsonLd(tenant.theme),
  );

  // PostHog: Schlüssel/Host zur LAUFZEIT aus der Umgebung gelesen und als
  // Props zum Client gereicht — bewusst kein NEXT_PUBLIC_ (Begründung:
  // lib/analytics/server.ts). GELADEN wird trotzdem erst nach erteilter
  // Einwilligung; das entscheidet lib/analytics/gate.ts, nicht dieses Layout.
  const analytics = getAnalyticsRuntimeConfig();

  return (
    <html lang="de-CH">
      <body>
        <JsonLd data={siteJsonLd} />
        <CartProvider initialCart={initialCart}>
          <a href="#main" className="srOnly">
            Zum Inhalt springen
          </a>
          <Header />
          <main id="main">{children}</main>
          <Footer />
          <CartDrawer />
          <ConsentGate initialAge={age} initialConsent={consent} />
          <AnalyticsGate
            posthogKey={analytics.key}
            posthogHost={analytics.host}
          />
        </CartProvider>
      </body>
    </html>
  );
}
