"use client";

import {
  createContext,
  useCallback,
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
 *
 * ADRESSZEILE: mit `urlParam` schreibt jede Auswahl `?<urlParam>=<id>` in die
 * URL (`replaceState` — kein Neuladen, kein Verlaufseintrag, kein Server-
 * Roundtrip). Damit ist die Adresse, die jemand kopiert oder teilt, dieselbe
 * Varianten-URL, die im JSON-LD an `Offer.url` steht und die die Seite
 * serverseitig vorauswählt (app/products/[handle]/page.tsx).
 */

interface VariantSelection {
  selectedId: string | null;
  select: (id: string) => void;
}

const Ctx = createContext<VariantSelection | null>(null);

export function VariantSelectionProvider({
  initialId,
  urlParam,
  children,
}: {
  /** Vorauswahl — `?variant=` oder dieselbe wie in AddToCart (`defaultVariant`). */
  initialId: string | null;
  /** Query-Parameter, der die Auswahl in der Adresszeile mitführt. */
  urlParam?: string;
  children: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialId);

  const select = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (!urlParam) return;
      const url = new URL(window.location.href);
      url.searchParams.set(urlParam, id);
      window.history.replaceState(null, "", url);
    },
    [urlParam],
  );

  const value = useMemo(() => ({ selectedId, select }), [selectedId, select]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * `null` ausserhalb eines Providers — Aufrufer (AddToCart) fallen dann auf
 * ihren eigenen lokalen State zurück, statt zu werfen.
 */
export function useVariantSelection(): VariantSelection | null {
  return useContext(Ctx);
}
