/**
 * INDEXIERBARKEIT DIESES DEPLOYMENTS — der eine Schalter.
 *
 * Die Staging-Seite (test.jibbit.ch) ist eine vollständige Kopie des Shops.
 * Ohne Gegenmassnahme landet sie als Duplikat von jibbit.ch im Google-Index.
 * Dieser Schalter ist die EINZIGE Stelle, an der entschieden wird, ob ein
 * Deployment indexiert werden darf — Header (proxy.ts), Meta-Tag
 * (app/layout.tsx), robots.txt und sitemap.xml fragen alle hier nach.
 *
 * ══ SICHERE VOREINSTELLUNG: NOINDEX ═══════════════════════════════════════
 *
 *   SITE_INDEXABLE=true   → indexierbar (Produktion). Auch 1/on/ja/yes.
 *   alles andere          → NOINDEX. Auch: nicht gesetzt, leer, Tippfehler.
 *
 * Bewusst so herum. Eine versehentlich de-indexierte Produktion fällt sofort
 * auf und ist in einem Tag behoben; ein still indexiertes Staging bemerkt
 * wochenlang niemand. Der Preis: DER GO-LIVE HÄNGT AN DIESER VARIABLE. Damit
 * das nicht untergeht, meldet der Server den Zustand beim Start laut im Log
 * (instrumentation.ts), und README + .env.example führen den Schritt auf.
 *
 * ══ LAUFZEIT, NICHT BUILD-ZEIT ════════════════════════════════════════════
 *
 * Bewusst OHNE NEXT_PUBLIC_-Präfix und bei JEDEM Aufruf frisch aus
 * `process.env` gelesen. Dieselbe Falle wie bei STATIC_TENANTS/POSTHOG_KEY:
 * NEXT_PUBLIC_-Werte friert `next build` im Image ein — ein Staging-Image,
 * das mit dem falschen Wert gebaut wurde, wäre danach still indexierbar,
 * egal was in der Compose-Datei steht. Aus demselben Grund steht der Header
 * NICHT in `headers()` der next.config.ts: deren Ergebnis schreibt der Build
 * ins Routen-Manifest, der laufende Container wertet es nicht mehr aus.
 *
 * Alle betroffenen Routen rendern dynamisch (der Mandanten-Proxy erzwingt
 * das) — ein Neustart des Containers mit dem neuen Wert genügt.
 *
 * MANDANTEN: der Schalter gilt für das ganze Deployment, nicht pro Tenant.
 * Staging und Produktion sind getrennte Container; mehr braucht es bisher
 * nicht. Ein Noindex pro Mandant gehörte in die TenantConfig.
 *
 * Bewusst ohne `server-only` und ohne Abhängigkeiten: reine Funktionen,
 * direkt testbar, enthalten kein Geheimnis — und proxy.ts soll laut
 * Next-Doku keine geteilten Module mit Zustand voraussetzen.
 */

type Env = Record<string, string | undefined>;
type RobotsFlags = { index: boolean; follow: boolean };

const ON = new Set(["1", "true", "on", "ja", "yes"]);

/** Wert des Headers und des Meta-Tags, solange das Deployment gesperrt ist. */
export const NOINDEX_DIRECTIVE = "noindex, nofollow";

export const X_ROBOTS_TAG = "X-Robots-Tag";

/** Darf dieses Deployment in Suchmaschinen erscheinen? */
export function isSiteIndexable(env: Env = process.env): boolean {
  const raw = env.SITE_INDEXABLE?.trim().toLowerCase();
  return raw !== undefined && ON.has(raw);
}

/**
 * `robots`-Feld der Root-Metadaten. Gesperrt ergibt das
 * `<meta name="robots" content="noindex, nofollow">` auf jeder Seite — der
 * Gurt zum Hosenträger des Headers, falls ein vorgeschalteter Proxy den
 * Header einmal verschluckt.
 *
 * ⚠️ Ein `robots` in den Metadaten einer SEITE ersetzt das des Layouts
 * vollständig. Wer dort `index: true` festschreibt, hebt die Sperre für
 * diese Seite im Meta-Tag wieder auf. Solche Seiten reichen ihren Wunsch
 * deshalb als `whenIndexable` hier durch (siehe app/impressum/page.tsx);
 * Seiten mit festem `index: false` sind in beiden Zuständen richtig.
 */
export function robotsMetadata(
  whenIndexable: RobotsFlags = { index: true, follow: true },
  env: Env = process.env,
): RobotsFlags {
  return isSiteIndexable(env) ? whenIndexable : { index: false, follow: false };
}

/**
 * Setzt den Noindex-Header auf eine Antwort — oder lässt sie unberührt, wenn
 * das Deployment indexierbar ist (dann gibt es den Header gar nicht, wie
 * bisher). Gibt dieselben Header zurück, damit sich der Aufruf einreihen lässt.
 */
export function applyIndexingHeader(
  headers: Headers,
  env: Env = process.env,
): Headers {
  if (!isSiteIndexable(env)) headers.set(X_ROBOTS_TAG, NOINDEX_DIRECTIVE);
  return headers;
}

/**
 * Pfade, die proxy.ts NUR wegen des Noindex-Headers sieht (zweiter
 * Matcher-Block dort) und die an der Tenant-Auflösung VORBEI laufen: der
 * Bildoptimizer, der Bildproxy und die Pixel-Art-Assets. Bewusst eng und
 * exakt — `/mediathek` darf nicht darunterfallen, deshalb der Schrägstrich
 * am Präfix. Steht hier und nicht in proxy.ts, weil die Proxy-Datei laut
 * Next-Doku nur die Proxy-Funktion (und `config`) exportieren soll.
 */
export function isTenantlessAssetPath(pathname: string): boolean {
  return (
    pathname === "/_next/image" ||
    pathname.startsWith("/media/") ||
    pathname.startsWith("/loader/")
  );
}

/**
 * Die Meldung für den Serverstart. Eigene Funktion, damit der Wortlaut
 * getestet ist: er muss den Go-live-Fall unmissverständlich benennen.
 */
export function indexingStartupMessage(env: Env = process.env): {
  level: "warn" | "info";
  text: string;
} {
  if (isSiteIndexable(env)) {
    return {
      level: "info",
      text: "[seo] SITE_INDEXABLE ist gesetzt — dieses Deployment ist für Suchmaschinen INDEXIERBAR.",
    };
  }
  const raw = env.SITE_INDEXABLE;
  const grund =
    raw === undefined || raw.trim() === ""
      ? "SITE_INDEXABLE ist nicht gesetzt"
      : `SITE_INDEXABLE="${raw}" ist kein gültiger Ein-Wert (true/1/on/ja/yes)`;
  return {
    level: "warn",
    text:
      `[seo] ⚠️  NOINDEX AKTIV: ${grund}. Dieses Deployment sendet ` +
      `"${X_ROBOTS_TAG}: ${NOINDEX_DIRECTIVE}", liefert keine Sitemap und ` +
      "verschwindet damit aus Suchmaschinen. Für Staging ist das richtig. " +
      "Für die PRODUKTION muss SITE_INDEXABLE=true gesetzt sein " +
      "(docker-compose.yml, Dienst storefront, Block environment:).",
  };
}
