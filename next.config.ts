import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Container deployment: emit `.next/standalone` — a self-contained server
   * with only the modules it actually imports, instead of the whole
   * node_modules tree. That is what lets the runtime image skip `npm install`
   * entirely (see Dockerfile).
   *
   * Harmless for `next dev`; the standalone bundle is only produced by
   * `next build`.
   */
  output: "standalone",

  /**
   * Bildoptimierung (LCP):
   *  - Kürzere Breitenliste: `next/image` schreibt für jedes Priority-Bild ein
   *    <link rel=preload> mit dem GANZEN srcset. Die Standardliste hat 10
   *    Breiten bis 3840 px; Produktbilder sind höchstens ~800 CSS-px breit, so
   *    ist alles ab 1920 px nur Ballast im <head> und potenzielle
   *    Optimierer-Last auf der kleinen VPS.
   *  - `minimumCacheTTL`: Der Optimierer revalidiert Ergebnisse sonst nach
   *    60 s. Medusa-Dateinamen tragen einen Zeitstempel (`<ms>-name.jpg`),
   *    ein ersetztes Bild hat also eine neue URL — 31 Tage sind gefahrlos.
   */
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 31,
  },

  /**
   * ZU `images.remotePatterns`: ABSICHTLICH NICHT GESETZT.
   *
   * Die naheliegende Lösung für Produktbilder aus Medusa wäre ein Eintrag mit
   * dem Backend-Host. Das geht hier nicht, aus zwei voneinander unabhängigen
   * Gründen:
   *
   *   1. `remotePatterns` ist eine BUILD-Zeit-Angabe. Diese Storefront ist
   *      mehrmandantenfähig, die Backend-Adresse eines Tenants steht erst zur
   *      Laufzeit in der TenantConfig (lib/tenant/*), und mit jedem neuen
   *      Tenant käme ein Host dazu. Ein gemeinsam genutztes Image kann diese
   *      Liste nicht kennen. `hostname: "**"` wäre der Ausweg — und damit ein
   *      offener Bildoptimierer für beliebige Adressen.
   *
   *   2. Die Backend-Adresse ist meist gar nicht öffentlich erreichbar. Im
   *      Compose steht dort `http://medusa:9000`, ein Docker-Servicename. Ein
   *      <img> mit dieser URL lädt in keinem Browser, mit oder ohne
   *      `remotePatterns`.
   *
   * Stattdessen liefert die Storefront Produktbilder unter ihrer EIGENEN
   * Herkunft aus (`/media/<key>`, siehe app/media/[...path]/route.ts) und holt
   * sie serverseitig beim Backend des jeweiligen Tenants. Gleich-herkünftige
   * Pfade prüft `next/image` nicht gegen `remotePatterns` — die Frage stellt
   * sich damit gar nicht mehr, und für den nächsten Tenant auch nicht neu.
   *
   * Käme später ein Objektspeicher mit öffentlicher CDN-Adresse dazu, wäre HIER
   * der Ort für einen `remotePatterns`-Eintrag. Bis dahin fallen solche URLs in
   * lib/media.ts auf `unoptimized` zurück und werden unverändert ausgeliefert,
   * statt eine Fehlerseite zu erzeugen.
   */
};

export default nextConfig;
