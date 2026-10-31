"use client"

import { useActionState, useRef, useState } from "react"
import { useFormStatus } from "react-dom"
import { SHOP } from "@/shop.config"
import { produktwunschSenden } from "@/lib/produktwunsch/actions"
import { WUNSCH_LEER, type WunschState } from "@/lib/produktwunsch/types"
import { EMAIL_MAX, MELDUNG_ZU_OFT, WUNSCH_MAX, darfSenden } from "@/lib/produktwunsch/validate"
import styles from "./ProduktWunsch.module.css"

/**
 * «Nicht gefunden, was du suchst?» — Kasten am Ende jeder Produktliste.
 *
 * Der Wunsch geht per Server Action ans Backend (lib/produktwunsch/actions.ts).
 * Kontext (Kategorie oder Suchbegriff, Seitenadresse) fährt unsichtbar mit.
 *
 * Schutz: ein Honigtopf-Feld (`website`, für Menschen unsichtbar), im Browser
 * ein Versand pro Minute, im Backend ein Limit pro Adresse. Der Browser-Zähler
 * liegt in localStorage und ist nur Komfort; fehlt der Speicher, gilt allein
 * das Backend.
 */

const SPEICHER_KEY = `${SHOP.id}-produktwunsch-zeit`

function letzterVersand(): number | null {
  try {
    const v = window.localStorage.getItem(SPEICHER_KEY)
    return v ? Number(v) : null
  } catch {
    return null
  }
}

function versandMerken() {
  try {
    window.localStorage.setItem(SPEICHER_KEY, String(Date.now()))
  } catch {
    // Kein Speicher: das Backend begrenzt trotzdem.
  }
}

function Absenden() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={styles.submit} disabled={pending}>
      {pending ? "Einen Moment …" : "Wunsch senden"}
    </button>
  )
}

interface Props {
  /** Name der angezeigten Kategorie, falls die Liste eine Kategorie ist. */
  kategorie?: string
  /** Suchbegriff, falls die Liste ein Suchergebnis ist. */
  suche?: string
}

export function ProduktWunsch({ kategorie, suche }: Props) {
  const [wunsch, setWunsch] = useState("")
  const [email, setEmail] = useState("")
  // Erfolg: Felder leeren und den Zeitpunkt für die Minutenbremse merken.
  // Bei einem Fehler bleibt der Text stehen.
  const [state, formAction] = useActionState(async (prev: WunschState, formData: FormData) => {
    const ergebnis = await produktwunschSenden(prev, formData)
    if (ergebnis.ok === true) {
      setWunsch("")
      setEmail("")
      versandMerken()
    }
    return ergebnis
  }, WUNSCH_LEER)
  const [zuOft, setZuOft] = useState(false)
  const urlRef = useRef<HTMLInputElement>(null)

  const fehler = state.fieldErrors ?? {}

  return (
    <section className={styles.box} aria-labelledby="produktwunsch-titel">
      <h2 id="produktwunsch-titel" className={styles.title}>
        Nicht gefunden, was du suchst?
      </h2>
      <p className={styles.text}>
        Sag uns, welches Produkt dir fehlt – wir schauen, ob wir es ins Sortiment nehmen.
      </p>

      <form
        className={styles.form}
        action={formAction}
        noValidate
        onSubmit={(e) => {
          if (!darfSenden(letzterVersand(), Date.now())) {
            e.preventDefault()
            setZuOft(true)
            return
          }
          setZuOft(false)
          if (urlRef.current) urlRef.current.value = window.location.href
        }}
      >
        <div className={styles.field}>
          <label className={styles.label} htmlFor="produktwunsch-wunsch">
            Produktwunsch
          </label>
          <textarea
            id="produktwunsch-wunsch"
            name="wunsch"
            className={styles.input}
            rows={3}
            maxLength={WUNSCH_MAX}
            required
            aria-required="true"
            aria-invalid={fehler.wunsch ? true : undefined}
            aria-describedby={fehler.wunsch ? "produktwunsch-wunsch-fehler" : undefined}
            value={wunsch}
            onChange={(e) => setWunsch(e.target.value)}
          />
          {fehler.wunsch ? (
            <p className={styles.fieldError} id="produktwunsch-wunsch-fehler">
              {fehler.wunsch}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="produktwunsch-email">
            E-Mail (optional, für eine Antwort)
          </label>
          <input
            id="produktwunsch-email"
            name="email"
            type="email"
            className={styles.input}
            autoComplete="email"
            inputMode="email"
            maxLength={EMAIL_MAX}
            aria-invalid={fehler.email ? true : undefined}
            aria-describedby={fehler.email ? "produktwunsch-email-fehler" : undefined}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {fehler.email ? (
            <p className={styles.fieldError} id="produktwunsch-email-fehler">
              {fehler.email}
            </p>
          ) : null}
        </div>

        {/* Honigtopf: für Menschen unsichtbar und nicht erreichbar. */}
        <div className={styles.honig} aria-hidden="true">
          <label htmlFor="produktwunsch-website">Website</label>
          <input id="produktwunsch-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <input type="hidden" name="kategorie" value={kategorie ?? ""} />
        <input type="hidden" name="suche" value={suche ?? ""} />
        <input type="hidden" name="url" defaultValue="" ref={urlRef} />

        <div className={styles.actions}>
          <Absenden />
        </div>

        <div role="status" aria-live="polite" className={styles.status}>
          {zuOft ? (
            <p className={`${styles.message} ${styles.messageError}`}>{MELDUNG_ZU_OFT}</p>
          ) : state.message ? (
            <p className={`${styles.message} ${state.ok ? styles.messageOk : styles.messageError}`}>
              {state.message}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  )
}
