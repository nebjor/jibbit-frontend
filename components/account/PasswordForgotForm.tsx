"use client"

import { useActionState } from "react"
import { passwortResetAnfordern } from "@/lib/auth/actions"
import { IDLE_FORM_STATE } from "@/lib/auth/types"
import { Field, FormMessage, SubmitButton } from "./FormParts"
import styles from "./account.module.css"

/**
 * "Passwort vergessen".
 *
 * Nach dem Absenden bleibt das Formular stehen und darüber steht immer
 * dieselbe Bestätigung — auch dann, wenn es zu der Adresse gar kein Konto
 * gibt. Wer hier eine Fallunterscheidung einbaut ("Adresse unbekannt"), macht
 * aus dem Formular ein Werkzeug zum Abfragen von Kundenbeständen.
 */
export function PasswordForgotForm() {
  const [state, formAction] = useActionState(passwortResetAnfordern, IDLE_FORM_STATE)

  return (
    <form className={styles.form} action={formAction}>
      <FormMessage state={state} />

      <Field
        name="email"
        label="E-Mail"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        error={state.fieldErrors?.email}
      />

      <div className={styles.actions}>
        <SubmitButton>Link anfordern</SubmitButton>
      </div>
    </form>
  )
}
