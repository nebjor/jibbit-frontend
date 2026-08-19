"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import type Medusa from "@medusajs/js-sdk"
import { getSdkForTenant, isBackendConfigured } from "@/lib/medusa"
import { getTenantContext } from "@/lib/tenant/context"
import {
  ADRESSE_GELOESCHT,
  ADRESSE_GESPEICHERT,
  ANMELDUNG_FEHLGESCHLAGEN,
  BACKEND_NICHT_ERREICHBAR,
  EMAIL_UNGUELTIG,
  KONTO_BESTEHT_BEREITS,
  NICHT_ANGEMELDET,
  PASSWORT_MIN_LAENGE,
  PASSWORT_RESET_ANGEFORDERT,
  PASSWORT_ZU_KURZ,
  PASSWOERTER_UNGLEICH,
  PROFIL_GESPEICHERT,
  REGISTRIERUNG_FEHLGESCHLAGEN,
  RESET_LINK_ABGELAUFEN,
  RESET_LINK_FEHLT,
} from "./messages"
import { bearer, clearSession, readSessionToken, writeSessionToken } from "./session"
import type { FormState } from "./types"

/**
 * Server Actions für Registrierung, Anmeldung, Passwort und Kontodaten.
 *
 * ══ DER PUNKT, AUF DEN ES HIER ANKOMMT ═══════════════════════════════════
 *
 * Zwei Abläufe dürfen NICHT verraten, ob es zu einer E-Mail-Adresse ein Konto
 * gibt: die Anmeldung und "Passwort vergessen". Medusa hält seine Seite der
 * Abmachung ein — `/auth/customer/emailpass` antwortet in beiden Fällen mit
 * 401 "Invalid email or password", und `/auth/.../reset-password` läuft mit
 * `throwOnError: false` und schickt immer 201.
 *
 * Kaputtmachen kann man das trotzdem, und zwar hier: ein `catch`, das einen
 * Netzwerkfehler anders beantwortet als den Erfolgsfall, baut das Orakel
 * wieder ein — wer nur lange genug probiert, sieht am Unterschied, welche
 * Adresse existiert. Deshalb gibt `passwortResetAnfordern` unter allen
 * Umständen dieselbe Antwort zurück: Konto vorhanden, Konto nicht vorhanden,
 * Backend nicht erreichbar, Ausnahme im SDK. Die Tests in
 * `lib/auth/actions.test.ts` prüfen genau diese vier Zweige gegeneinander.
 *
 * ══ WAS HIER NIE INS LOG DARF ════════════════════════════════════════════
 * Passwörter, Reset-Token, Sitzungstoken — und auch keine E-Mail-Adressen.
 * Deshalb steht in diesem Modul kein einziges `console.*`.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Status eines HTTP-Fehlers aus dem SDK, falls es einer ist. */
function statusOf(err: unknown): number | undefined {
  const status = (err as { status?: unknown })?.status
  return typeof status === "number" ? status : undefined
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === "string" ? value.trim() : ""
}

async function sdkOrNull(): Promise<Medusa | null> {
  const tenant = await getTenantContext()
  if (!isBackendConfigured(tenant)) return null
  return getSdkForTenant(tenant)
}

// ───────────────────────────────────────────────────────────────────────────
// Registrierung
// ───────────────────────────────────────────────────────────────────────────

/**
 * Drei Schritte, weil Medusa Identität und Kundenkonto getrennt führt:
 *
 *   1. `/auth/customer/emailpass/register` legt die Identität an und gibt ein
 *      Registrierungs-Token zurück. Es enthält noch KEINE `actor_id`.
 *   2. `/store/customers` legt mit diesem Token das Kundenkonto an und
 *      verknüpft es (`app_metadata.customer_id`).
 *   3. `/auth/token/refresh` holt ein Token, das die Verknüpfung kennt. Ohne
 *      diesen Schritt hätte die Sitzung keine `actor_id` und jeder Aufruf von
 *      `/store/customers/me` liefe auf 401 — die Anmeldung sähe erfolgreich
 *      aus und wäre es nicht.
 *
 * Absichtlich kein zweites Senden des Passworts: Schritt 3 kommt mit dem
 * Token aus Schritt 1 aus.
 */
export async function registrieren(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = field(formData, "email").toLowerCase()
  const password = String(formData.get("password") ?? "")
  const passwordRepeat = String(formData.get("password_repeat") ?? "")
  const firstName = field(formData, "first_name")
  const lastName = field(formData, "last_name")

  const fieldErrors: Record<string, string> = {}
  if (!EMAIL_RE.test(email)) fieldErrors.email = EMAIL_UNGUELTIG
  if (password.length < PASSWORT_MIN_LAENGE) fieldErrors.password = PASSWORT_ZU_KURZ
  if (password !== passwordRepeat) fieldErrors.password_repeat = PASSWOERTER_UNGLEICH
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors }

  let token: string
  try {
    const sdk = await sdkOrNull()
    if (!sdk) return { ok: false, message: BACKEND_NICHT_ERREICHBAR }

    const registration = await sdk.client.fetch<{ token?: string }>(
      "/auth/customer/emailpass/register",
      { method: "POST", body: { email, password } },
    )
    if (!registration?.token) return { ok: false, message: REGISTRIERUNG_FEHLGESCHLAGEN }

    await sdk.client.fetch("/store/customers", {
      method: "POST",
      body: {
        email,
        ...(firstName ? { first_name: firstName } : {}),
        ...(lastName ? { last_name: lastName } : {}),
      },
      headers: bearer(registration.token),
    })

    const refreshed = await sdk.client.fetch<{ token?: string }>("/auth/token/refresh", {
      method: "POST",
      headers: bearer(registration.token),
    })
    if (!refreshed?.token) return { ok: false, message: REGISTRIERUNG_FEHLGESCHLAGEN }
    token = refreshed.token
  } catch (err) {
    // 401 aus Schritt 1 heisst bei emailpass genau eine Sache: "Identity with
    // email already exists". Dass eine Registrierung die Existenz eines Kontos
    // verrät, lässt sich ohne E-Mail-Bestätigung nicht vermeiden — das Konto
    // kann ja nicht zweimal angelegt werden. Die Meldung führt deshalb zur
    // Anmeldung statt in eine Sackgasse. Siehe PR-Text.
    if (statusOf(err) === 401) return { ok: false, message: KONTO_BESTEHT_BEREITS }
    return { ok: false, message: BACKEND_NICHT_ERREICHBAR }
  }

  await writeSessionToken(token)
  // Ausserhalb des try — `redirect` arbeitet mit einer geworfenen Ausnahme
  // und würde von einem umschliessenden catch verschluckt.
  redirect("/konto")
}

// ───────────────────────────────────────────────────────────────────────────
// Anmeldung / Abmeldung
// ───────────────────────────────────────────────────────────────────────────

export async function anmelden(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = field(formData, "email").toLowerCase()
  const password = String(formData.get("password") ?? "")
  // Wohin nach der Anmeldung. Nur relative Pfade — ein aus dem Formular
  // übernommenes `https://…` wäre eine offene Weiterleitung, mit der sich
  // Phishing-Links tarnen lassen, die auf der echten Shop-Domain beginnen.
  const rawNext = field(formData, "next")
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/konto"

  if (!email || !password) {
    return { ok: false, message: ANMELDUNG_FEHLGESCHLAGEN }
  }

  let token: string
  try {
    const sdk = await sdkOrNull()
    if (!sdk) return { ok: false, message: BACKEND_NICHT_ERREICHBAR }

    // Nicht `sdk.auth.login()`: die Methode legt das Token im gemeinsam
    // genutzten Client ab — siehe lib/auth/session.ts.
    const result = await sdk.client.fetch<{ token?: string }>(
      "/auth/customer/emailpass",
      { method: "POST", body: { email, password } },
    )
    if (!result?.token) return { ok: false, message: ANMELDUNG_FEHLGESCHLAGEN }
    token = result.token
  } catch (err) {
    // 401 kommt bei unbekannter Adresse UND bei falschem Passwort — Medusas
    // emailpass-Provider gibt in beiden Fällen wortgleich "Invalid email or
    // password" zurück. Beides landet deshalb auf derselben Meldung.
    if (statusOf(err) === 401) return { ok: false, message: ANMELDUNG_FEHLGESCHLAGEN }
    return { ok: false, message: BACKEND_NICHT_ERREICHBAR }
  }

  await writeSessionToken(token)
  redirect(next)
}

/**
 * Abmelden heisst hier: das Cookie wegwerfen.
 *
 * Es gibt nichts, was das Backend dabei zu tun hätte — die Sitzung ist ein
 * JWT, kein Serverzustand. Umgekehrt heisst das aber auch: das ausgegebene
 * Token bleibt bis zu seinem Ablauf technisch gültig. Wer es vorher abgegriffen
 * hat, ist von einer Abmeldung nicht betroffen. Ein echter Rückruf bräuchte
 * eine Sperrliste im Backend; das ist bewusst nicht gebaut und steht im PR.
 */
export async function abmelden(): Promise<void> {
  await clearSession()
  redirect("/")
}

// ───────────────────────────────────────────────────────────────────────────
// Passwort zurücksetzen
// ───────────────────────────────────────────────────────────────────────────

/**
 * Fordert die E-Mail an — und antwortet IMMER gleich.
 *
 * Jeder Zweig unterhalb der Syntaxprüfung endet auf demselben Objekt. Wer hier
 * einen Fehlerfall gesondert beantwortet, baut das Konten-Orakel wieder ein.
 */
export async function passwortResetAnfordern(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = field(formData, "email").toLowerCase()

  // Die Syntaxprüfung darf abweichen: sie beurteilt die Eingabe, nicht das
  // Konto. "keine gültige Adresse" sagt über keinen Kontobestand etwas aus.
  if (!EMAIL_RE.test(email)) {
    return { ok: false, fieldErrors: { email: EMAIL_UNGUELTIG } }
  }

  try {
    const sdk = await sdkOrNull()
    if (sdk) {
      await sdk.client.fetch("/auth/customer/emailpass/reset-password", {
        method: "POST",
        body: { identifier: email },
        // Die Route antwortet mit 201 und leerem Body; ohne diesen Header
        // versucht der Client, "Created" als JSON zu lesen.
        headers: { accept: "text/plain" },
      })
    }
  } catch {
    // Absichtlich verschluckt und absichtlich nicht protokolliert. Ein
    // fehlgeschlagener Versand darf sich nach aussen nicht von einem
    // erfolgreichen unterscheiden.
  }

  return { ok: true, message: PASSWORT_RESET_ANGEFORDERT }
}

/** Setzt das neue Passwort mit dem Token aus der E-Mail. */
export async function passwortNeuSetzen(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = String(formData.get("token") ?? "")
  const password = String(formData.get("password") ?? "")
  const passwordRepeat = String(formData.get("password_repeat") ?? "")

  if (!token) return { ok: false, message: RESET_LINK_FEHLT }

  const fieldErrors: Record<string, string> = {}
  if (password.length < PASSWORT_MIN_LAENGE) fieldErrors.password = PASSWORT_ZU_KURZ
  if (password !== passwordRepeat) fieldErrors.password_repeat = PASSWOERTER_UNGLEICH
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors }

  try {
    const sdk = await sdkOrNull()
    if (!sdk) return { ok: false, message: BACKEND_NICHT_ERREICHBAR }

    await sdk.client.fetch("/auth/customer/emailpass/update", {
      method: "POST",
      body: { password },
      headers: bearer(token),
    })
  } catch (err) {
    // 401 heisst: Token abgelaufen (Medusa gibt ihm 15 Minuten), manipuliert,
    // oder es gehört zu keiner Identität mehr.
    if (statusOf(err) === 401) return { ok: false, message: RESET_LINK_ABGELAUFEN }
    return { ok: false, message: BACKEND_NICHT_ERREICHBAR }
  }

  // Bewusst KEINE automatische Anmeldung: das würde bedeuten, dass ein Link
  // aus einem E-Mail-Postfach unmittelbar eine Sitzung erzeugt. Nach dem
  // Setzen einmal das neue Passwort eingeben zu müssen, ist die
  // Bestätigung, dass es auch angekommen ist.
  redirect("/konto/anmelden?gesetzt=1")
}

/**
 * "Passwort ändern" aus dem eingeloggten Kontobereich — führt bewusst über
 * dieselbe E-Mail wie "Passwort vergessen".
 *
 * WARUM NICHT DIREKT: Medusas `/auth/customer/emailpass/update` verlangt ein
 * Token mit dem Feld `entity_id`. Das Sitzungs-Token hat dieses Feld nicht —
 * `generateJwtTokenForAuthIdentity` schreibt `actor_id`, `actor_type`,
 * `auth_identity_id`, `app_metadata`, `user_metadata` und sonst nichts. Die
 * Middleware `validateToken()` lehnt es deshalb ab. Ein Passwortwechsel im
 * Konto geht in Medusa v2.13 nur über den Reset-Weg.
 *
 * Nebenbei ist das die sicherere Variante: ein an einem offenen Laptop
 * geändertes Passwort bräuchte sonst kein zweites Merkmal.
 */
export async function passwortAendernAnfordern(): Promise<FormState> {
  const token = await readSessionToken()
  if (!token) return { ok: false, message: NICHT_ANGEMELDET }

  try {
    const sdk = await sdkOrNull()
    if (!sdk) return { ok: false, message: BACKEND_NICHT_ERREICHBAR }

    const { customer } = await sdk.store.customer.retrieve(
      { fields: "email" },
      bearer(token),
    )
    if (!customer?.email) return { ok: false, message: NICHT_ANGEMELDET }

    await sdk.client.fetch("/auth/customer/emailpass/reset-password", {
      method: "POST",
      body: { identifier: customer.email },
      headers: { accept: "text/plain" },
    })
  } catch {
    return { ok: false, message: BACKEND_NICHT_ERREICHBAR }
  }

  return { ok: true, message: PASSWORT_RESET_ANGEFORDERT }
}

// ───────────────────────────────────────────────────────────────────────────
// Profil
// ───────────────────────────────────────────────────────────────────────────

export async function profilSpeichern(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await readSessionToken()
  if (!token) return { ok: false, message: NICHT_ANGEMELDET }

  // Die E-Mail-Adresse ist hier bewusst NICHT änderbar: sie ist zugleich die
  // `entity_id` der Auth-Identität. Sie am Kunden zu ändern, ohne die
  // Identität mitzuziehen, führt zu einem Konto, an dem die Anmeldung noch mit
  // der alten Adresse geht und der Reset-Link an die neue — ein Zustand, den
  // niemand mehr sauber auflöst. Adresswechsel gehört in einen eigenen,
  // bestätigten Ablauf.
  const body = {
    first_name: field(formData, "first_name") || null,
    last_name: field(formData, "last_name") || null,
    phone: field(formData, "phone") || null,
    company_name: field(formData, "company_name") || null,
  }

  try {
    const sdk = await sdkOrNull()
    if (!sdk) return { ok: false, message: BACKEND_NICHT_ERREICHBAR }
    await sdk.store.customer.update(body, {}, bearer(token))
  } catch (err) {
    if (statusOf(err) === 401) return { ok: false, message: NICHT_ANGEMELDET }
    return { ok: false, message: BACKEND_NICHT_ERREICHBAR }
  }

  revalidatePath("/konto/profil")
  revalidatePath("/konto")
  return { ok: true, message: PROFIL_GESPEICHERT }
}

// ───────────────────────────────────────────────────────────────────────────
// Adressbuch
// ───────────────────────────────────────────────────────────────────────────

/**
 * Anlegen oder Ändern, je nachdem ob das Formular eine `address_id` mitbringt.
 *
 * PLZ und Ort sind Pflicht — nicht nur der Form halber: das Backend hat in
 * `src/api/middlewares.ts` eine eigene Prüfung auf `postal_code` (min. 4) und
 * `city` für `POST /store/customers/me/addresses`. Ohne die beiden Felder
 * antwortet es mit 400, und zwar auf Englisch.
 */
export async function adresseSpeichern(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await readSessionToken()
  if (!token) return { ok: false, message: NICHT_ANGEMELDET }

  const addressId = field(formData, "address_id")
  const postalCode = field(formData, "postal_code")
  const city = field(formData, "city")
  const address1 = field(formData, "address_1")

  const fieldErrors: Record<string, string> = {}
  if (address1.length < 2) fieldErrors.address_1 = "Bitte gib Strasse und Nummer an."
  if (postalCode.length < 4) fieldErrors.postal_code = "Bitte gib eine gültige Postleitzahl an."
  if (!city) fieldErrors.city = "Bitte gib den Ort an."
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors }

  const body = {
    address_name: field(formData, "address_name") || undefined,
    first_name: field(formData, "first_name") || undefined,
    last_name: field(formData, "last_name") || undefined,
    company: field(formData, "company") || undefined,
    address_1: address1,
    address_2: field(formData, "address_2") || undefined,
    postal_code: postalCode,
    city,
    // Die Storefront liefert in die Schweiz und ins Fürstentum Liechtenstein.
    // Das Feld ist ein <select>, der Wert wird trotzdem geprüft: ein
    // Formularfeld ist eine Behauptung des Browsers, keine Zusicherung.
    country_code: ["ch", "li"].includes(field(formData, "country_code").toLowerCase())
      ? field(formData, "country_code").toLowerCase()
      : "ch",
    phone: field(formData, "phone") || undefined,
    is_default_shipping: formData.get("is_default_shipping") === "on",
    is_default_billing: formData.get("is_default_billing") === "on",
  }

  try {
    const sdk = await sdkOrNull()
    if (!sdk) return { ok: false, message: BACKEND_NICHT_ERREICHBAR }

    if (addressId) {
      await sdk.store.customer.updateAddress(addressId, body, {}, bearer(token))
    } else {
      await sdk.store.customer.createAddress(body, {}, bearer(token))
    }
  } catch (err) {
    if (statusOf(err) === 401) return { ok: false, message: NICHT_ANGEMELDET }
    return { ok: false, message: BACKEND_NICHT_ERREICHBAR }
  }

  revalidatePath("/konto/adressen")
  return { ok: true, message: ADRESSE_GESPEICHERT }
}

export async function adresseLoeschen(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await readSessionToken()
  if (!token) return { ok: false, message: NICHT_ANGEMELDET }

  const addressId = field(formData, "address_id")
  if (!addressId) return { ok: false, message: BACKEND_NICHT_ERREICHBAR }

  try {
    const sdk = await sdkOrNull()
    if (!sdk) return { ok: false, message: BACKEND_NICHT_ERREICHBAR }
    // Das Backend prüft die Zugehörigkeit selbst — eine fremde Adress-ID
    // führt zu 404/401, nicht zum Löschen. Verlassen wir uns darauf, aber
    // nicht blind: die ID kommt aus dem Formular und ist damit beliebig.
    await sdk.store.customer.deleteAddress(addressId, bearer(token))
  } catch (err) {
    if (statusOf(err) === 401) return { ok: false, message: NICHT_ANGEMELDET }
    return { ok: false, message: BACKEND_NICHT_ERREICHBAR }
  }

  revalidatePath("/konto/adressen")
  return { ok: true, message: ADRESSE_GELOESCHT }
}
