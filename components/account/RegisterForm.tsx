"use client"

import { useActionState } from "react"
import { registrieren } from "@/lib/auth/actions"
import { IDLE_FORM_STATE } from "@/lib/auth/types"
import { PASSWORT_MIN_LAENGE } from "@/lib/auth/messages"
import { Field, FormMessage, SubmitButton } from "./FormParts"
import styles from "./account.module.css"

/**
 * Registrierung.
 *
 * Erhoben wird nur, was der Shop wirklich braucht: Adresse, Passwort, und
 * optional der Name für die Anrede. Kein Geburtsdatum, keine Telefonnummer,
 * kein Newsletter-Häkchen — Datensparsamkeit nach DSG Art. 6 heisst, gar nicht
 * erst zu fragen. Die Lieferadresse entsteht bei der ersten Bestellung.
 */
export function RegisterForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(registrieren, IDLE_FORM_STATE)

  return (
    <form className={styles.form} action={formAction}>
      <FormMessage state={state} />

      {/* Wohin nach der Registrierung — z. B. zurück in die Kasse. Die
          Action nimmt nur relative Pfade an. */}
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className={`${styles.row} ${styles.row2}`}>
        <Field name="first_name" label="Vorname" autoComplete="given-name" />
        <Field name="last_name" label="Nachname" autoComplete="family-name" />
      </div>

      <Field
        name="email"
        label="E-Mail"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        hint="Hierhin gehen Bestellbestätigungen und der Link zum Zurücksetzen des Passworts."
        error={state.fieldErrors?.email}
      />
      <Field
        name="password"
        label="Passwort"
        type="password"
        required
        autoComplete="new-password"
        minLength={PASSWORT_MIN_LAENGE}
        hint={`Mindestens ${PASSWORT_MIN_LAENGE} Zeichen.`}
        error={state.fieldErrors?.password}
      />
      <Field
        name="password_repeat"
        label="Passwort wiederholen"
        type="password"
        required
        autoComplete="new-password"
        minLength={PASSWORT_MIN_LAENGE}
        error={state.fieldErrors?.password_repeat}
      />

      <div className={styles.actions}>
        <SubmitButton>Konto anlegen</SubmitButton>
      </div>
    </form>
  )
}
