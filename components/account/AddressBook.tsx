"use client"

import { useActionState } from "react"
import { adresseLoeschen, adresseSpeichern } from "@/lib/auth/actions"
import { IDLE_FORM_STATE, type AddressView } from "@/lib/auth/types"
import { Field, FormMessage, SubmitButton } from "./FormParts"
import styles from "./account.module.css"

/**
 * Adressbuch: Liste, Bearbeiten, Löschen, Neu.
 *
 * Jede Adresse bekommt ein eigenes <form> mit ihrer ID in einem versteckten
 * Feld. Das Backend prüft die Zugehörigkeit selbst — eine fremde ID führt zu
 * 401/404, nicht zu einem Zugriff auf fremde Daten.
 *
 * PLZ und Ort sind Pflicht, weil das Backend sie in `src/api/middlewares.ts`
 * für `POST /store/customers/me/addresses` erzwingt (min. 4 Zeichen PLZ). Ohne
 * sie käme eine englische 400er-Meldung zurück.
 */

const LAENDER = [
  { code: "ch", label: "Schweiz" },
  { code: "li", label: "Liechtenstein" },
]

function AddressFields({ address }: { address?: AddressView }) {
  const s = address
  return (
    <>
      <Field
        name="address_name"
        label="Bezeichnung"
        defaultValue={s?.label}
        hint="Zum Wiedererkennen, z.B. «Zuhause» oder «Büro»."
      />
      <div className={`${styles.row} ${styles.row2}`}>
        <Field
          name="first_name"
          label="Vorname"
          defaultValue={s?.firstName}
          autoComplete="given-name"
        />
        <Field
          name="last_name"
          label="Nachname"
          defaultValue={s?.lastName}
          autoComplete="family-name"
        />
      </div>
      <Field
        name="company"
        label="Firma"
        defaultValue={s?.company}
        autoComplete="organization"
      />
      <Field
        name="address_1"
        label="Strasse und Nummer"
        required
        defaultValue={s?.address1}
        autoComplete="address-line1"
      />
      <Field
        name="address_2"
        label="Zusatz"
        defaultValue={s?.address2}
        autoComplete="address-line2"
        hint="c/o, Postfach, Stockwerk."
      />
    </>
  )
}

/**
 * Nach dem Speichern bleibt das Formular offen und die Bestätigung stehen —
 * ein Formular, das sich selbst zuklappt, nimmt die Rückmeldung mit, bevor sie
 * jemand gelesen hat. Die Liste darüber ist durch `revalidatePath` in der
 * Action bereits aktuell.
 */
function AddressForm({ address }: { address?: AddressView }) {
  const [state, formAction] = useActionState(adresseSpeichern, IDLE_FORM_STATE)

  return (
    <form className={styles.form} action={formAction}>
      <FormMessage state={state} />
      {address ? <input type="hidden" name="address_id" value={address.id} /> : null}

      <AddressFields address={address} />

      <div className={`${styles.row} ${styles.rowPlz}`}>
        <Field
          name="postal_code"
          label="PLZ"
          required
          defaultValue={address?.postalCode}
          autoComplete="postal-code"
          inputMode="numeric"
          error={state.fieldErrors?.postal_code}
        />
        <Field
          name="city"
          label="Ort"
          required
          defaultValue={address?.city}
          autoComplete="address-level2"
          error={state.fieldErrors?.city}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="country_code">
          Land
        </label>
        <select
          className={styles.input}
          id="country_code"
          name="country_code"
          defaultValue={address?.countryCode ?? "ch"}
          autoComplete="country"
        >
          {LAENDER.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <Field
        name="phone"
        label="Telefon"
        type="tel"
        defaultValue={address?.phone}
        autoComplete="tel"
        inputMode="tel"
      />

      <label className={styles.checkbox}>
        <input
          type="checkbox"
          name="is_default_shipping"
          defaultChecked={address?.isDefaultShipping}
        />
        Als Standard-Lieferadresse verwenden
      </label>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          name="is_default_billing"
          defaultChecked={address?.isDefaultBilling}
        />
        Als Standard-Rechnungsadresse verwenden
      </label>

      <div className={styles.actions}>
        <SubmitButton>{address ? "Änderungen speichern" : "Adresse hinzufügen"}</SubmitButton>
      </div>
    </form>
  )
}

function DeleteForm({ address }: { address: AddressView }) {
  const [state, formAction] = useActionState(adresseLoeschen, IDLE_FORM_STATE)

  return (
    <form action={formAction}>
      <input type="hidden" name="address_id" value={address.id} />
      <FormMessage state={state} />
      <button type="submit" className={`${styles.secondary} ${styles.danger}`}>
        Löschen
      </button>
    </form>
  )
}

export function AddressBook({ addresses }: { addresses: AddressView[] }) {
  return (
    <>
      {addresses.length === 0 ? (
        <p>
          Noch keine Adresse hinterlegt. Du kannst hier eine speichern oder sie beim
          Bestellen eingeben — beides geht.
        </p>
      ) : (
        <div className={styles.addressGrid}>
          {addresses.map((a) => (
            <article key={a.id} className={styles.addressCard}>
              <h3 className={styles.addressName}>{a.label || "Adresse"}</h3>

              {a.isDefaultShipping || a.isDefaultBilling ? (
                <div className={styles.badges}>
                  {a.isDefaultShipping ? <span className={styles.badge}>Lieferung</span> : null}
                  {a.isDefaultBilling ? <span className={styles.badge}>Rechnung</span> : null}
                </div>
              ) : null}

              <address className={styles.addressBody}>
                {[a.firstName, a.lastName].filter(Boolean).join(" ")}
                {a.company ? (
                  <>
                    <br />
                    {a.company}
                  </>
                ) : null}
                <br />
                {a.address1}
                {a.address2 ? (
                  <>
                    <br />
                    {a.address2}
                  </>
                ) : null}
                <br />
                {a.postalCode} {a.city}
                <br />
                {LAENDER.find((l) => l.code === a.countryCode)?.label ??
                  a.countryCode.toUpperCase()}
              </address>

              <details className={styles.disclosure}>
                <summary>Bearbeiten</summary>
                <div className={styles.disclosureBody}>
                  <AddressForm address={a} />
                </div>
              </details>

              <DeleteForm address={a} />
            </article>
          ))}
        </div>
      )}

      <details className={styles.disclosure}>
        <summary>Neue Adresse hinzufügen</summary>
        <div className={styles.disclosureBody}>
          <AddressForm />
        </div>
      </details>
    </>
  )
}
