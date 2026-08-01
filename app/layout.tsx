import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { CartDrawer } from "@/components/CartDrawer";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { STORE } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${STORE.domain}`),
  title: {
    default: `${STORE.name} — Online Headshop Schweiz`,
    template: `%s | ${STORE.name}`,
  },
  description: STORE.tagline,
  openGraph: {
    type: "website",
    locale: "de_CH",
    siteName: STORE.name,
    title: `${STORE.name} — Online Headshop Schweiz`,
    description: STORE.tagline,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f5f3",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de-CH">
      <body>
        <CartProvider>
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
