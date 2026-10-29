/** Rückgabe der Server Action des Produktwunsch-Formulars. */
export interface WunschState {
  /** `null` = noch nichts abgeschickt. */
  ok: boolean | null
  message?: string
  /** Feldname -> Meldung. */
  fieldErrors?: Record<string, string>
}

export const WUNSCH_LEER: WunschState = { ok: null }
