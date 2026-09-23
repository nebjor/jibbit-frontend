import { indexingStartupMessage } from "@/lib/seo/indexing";

/**
 * Läuft EINMAL beim Start des Next-Servers, bevor er Anfragen annimmt.
 *
 * Einziger Zweck bisher: den Indexierungs-Zustand laut ins Log schreiben.
 * Die sichere Voreinstellung von SITE_INDEXABLE ist NOINDEX (Begründung:
 * lib/seo/indexing.ts) — das heisst, eine Produktion, bei der die Variable
 * vergessen wurde, verschwindet aus Google, ohne dass irgendetwas kaputt
 * aussieht. Diese Zeile in `docker compose logs storefront` ist die Stelle,
 * an der das auffällt.
 */
export function register() {
  // Nur im Node-Prozess — sonst stünde die Meldung je Runtime einmal im Log.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { level, text } = indexingStartupMessage();
  if (level === "warn") console.warn(text);
  else console.info(text);
}
