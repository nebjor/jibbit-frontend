# Google Kundenrezensionen — Opt-in auf der Bestellbestätigung

Stand: 2026-10-05. Umsetzung: `components/GoogleKundenrezensionen.tsx` (Einbindung),
`lib/google-kundenrezensionen/payload.ts` (Nutzlast, Tests in `payload.test.ts`),
`lib/google-kundenrezensionen/server.ts` (Merchant-ID aus der Umgebung), eingebaut in
`app/checkout/bestellung/[id]/page.tsx`. E2E: `e2e/bestellung.spec.ts`.

## 1. Was es tut

Nach einer Bestellung blendet Googles Skript (`apis.google.com/js/platform.js`) auf der
Bestätigungsseite ein kleines Fenster ein: «Möchtest du jibbit nach der Lieferung bewerten?»
Sagt die Kundin ja, schickt Google ihr **nach dem voraussichtlichen Lieferdatum** eine E-Mail
mit der Bewertungsfrage. Die Bewertungen laufen im Merchant Center zusammen
(Add-on «Google Kundenrezensionen») und fliessen in die **Shopbewertung** (Sterne bei
Shopping-Anzeigen, im Shopping-Tab und optional als Badge auf der Seite) ein.

Die Komponente rendert nichts Sichtbares; das Fenster zeichnet Google als Overlay, es braucht
keinen Platz im Layout.

## 2. Quellen

| Kürzel | Seite |
|---|---|
| MC-GCR | https://support.google.com/merchants/answer/7124319 (Google Kundenrezensionen einrichten) |
| MC-OPTIN | https://support.google.com/merchants/answer/7106244 (Opt-in-Modul einbinden) |
| MC-PROD | https://support.google.com/merchants/answer/14632920 (Opt-in um Produktrezensionen erweitern) |
| MC-FAQ | https://support.google.com/merchants/answer/14635620 (FAQ Produktrezensionen) |
| MC-RATING | https://support.google.com/merchants/answer/190657 (Shopbewertungen) |

Geprüft am 2026-10-05 (MC-OPTIN, MC-RATING im Volltext; MC-PROD/MC-FAQ über die
Suchzusammenfassung, die Seiten liefern ohne Anmeldung 404).

## 3. Felder

| Google-Feld | Herkunft | Regel |
|---|---|---|
| `merchant_id` | `GOOGLE_KUNDENREZENSIONEN_MERCHANT_ID` (Laufzeit, Server) | Zahl; fehlt sie, rendert die Komponente nichts |
| `order_id` | `order.display_id` («Bestellung 42») | als String; Rückfall auf die Medusa-ULID, wenn 0 |
| `email` | `order.email` | ohne `@` keine Nutzlast |
| `delivery_country` | `shipping_address.country_code` | ISO-2 gross; leer/ungültig/`ZZ` → `CH` |
| `estimated_delivery_date` | `order.created_at` + `DELIVERY.handlingDaysMax` + `DELIVERY.transitDaysMax` (lib/config.ts) | **Werktage** Mo–Fr, `YYYY-MM-DD`; nie in der Vergangenheit (sonst «heute») |
| `products[].gtin` | `items[].variant.ean/upc/barcode`, Rückfall `variant_barcode` | nur gültige Prüfziffer (`lib/gtin.ts`), ohne Doppelte; Schlüssel fehlt ganz, wenn leer |

MC-OPTIN wörtlich: `order_id` «A unique ID for the order»; `email` «in the format
name@domain.com»; `delivery_country` «ISO 3166-1 alpha-2», nicht `ZZ`; Datum `YYYY-MM-DD`;
«Order details in this module must be accurate to the best of your ability.»
Deshalb das obere Ende der Lieferfrist (heute 3 + 3 = 6 Werktage): eine Umfrage, die vor
dem Paket eintrifft, erzeugt eine schlechte Bewertung für ein Problem, das es nicht gibt.
Feiertage werden nicht gerechnet.

`products` ist optional (MC-PROD). Mit GTIN fragt Google zusätzlich nach dem **Produkt**;
Produktbewertungen zeigt Google ab **drei Rezensionen je Produkt**. Wer nur Shop-Bewertungen
will, entfernt in `payload.ts` die `products`-Zeile.

## 4. Vier Wächter — wann das Skript GAR NICHT geladen wird

1. **Merchant-ID fehlt** (`GOOGLE_KUNDENREZENSIONEN_MERCHANT_ID` leer) → nichts, ein Hinweis
   im Serverlog.
2. **Fremde Domain**: nur wenn `tenant.theme.domain === STORE.domain` (`jibbit.ch`) — dieselbe
   Prüfung wie für die Anbieterkennzeichnung in `lib/seo/jsonld.ts`. Auf **test.jibbit.ch**
   und bei anderen Mandanten wird nichts geladen (sonst würden Testbestellungen zu echten
   Umfragen an echte Adressen, auf jibbits Konto).
3. **Keine Einwilligung** → nichts (Abschnitt 5).
4. **Keine Nutzlast** (keine E-Mail, kein Bestelldatum) → nichts.

Das Skript lädt über `next/script` (`afterInteractive`), also erst nach der Hydration und
nie serverseitig; `window.renderOptIn` wird davor definiert — Google ruft es über den
dokumentierten Haken `?onload=renderOptIn`. Ein Merker verhindert eine zweite Ausführung
(Strict-Mode-Doppelmount, spätere Einwilligungs-Ereignisse). Ein Reload zeigt das Fenster
erneut — Google selbst merkt sich ein «Nein, danke» je Bestellung.

## 5. Einwilligung

Die Einwilligungsschicht (`lib/consent/*`) kennt genau eine wählbare Kategorie: **Analyse**
(`analytics`). `platform.js` ist ein Drittskript von Google, setzt Google-Cookies und
überträgt die E-Mail-Adresse — dieselbe Klasse wie die Webanalyse. Deshalb hängt das Modul an
**derselben Einwilligung**: «Alle akzeptieren» → Modul lädt; «Nur notwendige» oder keine
Wahl → kein Google, keine Einladung. Wird die Einwilligung erst auf der Bestätigungsseite
erteilt, lädt das Modul in dem Moment nach (`onConsentChange`).

Weil die Zustimmung damit **mehr** umfasst als bisher, ist `CONSENT_VERSION` in
`lib/consent/state.ts` von 1 auf 2 erhöht: bestehende Cookies gelten als «nie gefragt», der
Cookie-Hinweis erscheint für alle Besucherinnen **einmal** erneut. Der Hinweistext nennt die
Google-Bewertung jetzt ausdrücklich; die Datenschutzerklärung (`app/datenschutz/page.tsx`,
Ziffern 5–7) beschreibt Empfänger, Felder und Widerruf.

Folge, bewusst in Kauf genommen: Kundinnen, die «Nur notwendige» wählen, werden nie
eingeladen — die Zahl der Rezensionen ist entsprechend kleiner als die der Bestellungen.

## 6. Was der Inhaber im Merchant Center tun muss

1. Merchant Center → **Einstellungen (Zahnrad) → Add-ons → Tab «Discover»** →
   «Google Kundenrezensionen» → **Hinzufügen** (MC-GCR).
2. Tab **«Meine Add-ons» → Zu Google Kundenrezensionen** → Vereinbarung lesen und
   **unterzeichnen**.
3. **Integration einrichten** → das Opt-in-Modul ist mit diesem PR eingebunden; die
   Merchant-ID **5618479597** muss im Repo `medusa-ecom` beim Dienst `storefront` unter
   `environment:` als `GOOGLE_KUNDENREZENSIONEN_MERCHANT_ID` stehen (Compose reicht nur
   weiter, was dort aufgeführt ist) — und zwar **nur in der Produktion**; auf Staging
   schadet sie nicht (Domain-Sperre), bringt aber auch nichts.
4. Optional, später: das **Badge** («Google Kundenrezensionen»-Abzeichen) — ein zweites
   Skript, bewusst nicht Teil dieses PRs; es zeigt erst mit genügend Bewertungen etwas an.
5. Prüfen, dass im Merchant Center dieselbe Domain (`jibbit.ch`) **bestätigt und
   beansprucht** ist, auf der die Bestätigungsseite liegt — Googles Voraussetzung: Warenkorb,
   Kasse und Bestätigung auf der eigenen Domain, HTTPS, `<!DOCTYPE html>` (Next.js setzt
   ihn auf jeder Seite, `app/layout.tsx`).

## 7. Wann Sterne erscheinen

MC-RATING: Google braucht «at least 100 eligible, unique reviews» innerhalb eines rollenden
24-Monats-Fensters, **je Land**, und für die Anzeige in Anzeigen einen Schnitt von
mindestens 3,5 Sternen. Bei jibbits Bestellvolumen ist das ein Ziel über Monate; Rezensionen
sind im Merchant Center unter dem Add-on aber von der ersten an sichtbar. Produktbewertungen
(mit GTIN): ab drei Rezensionen je Produkt (MC-FAQ).

## 8. Testen

Google bietet **keinen Sandbox-Modus**; ein Test-Merchant-Konto gibt es nicht.

- **Lokal / Staging (test.jibbit.ch):** Die Komponente rendert wegen der Domain-Sperre
  nichts — das ist gewollt und in `e2e/bestellung.spec.ts` festgehalten (Merchant-ID in
  `playwright.config.ts` absichtlich gesetzt, Einwilligung erteilt, trotzdem kein Request an
  `apis.google.com`). Die Nutzlast selbst ist in `payload.test.ts` abgedeckt
  (Wochenenden, GTIN-Filter, Länder-Rückfall, fehlende E-Mail).
- **Produktion nach Go-live:** Eine echte Testbestellung auf jibbit.ch mit «Alle akzeptieren».
  Auf der Bestätigungsseite muss (1) in den DevTools unter *Netzwerk* ein Request an
  `apis.google.com/js/platform.js?onload=renderOptIn` stehen, (2) Googles Fenster erscheinen
  («Nach Erhalt der Bestellung eine Umfrage von Google erhalten?»), (3) in der Konsole kein
  Fehler des Moduls stehen. Die übergebene Nutzlast sieht man im Request an
  `www.google.com/shopping/customerreviews/...` (Query-Parameter) oder über
  `window.gapi.surveyoptin` im Debugger. Dann im Modul «Nein, danke» wählen — Google
  erfasst die Bestellung trotzdem im Merchant Center (Add-on → Opt-ins), die Testadresse
  bekommt keine Umfrage.
- Erscheint das Fenster nicht: Reihenfolge der vier Wächter prüfen (Abschnitt 4) — Serverlog
  `[kundenrezensionen] … nicht gesetzt`, Cookie `jibbit_cookie_consent` mit `"analytics":true`
  und `"v":2`, Host exakt `jibbit.ch`/`www.jibbit.ch` (Tenant-Theme-Domain `jibbit.ch`).
