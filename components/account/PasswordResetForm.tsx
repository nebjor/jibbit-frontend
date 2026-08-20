"use client"

import { useActionState } from "react"
import { passwortNeuSetzen } from "@/lib/auth/actions"
import { IDLE_FORM_STATE } from "@/lib/auth/types"
import { PASSWORT_MIN_LAENGE } from "@/lib/auth/messages"
import { Field, FormMessage, SubmitButton } from "./FormParts"
import styles from "./account.module.css"

/**
 * Neues Passwort setzen.
 *
 * Das Token steht in einem versteckten Feld statt in der Action-Signatur.
 * Beides ginge; so bleibt es aber im Formular und wandert nicht durch eine
 * `bind`-Closure, die Next verschlüsselt an den Browser schickt.
 *
 * Es steht damit auch im gerenderten HTML — das ist es aber ohnehin schon,
 * weil es in der Adresszeile steht. Dass ein Reset-Token in der URL landet,
 * ist Medusas Ablauf und lässt sich nicht vermeiden: Browserverlauf und
 * Referrer sind der Preis dafür. Er ist mit 15 Minuten Gültigkeit vertretbar,
 * gehört aber benannt (siehe PR).
 */
export function PasswordResetForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(passwortNeuSetzen, IDLE_FORM_STATE)

  return (
    <form className={styles.form} action={formAction}>
      <FormMessage state={state} />

      <input type="hidden" name="token" value={token} />

      <Field
        name="password"
        label="Neues Passwort"
        type="password"
        required
        autoComplete="new-password"
        minLength={PASSWORT_MIN_LAENGE}
        hint={`Mindestens ${PASSWORT_MIN_LAENGE} Zeichen.`}
        error={state.fieldErrors?.password}
      />
      <Field
        name="password_repeat"
        label="Neues Passwort wiederholen"
        type="password"
        required
        autoComplete="new-password"
        minLength={PASSWORT_MIN_LAENGE}
        error={state.fieldErrors?.password_repeat}
      />

      <div className={styles.actions}>
        <SubmitButton>Passwort speichern</SubmitButton>
      </div>
    </form>
  )
}
