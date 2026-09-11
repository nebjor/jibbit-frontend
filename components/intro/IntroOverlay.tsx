"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Logo } from "@/components/Logo";
import { PixelJoint } from "@/components/PixelJoint";
import { createIntroMachine } from "@/lib/intro/machine";
import {
  decideIntro,
  markIntroDone,
  type IntroStorage,
} from "@/lib/intro/decision";
import {
  createIntroStarter,
  isAgeGateOpen,
  setIntroActive,
  subscribeAgeGateOpen,
} from "@/lib/intro/starter";
import { onAgeAnswerChange, readAgeAnswer } from "@/lib/consent/client";
import { INTRO_TIMINGS, type IntroPhase } from "@/lib/intro/timings";
import { SmokeCloud, type SmokeState } from "./SmokeCloud";
import styles from "./IntroOverlay.module.css";

/**
 * Das Intro-Overlay — die dünne React-Anbindung der Phasen-Maschine
 * (lib/intro/machine.ts). Es setzt pro Phase nur `data-phase`; die
 * Bewegungen selbst macht IntroOverlay.module.css, ausschliesslich mit
 * transform und opacity. Alle Dauern kommen aus lib/intro/timings.ts und
 * werden unten als CSS-Variablen durchgereicht.
 *
 * ABFOLGE (HomeIntro.tsx): ERST die Altersabfrage, DANN das Intro. Der
 * Startwächter (lib/intro/starter.ts) hält das Intro zurück, solange die
 * Abfrage offen ist, und startet es aus dem Klick heraus, sobald «adult»
 * bestätigt wird — decideIntro (und damit der sessionStorage-Marker) wird
 * bis dahin nicht angerührt. Während das Intro läuft, meldet
 * setIntroActive(true) dem ConsentGate, den Cookie-Hinweis noch
 * zurückzuhalten.
 *
 * ÜBERSPRINGBAR (Auflage 3): Klick/Tap aufs Overlay, jeder Tastendruck ohne
 * Modifier, Mausrad oder Touch-Wischen brechen SOFORT ab — ohne Ausblenden,
 * die Seite steht augenblicklich da. Aktivierende Tasten (Enter, Space,
 * Escape, Tab) werden dabei in der Capture-Phase abgefangen, damit sie
 * nicht in die Seite darunter durchschlagen (nach dem Intro erscheint dort
 * gerade der Cookie-Hinweis). Tastenkürzel mit Ctrl/Cmd/Alt (Reload,
 * Adressleiste …) bleiben dem Browser überlassen und überspringen nichts.
 *
 * BARRIEREFREIHEIT: reine Zierde — `aria-hidden`, keine fokussierbaren
 * Elemente, der Fokus kann also gar nicht erst hinein. Screenreader landen
 * direkt auf der (serverseitig gerenderten) Seite.
 *
 * FLIP-FLUG: die Zielposition (Header-Logo, `data-intro-logo-target` in
 * Header.tsx) wird zur LAUFZEIT gemessen, nicht geschätzt — der Kopfbereich
 * liegt auf dem Handy anders als auf dem Bildschirm.
 */

/* Dauern aus lib/intro/timings.ts -> CSS. NICHT hier ändern, dort drehen. */
const TIMING_VARS = {
  "--t-joint-in": `${INTRO_TIMINGS.jointIn}ms`,
  "--t-smoke-grow": `${INTRO_TIMINGS.smokeGrow}ms`,
  "--t-logo-reveal": `${INTRO_TIMINGS.logoReveal}ms`,
  "--t-logo-flight": `${INTRO_TIMINGS.logoFlight}ms`,
} as CSSProperties;

function smokeStateFor(phase: IntroPhase): SmokeState {
  switch (phase) {
    case "smokeGrow":
      return "grow";
    case "logoReveal":
      return "fade";
    case "logoHold":
    case "logoFlight":
      return "gone";
    default:
      return "hidden";
  }
}

/** Notbremse des Inline-Scripts aus HomeIntro.tsx wieder ausschalten. */
function clearFailsafeTimer() {
  const w = window as unknown as { __jibbitIntroFailsafe?: number };
  if (w.__jibbitIntroFailsafe !== undefined) {
    window.clearTimeout(w.__jibbitIntroFailsafe);
    delete w.__jibbitIntroFailsafe;
  }
}

function clearPreIntroCover() {
  clearFailsafeTimer();
  document.documentElement.removeAttribute("data-jibbit-intro");
}

export function IntroOverlay() {
  const [phase, setPhase] = useState<IntroPhase | null>(null);
  const [flightTransform, setFlightTransform] = useState<string | null>(null);
  const machineRef = useRef<ReturnType<typeof createIntroMachine> | null>(null);
  const logoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduced = false;
    }
    // Schon der ZUGRIFF auf window.sessionStorage kann werfen (alte private
    // Modi, harte Cookie-Blocker) — nicht erst getItem/setItem.
    let storage: IntroStorage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }

    let machine: ReturnType<typeof createIntroMachine> | null = null;

    const skip = () => machine?.skip();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (["Enter", " ", "Escape", "Tab"].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
      }
      skip();
    };

    // WICHTIG: auch bei normalem Ende wieder abhängen (onDone unten), nicht
    // erst beim Unmount — die Seite lebt nach dem Intro weiter, ein global
    // verbliebener Capture-Listener würde ihr die Tastatur stehlen.
    function removeListeners() {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchmove", skip);
    }

    // Läuft SYNCHRON aus der Altersbestätigung heraus (oder direkt hier,
    // wenn das Alter längst per Cookie bestätigt ist): Deckel setzen, bevor
    // React die Abfrage wegräumt — so blitzt zwischen Abfrage und erstem
    // Intro-Bild nie die Seite auf.
    const startIntro = () => {
      // Übernahme vom Inline-Script: Notbremse aus, Attribut sicherstellen
      // (hält den Deckel als Unterlage und versteckt das echte Header-Logo,
      // bis das Intro-Logo dort gelandet ist — intro-global.css).
      clearFailsafeTimer();
      document.documentElement.setAttribute("data-jibbit-intro", "");
      setIntroActive(true);

      machine = createIntroMachine({
        onPhase: setPhase,
        onDone: () => {
          markIntroDone();
          removeListeners();
          clearPreIntroCover();
          setPhase(null);
          // Jetzt (erst) darf der Cookie-Hinweis kommen — ConsentGate.tsx.
          setIntroActive(false);
        },
      });
      machineRef.current = machine;

      window.addEventListener("keydown", onKeyDown, true);
      window.addEventListener("wheel", skip, { passive: true });
      window.addEventListener("touchmove", skip, { passive: true });

      machine.start();
    };

    const starter = createIntroStarter({
      decide: () => decideIntro({ prefersReducedMotion: reduced, storage }),
      onAgeChange: onAgeAnswerChange,
      // Nicht nur das Cookie zählt: solange die Altersabfrage sichtbar ist
      // (ConsentGate meldet es über den Store), wartet der Wächter — sonst
      // spielte das Intro über der offenen Abfrage, wenn Cookie und
      // Server-HTML auseinanderlaufen (Begründung: lib/intro/starter.ts).
      isGateOpen: isAgeGateOpen,
      onGateChange: subscribeAgeGateOpen,
      onPlay: startIntro,
      // Kein Intro — falls das Inline-Script den Deckel doch gesetzt hat,
      // weg damit, die Seite gehört sofort dem Besucher.
      onSkip: clearPreIntroCover,
    });
    starter.begin(readAgeAnswer());

    return () => {
      starter.dispose();
      removeListeners();
      machine?.dispose();
      machine = null;
      machineRef.current = null;
      clearPreIntroCover();
      setIntroActive(false);
    };
  }, []);

  // FLIP: erst messen (Ist- und Zielrechteck), dann NUR die Differenz als
  // transform animieren. Gemessen wird beim Phasenwechsel zu logoFlight.
  useEffect(() => {
    if (phase !== "logoFlight") return;
    const target = document.querySelector("[data-intro-logo-target]");
    const measured = (target?.firstElementChild ??
      target) as HTMLElement | null;
    const flying = logoRef.current;
    if (!measured || !flying) return;
    const to = measured.getBoundingClientRect();
    const from = flying.getBoundingClientRect();
    // Ziel ohne Layout (sollte nicht vorkommen): dann fliegt nichts — die
    // weisse Fläche blendet in dieser Phase ohnehin auf die Seite über.
    if (to.width === 0 || from.width === 0) return;
    const scale = to.width / from.width;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    setFlightTransform("translate(" + dx + "px, " + dy + "px) scale(" + scale + ")");
  }, [phase]);

  if (phase === null) return null;

  return (
    <div
      className={styles.overlay}
      data-phase={phase}
      style={TIMING_VARS}
      aria-hidden="true"
      onPointerDown={() => machineRef.current?.skip()}
    >
      <div className={styles.bg} />
      {/* Reihenfolge = Stapel: Logo UNTER der Wolke, es «erscheint dahinter». */}
      <div className={styles.logoLayer}>
        <div
          ref={logoRef}
          className={styles.logoBox}
          style={flightTransform ? { transform: flightTransform } : undefined}
        >
          <Logo size="lg" />
        </div>
      </div>
      <div className={styles.jointLayer}>
        <PixelJoint variant="loading" px={3} />
      </div>
      <SmokeCloud state={smokeStateFor(phase)} />
    </div>
  );
}
