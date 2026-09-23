"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Gewählte Preisstufe («1 Stück», «24er Display», …) der Produktseite.
 *
 * Wie VariantSelection hebt dieser Provider nur EINE Zeile State an, damit
 * Galerie (Stufenfoto nach vorn) und Kaufbox (Chips, Menge) dieselbe Wahl
 * sehen, ohne die Seite zur Client-Komponente zu machen. Der Wert ist die
 * «ab»-Menge der Stufe; Vorauswahl ist 1 Stück.
 */
interface TierSelection {
  tier: number;
  setTier: (minQuantity: number) => void;
}

const Ctx = createContext<TierSelection | null>(null);

export function TierSelectionProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState(1);
  const value = useMemo(() => ({ tier, setTier }), [tier]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** `null` ausserhalb eines Providers — Aufrufer nutzen dann lokalen State. */
export function useTierSelection(): TierSelection | null {
  return useContext(Ctx);
}
