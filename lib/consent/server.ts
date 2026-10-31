import "server-only";

import { cookies } from "next/headers";
import {
  AGE_COOKIE,
  CONSENT_COOKIE,
  parseAgeAnswer,
  parseConsent,
  effectiveAge,
  type AgeAnswer,
  type ConsentDecision,
} from "./state";

/**
 * Serverseitiges Lesen der beiden Entscheide — der Schlüssel gegen das
 * Aufblitzen: Der Root-Layout rendert ohnehin pro Request (Tenant-Kontext,
 * Warenkorb), also entscheidet schon das SERVER-HTML, ob die Altersabfrage
 * oder der Cookie-Hinweis im ersten Byte drin ist. Kein Client-Effekt, der
 * nach der Hydration «nachklappt», kein Shop, der eine Zehntelsekunde
 * durchschimmert.
 *
 * NUR LESEN: `cookies().set()` wirft ausserhalb von Server Actions (siehe
 * lib/cart/cookie.ts). Geschrieben werden beide Cookies vom Client
 * (lib/consent/client.ts) — sie sind bewusst nicht httpOnly, denn genau der
 * Client (später: PostHog-Init) muss die Einwilligung lesen können. Es steht
 * nichts Schützenswertes drin: eine Ja/Nein-Antwort und eine Wahl.
 */
export async function readConsentCookies(): Promise<{
  age: AgeAnswer;
  consent: ConsentDecision | null;
}> {
  const store = await cookies();
  return {
    age: effectiveAge(parseAgeAnswer(store.get(AGE_COOKIE)?.value)),
    consent: parseConsent(store.get(CONSENT_COOKIE)?.value),
  };
}
