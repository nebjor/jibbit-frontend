"use client"

import { useActionState } from "react"
import { abmelden, passwortAendernAnfordern } from "@/lib/auth/actions"
import { IDLE_FORM_STATE } from "@/lib/auth/types"
import { FormMessage, SubmitButton } from "./FormParts"
import styles from "./account.module.css"

/** Abmelden. Ein <form>, damit es auch ohne JavaScript funktioniert. */
export function LogoutForm() {
  return (
    <form action={abmelden}>
      <SubmitButton variant="secondary">Abmelden</SubmitButton>
    </form>
  )
}

/**
 * "Passwort ändern" — schickt eine E-Mail, statt hier ein Feld anzubieten.
 *
 * Das ist keine Bequemlichkeit, sondern die einzige Möglichkeit: Medusas
 * `/auth/customer/emailpass/update` verlangt ein Token mit dem Feld
 * `entity_id`, und das Sitzungs-Token hat dieses Feld nicht. Ausführlich
 * begründet in `lib/auth/actions.ts`.
 */
export function ChangePasswordForm() {
  const [state, formAction] = useActionState(
    async () => passwortAendernAnfordern(),
    IDLE_FORM_STATE,
  )

  return (
    <form className={styles.form} action={formAction}>
      <FormMessage state={state} />
      <p className={styles.hint}>
        Wir schicken dir einen Link an deine hinterlegte Adresse. So ist sichergestellt,
        dass ein neues Passwort nur setzen kann, wer auch Zugriff auf dein Postfach hat.
      </p>
      <div className={styles.actions}>
        <SubmitButton variant="secondary">Passwort ändern</SubmitButton>
      </div>
    </form>
  )
}
