"use client"

import { useActionState } from "react"
import Link from "next/link"
import { anmelden } from "@/lib/auth/actions"
import { IDLE_FORM_STATE } from "@/lib/auth/types"
import { Field, FormMessage, SubmitButton } from "./FormParts"
import styles from "./account.module.css"

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(anmelden, IDLE_FORM_STATE)

  return (
    <form className={styles.form} action={formAction}>
      <FormMessage state={state} />

      {/* Wohin nach der Anmeldung. Die Action nimmt nur relative Pfade an. */}
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field
        name="email"
        label="E-Mail"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        error={state.fieldErrors?.email}
      />
      <Field
        name="password"
        label="Passwort"
        type="password"
        required
        autoComplete="current-password"
        error={state.fieldErrors?.password}
      />

      <div className={styles.actions}>
        <SubmitButton>Anmelden</SubmitButton>
        <Link href="/konto/passwort-vergessen">Passwort vergessen?</Link>
      </div>
    </form>
  )
}
