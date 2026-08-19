"use client"

import { useFormStatus } from "react-dom"
import type { FormState } from "@/lib/auth/types"
import styles from "./account.module.css"

/**
 * Die drei Bausteine, die jedes Formular im Kontobereich braucht.
 *
 * Alle drei sind Client Components — `useFormStatus` liest den Zustand des
 * umschliessenden <form> und kann das nur im Browser.
 */

/** Meldung über dem Formular. `role="status"` liest ein Screenreader vor. */
export function FormMessage({ state }: { state: FormState }) {
  if (state.ok === null || !state.message) return null
  return (
    <p
      className={`${styles.message} ${state.ok ? styles.messageOk : styles.messageError}`}
      role="status"
      // Fehler wollen wir angesagt haben, sobald sie erscheinen.
      aria-live="polite"
    >
      {state.message}
    </p>
  )
}

interface FieldProps {
  name: string
  label: string
  type?: string
  defaultValue?: string
  required?: boolean
  autoComplete?: string
  inputMode?: "text" | "email" | "tel" | "numeric"
  hint?: string
  error?: string
  minLength?: number
}

export function Field({
  name,
  label,
  type = "text",
  defaultValue,
  required,
  autoComplete,
  inputMode,
  hint,
  error,
  minLength,
}: FieldProps) {
  const errorId = `${name}-error`
  const hintId = `${name}-hint`
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={name}>
        {label}
        {required ? "" : " (optional)"}
      </label>
      <input
        className={styles.input}
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        minLength={minLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
      />
      {hint && !error ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={styles.fieldError} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Absendeknopf, der sich während der Übertragung selbst sperrt.
 *
 * Nicht nur Kosmetik: ohne das erzeugt ein Doppelklick auf "Registrieren" zwei
 * Anläufe, von denen der zweite an "Identity with email already exists"
 * scheitert — und der Mensch davor sieht eine Fehlermeldung für etwas, das
 * gerade funktioniert hat.
 */
export function SubmitButton({
  children,
  variant = "primary",
}: {
  children: React.ReactNode
  variant?: "primary" | "secondary"
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      className={variant === "primary" ? styles.primary : styles.secondary}
      disabled={pending}
    >
      {pending ? "Einen Moment …" : children}
    </button>
  )
}
