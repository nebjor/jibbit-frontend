"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Gemeinsamer Zustand «welche Variante ist gewählt?» für die Produktseite.
 *
 * Die Auswahl lag bisher als lokaler State in AddToCart — dort kann die
 * Galerie sie nicht sehen. Statt die ganze Seite zur Client-Komponente zu
 * machen (und damit das serverseitig gerenderte Hauptbild zu verlieren),
 * hebt dieser Provider NUR die eine Zeile State an: die Seite bleibt eine
 * Server-Komponente, der Provider umschliesst Galerie und Kaufbox, und beide
 * lesen dieselbe Auswahl.
 */

interface VariantSelection {
  selectedId: string | null;
  select: (id: string) => void;
}

const Ctx = createContext<VariantSelection | null>(null);

export function VariantSelectionProvider({
  initialId,
  children,
}: {
  /** Vorauswahl — dieselbe wie in AddToCart (`defaultVariant`). */
  initialId: string | null;
  children: ReactNode;
}) {
  const [selectedId, select] = useState<string | null>(initialId);
  const value = useMemo(() => ({ selectedId, select }), [selectedId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * `null` ausserhalb eines Providers — Aufrufer (AddToCart) fallen dann auf
 * ihren eigenen lokalen State zurück, statt zu werfen.
 */
export function useVariantSelection(): VariantSelection | null {
  return useContext(Ctx);
}
