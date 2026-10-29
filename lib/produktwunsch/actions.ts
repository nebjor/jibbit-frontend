"use server"

import { headers } from "next/headers"
import { getSdkForTenant, isBackendConfigured } from "@/lib/medusa"
import { getTenantContext } from "@/lib/tenant/context"
import {
  MELDUNG_ERFOLG,
  MELDUNG_FEHLER,
  besucherAdresse,
  meldungFuerStatus,
  pruefeProduktwunsch,
} from "./validate"
import type { WunschState } from "./types"

/**
 * Server Action des Formulars «Nicht gefunden, was du suchst?».
 *
 * Prüft die Eingabe und reicht sie mit dem serverseitigen Medusa-Client
 * (Publishable Key) an `POST /store/produktwunsch` weiter. Die Backend-Adresse
 * und der Schlüssel bleiben auf dem Server. Wunsch und E-Mail-Adresse stehen
 * nie im Log: dieses Modul enthält deshalb kein `console.*`.
 */

function feld(formData: FormData, name: string): string {
  const v = formData.get(name)
  return typeof v === "string" ? v : ""
}

export async function produktwunschSenden(_prev: WunschState, formData: FormData): Promise<WunschState> {
  const pruefung = pruefeProduktwunsch({
    wunsch: feld(formData, "wunsch"),
    email: feld(formData, "email"),
    kategorie: feld(formData, "kategorie"),
    suche: feld(formData, "suche"),
    url: feld(formData, "url"),
    website: feld(formData, "website"),
  })

  if (pruefung.art === "spam") return { ok: true, message: MELDUNG_ERFOLG }
  if (pruefung.art === "ungueltig") return { ok: false, fieldErrors: pruefung.fieldErrors }

  try {
    const tenant = await getTenantContext()
    if (!isBackendConfigured(tenant)) return { ok: false, message: MELDUNG_FEHLER }

    const h = await headers()
    const adresse = besucherAdresse(h.get("x-real-ip"), h.get("x-forwarded-for"))

    await getSdkForTenant(tenant).client.fetch("/store/produktwunsch", {
      method: "POST",
      body: pruefung.payload,
      headers: {
        // Antwort ist 204 ohne Inhalt; ohne diesen Header läse der Client JSON.
        accept: "text/plain",
        ...(adresse ? { "x-jibbit-client-ip": adresse } : {}),
      },
    })
    return { ok: true, message: MELDUNG_ERFOLG }
  } catch (err) {
    const status = (err as { status?: unknown })?.status
    return { ok: false, message: meldungFuerStatus(typeof status === "number" ? status : undefined) }
  }
}
