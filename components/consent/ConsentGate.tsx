"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  overlayStep,
  type AgeAnswer,
  type ConsentDecision,
} from "@/lib/consent/state";
import {
  clearAgeAnswer,
  onConsentSettingsOpen,
  writeAgeAnswer,
  writeConsent,
} from "@/lib/consent/client";
import {
  isIntroActive,
  setAgeGateOpen,
  subscribeIntroActive,
} from "@/lib/intro/starter";
import { AgeGate } from "./AgeGate";
import { ConsentBanner } from "./ConsentBanner";

/**
 * Orchestriert die beiden Einblendungen: ERST die Altersabfrage, DANN der
 * Cookie-Hinweis, nie beide übereinander (Abfolge: lib/consent/state.ts,
 * `overlayStep`).
 *
 * DAS INTRO DAZWISCHEN (nur Startseite): Läuft nach der Altersbestätigung
 * das Erstbesuchs-Intro (lib/intro/starter.ts, `isIntroActive`), hält
 * dieser Gate den Cookie-Hinweis so lange zurück — die Abfolge ist damit
 * Altersabfrage -> Intro -> Cookie-Hinweis. Auf allen anderen Seiten (und
 * wenn kein Intro spielt) bleibt alles beim Alten: der Hinweis kommt
 * direkt nach der Bestätigung. NUR die Anzeige wartet; an der
 * Einwilligungslogik (lib/consent/) ändert das nichts.
 *
 * KEIN AUFBLITZEN: `initialAge`/`initialConsent` kommen aus den Cookies,
 * SERVERSEITIG gelesen (app/layout.tsx -> lib/consent/server.ts). Das
 * ausgelieferte HTML enthält beim ersten Besuch also bereits die deckende
 * Altersabfrage — und bei einem wiederkehrenden Besucher gar kein Overlay.
 * Der Client startet mit exakt demselben Zustand (kein Cookie-Lesen im
 * Effekt, kein Nachklappen nach der Hydration); danach führt er die
 * Übergänge lokal weiter, ohne die Seite neu zu laden.
 */
export function ConsentGate({
  initialAge,
  initialConsent,
}: {
  initialAge: AgeAnswer;
  initialConsent: ConsentDecision | null;
}) {
  const [age, setAge] = useState<AgeAnswer>(initialAge);
  const [consent, setConsent] = useState<ConsentDecision | null>(
    initialConsent,
  );
  /**
   * «Ohne Entscheidung geschlossen» (Escape / Scrim / Link zur
   * Datenschutzerklärung): nur für diese Seitenansicht gemerkt, KEIN
   * Cookie. Analyse bleibt aus; beim nächsten vollen Seitenaufruf fragt
   * der Server wieder.
   */
  const [dismissed, setDismissed] = useState(false);
  /** Über den Footer-Link erneut geöffnet — der Widerrufsweg. */
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Footer-Link «Cookie-Einstellungen» -> Dialog wieder öffnen. Solange die
  // Altersabfrage vorne ist, ist der Footer ohnehin unerreichbar; der Guard
  // ist Gürtel und Hosenträger.
  useEffect(
    () =>
      onConsentSettingsOpen(() => {
        if (age === "adult") setSettingsOpen(true);
      }),
    [age],
  );

  // «Läuft das Intro gerade?» — serverseitig immer false (dritter
  // Parameter), clientseitig schaltet der Store um, BEVOR die
  // Altersbestätigung rendert (das Intro startet synchron im selben
  // Klick, lib/intro/starter.ts) — der Hinweis blitzt also nicht kurz auf.
  const introActive = useSyncExternalStore(
    subscribeIntroActive,
    isIntroActive,
    () => false,
  );

  const step = settingsOpen ? "consent-banner" : overlayStep(age, consent);
  // Der Cookie-Hinweis wartet, bis das Intro durch ist — er soll der
  // Inszenierung nicht in die Quere kommen (Abfolge: HomeIntro.tsx).
  const showBanner =
    step === "consent-banner" && (settingsOpen || !dismissed) && !introActive;
  const showGate = step === "age-gate";

  // Hintergrund nicht scrollbar, solange ein Dialog vorne ist (gleiches
  // Muster wie der CartDrawer).
  useEffect(() => {
    if (!showGate && !showBanner) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showGate, showBanner]);

  // Meldet dem Intro-Startwächter (lib/intro/starter.ts), ob die
  // Altersabfrage gerade VOR dem Besucher steht. Das Cookie allein taugt
  // dafür nicht: Server-HTML und Cookie können auseinanderlaufen (zweiter
  // Tab setzt das Cookie zwischen Request und Hydration; ein Cache liefert
  // die cookielose HTML-Variante an einen Browser mit Jahres-Cookie) —
  // dann sagte das Cookie «adult», während die Abfrage hier noch offen
  // war, und das Intro liefe über ihr. BEWUSST ein Layout-Effekt: er läuft
  // vor den passiven Effekten des (womöglich später gestreamten)
  // Seiteninhalts — das IntroOverlay liest beim Mount also nie einen
  // veralteten Wert. Gemeldet wird NUR der Anzeige-Zustand; am Verhalten
  // der Einwilligungslogik selbst ändert sich nichts.
  useLayoutEffect(() => {
    setAgeGateOpen(showGate);
    return () => setAgeGateOpen(false);
  }, [showGate]);

  const confirmAge = useCallback(() => {
    writeAgeAnswer("adult");
    setAge("adult");
    // Kein Reload: overlayStep schaltet direkt auf den Cookie-Hinweis um.
  }, []);

  const declineAge = useCallback(() => {
    writeAgeAnswer("minor");
    setAge("minor");
  }, []);

  const resetAge = useCallback(() => {
    clearAgeAnswer();
    setAge(null);
  }, []);

  const decide = useCallback((analytics: boolean) => {
    setConsent(writeConsent(analytics));
    setSettingsOpen(false);
  }, []);

  const closeWithoutDecision = useCallback(() => {
    setSettingsOpen(false);
    setDismissed(true);
  }, []);

  if (showGate) {
    return (
      <AgeGate
        declined={age === "minor"}
        onConfirm={confirmAge}
        onDecline={declineAge}
        onReset={resetAge}
      />
    );
  }

  if (showBanner) {
    return (
      <ConsentBanner
        mode={settingsOpen ? "settings" : "initial"}
        currentAnalytics={consent === null ? null : consent.analytics}
        onAcceptAll={() => decide(true)}
        onNecessaryOnly={() => decide(false)}
        onClose={closeWithoutDecision}
      />
    );
  }

  return null;
}
