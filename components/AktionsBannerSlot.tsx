import { getAktionen } from "@/lib/data";
import { produktHinweis, waehleBanner } from "@/lib/aktionen";
import { AktionsBanner } from "./AktionsBanner";

/**
 * Server-Anschluss des Aktionsbanners: holt die laufenden Aktionen
 * (gecacht, 60 s) und zeigt den Banner — oder nichts. `getAktionen` wirft
 * nie; ein ausgefallenes Backend heisst «kein Banner», nie eine Fehlerseite.
 */
export async function AktionsBannerSlot() {
  const aktion = waehleBanner(await getAktionen());
  return aktion ? <AktionsBanner aktion={aktion} /> : null;
}

/**
 * Kleine Zeile für die Produktseite: Medusa zieht den Rabatt erst im
 * Warenkorb ab, der Preis auf der Seite bleibt der reguläre. Nur bei einer
 * Prozent-Aktion auf das ganze Sortiment.
 */
export async function AktionsHinweis({ className }: { className?: string }) {
  const text = produktHinweis(await getAktionen());
  return text ? (
    <p className={className} data-testid="aktions-hinweis">
      {text}
    </p>
  ) : null;
}
