"use client"

import { useActionState } from "react"
import { profilSpeichern } from "@/lib/auth/actions"
import { IDLE_FORM_STATE, type CustomerView } from "@/lib/auth/types"
import { Field, FormMessage, SubmitButton } from "./FormParts"
import styles from "./account.module.css"

export function ProfileForm({ customer }: { customer: CustomerView }) {
  const [state, formAction] = useActionState(profilSpeichern, IDLE_FORM_STATE)

  return (
    <form className={styles.form} action={formAction}>
      <FormMessage state={state} />

      <div className={styles.field}>
        <span className={styles.label}>E-Mail</span>
        <p>{customer.email}</p>
        <p className={styles.hint}>
          Die E-Mail-Adresse ist zugleich dein Anmeldename und lässt sich hier nicht
          ändern. Schreib uns, wenn du eine neue brauchst — wir stellen sie um, ohne
          dass deine Bestellungen verloren gehen.
        </p>
      </div>

      <div className={`${styles.row} ${styles.row2}`}>
        <Field
          name="first_name"
          label="Vorname"
          defaultValue={customer.firstName}
          autoComplete="given-name"
        />
        <Field
          name="last_name"
          label="Nachname"
          defaultValue={customer.lastName}
          autoComplete="family-name"
        />
      </div>

      <Field
        name="company_name"
        label="Firma"
        defaultValue={customer.companyName}
        autoComplete="organization"
      />
      <Field
        name="phone"
        label="Telefon"
        type="tel"
        defaultValue={customer.phone}
        autoComplete="tel"
        inputMode="tel"
        hint="Nur für Rückfragen zur Lieferung. Du musst nichts angeben."
      />

      <div className={styles.actions}>
        <SubmitButton>Speichern</SubmitButton>
      </div>
    </form>
  )
}
