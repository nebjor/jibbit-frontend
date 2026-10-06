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
| MC-WIDGET | https://support.google.com/merchants/answer/7105655 (Store Widget / ehem. Badge einbinden) |

Geprüft am 2026-10-05 (MC-OPTIN, MC-RATING, MC-WIDGET im Volltext; MC-PROD/MC-FAQ über die
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
4. Optional, später: das **Store Widget** (ehemals «Badge») — eingebaut, aber per Schalter
   AUS; wann einschalten, steht in Abschnitt 9.
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

## 9. Store Widget («Badge») — Schalter `GOOGLE_KUNDENREZENSIONEN_BADGE`

Umsetzung: `components/GoogleKundenrezensionenBadge.tsx` (Einbindung, aus `app/layout.tsx`),
`lib/google-kundenrezensionen/badge.ts` (Snippet-Konstanten und die vier Wächter, Tests in
`badge.test.ts`), Schalter in `lib/google-kundenrezensionen/server.ts`. E2E: `e2e/trust.spec.ts`.

**Was Google heute anbietet.** Das frühere «Google Kundenrezensionen»-Badge
(`platform.js?onload=renderBadge`, `gapi.ratingbadge`) ist laut MC-WIDGET **abgelöst**; Google
verlangt, den alten Code zu entfernen. Nachfolger ist das **Store Widget**:
`https://www.gstatic.com/shopping/merchant/merchantwidget.js`, nach dem Laden
`merchantwidget.start({ position, … })`. Es kennt keine Merchant-ID im Code — Google ordnet
die Seite über die im Merchant Center **beanspruchte Domain** zu. Das Widget schwebt als
Google-eigenes Element in einer unteren Ecke (mobil mittig), lässt sich aufklappen (Panel mit
Shopbewertung, Rezensionen, «Store Quality») und nicht schliessen. Je nach Datenlage zeigt es
eine von drei Varianten (Top Quality Store / Store Rating / Store Quality); **ohne genügend
Rezensionen gibt es nichts zu zeigen**, das Widget bleibt dann leer bzw. meldet «nicht
verfügbar».

Weil das Opt-in-Modul (Abschnitt 4) weiterhin `platform.js` nutzt und das Widget ein anderes
Skript ist, gibt es **keinen Konflikt** und keinen gemeinsamen Loader; #60 bleibt unverändert.

**Vier Wächter** — fällt einer, wird das Skript GAR NICHT geladen:

1. `GOOGLE_KUNDENREZENSIONEN_BADGE` ist `1` oder `true` (alles andere = AUS, Standard AUS).
2. `GOOGLE_KUNDENREZENSIONEN_MERCHANT_ID` gesetzt (Programm eingerichtet).
3. Eigene Domain (`tenant.theme.domain === STORE.domain`, also nur `jibbit.ch`).
4. Analyse-Einwilligung erteilt (Abschnitt 5) — `merchantwidget.js` ist ein Google-Drittskript
   und erhebt laut MC-WIDGET aggregierte Nutzungsdaten. Wird die Einwilligung später erteilt,
   lädt das Widget in dem Moment; ein Widerruf wirkt ab dem nächsten Seitenaufruf.

Position: **unten links** (`LEFT_BOTTOM`, Abstand 24 px) — rechts liegen Warenkorb-Button
und Schublade. Mobil zentriert Google das Widget; `mobileBottomMargin: 88` hebt es über die
fixe Kaufleiste der Produktseite (Google: «Don't obscure the widget»).

**Wann der Inhaber einschaltet.** Erst wenn das Merchant Center unter *Google
Kundenrezensionen* bzw. *Store Quality* eine **Shopbewertung ausweist** (MC-RATING: ab rund
100 Rezensionen in 24 Monaten, Schnitt ≥ 3,5). Vorher wäre ein Abzeichen mit «Bewertung nicht
verfügbar» Werbung gegen sich selbst. Einschalten = im Repo `medusa-ecom`, Dienst
`storefront`, `environment:` die Zeile `GOOGLE_KUNDENREZENSIONEN_BADGE=1` ergänzen und neu
starten; es ist keine Code-Änderung nötig. Prüfen: auf jibbit.ch mit «Alle akzeptieren» muss in
den DevTools ein Request an `gstatic.com/shopping/merchant/merchantwidget.js` stehen und unten
links das Widget erscheinen. Fällt die Bewertung später unter die Schwelle, wieder auf `0`.

## 10. Vertrauenszeile im Shop-Kopf (ShopTrust) und Google-Unternehmensprofil

`components/ShopTrust.tsx` steht im Kopf des Katalogs — unter Titel und Beschreibung auf der
Startseite und den Kategorieseiten (`app/page.tsx`) sowie auf der Suchseite
(`app/suche/page.tsx`). Eine kompakte Zeile: links **«★★★★★ 5.0 bei Google · 26
Bewertungen»** (fünf Sterne, gefüllt im Verhältnis zur Bewertung; Link aufs
Unternehmensprofil, neuer Tab, `rel="noopener"`), daneben klein und gedämpft die drei
Fakten **Versand aus der Schweiz · Gratisversand ab CHF 69.00 · Sichere Zahlung**. Mobil
bricht die Faktengruppe unter die Google-Zeile. Async Server-Komponente, kein Client-JS,
nichts springt. Der dunkle Promo-Streifen über der Kopfleiste bleibt, wie er ist.

**Die Texte stehen an genau einer Stelle: `lib/trust.ts`.** Jede Zeile ist eine Zusage und an
ihre Quelle gebunden (`lib/trust.test.ts` prüft das):

| Zeile | Quelle |
|---|---|
| ★★★★★ 5.0 bei Google · 26 Bewertungen | **Google-Unternehmensprofil** «Jibbit .ch - Headshop», Unterwegli 1, Winterthur (Google Maps, öffentlich). Zahlen **nur live** über die Places API (unten); ohne Schlüssel/Place-ID steht «Bewertungen auf Google» **ohne Zahl** |
| Versand aus der Schweiz | `BUSINESS.countryCode` = CH (`lib/config.ts`); FAQ «Wie lange dauert die Lieferung?», `/service/versand` |
| Gratisversand ab CHF 69.00 | `SHIPPING.freeThreshold` (`lib/config.ts`) — derselbe Wert wie Promo-Streifen, Footer, Warenkorb, Backend |
| Sichere Zahlung | `PAYMENT_METHODS` (`lib/config.ts`); gehostete zahls.ch-Bezahlseite (`/service/zahlungsarten`, «Sicherheit») |

### Zwei Google-Bewertungen, sauber getrennt

| | Google-Unternehmensprofil | Google Kundenrezensionen (Merchant Center) |
|---|---|---|
| Was | Bewertung des Ladenlokals/Betriebs auf Google Maps | Shopbewertung aus Umfragen nach Online-Bestellungen (dieses Dokument) |
| Stand 2026-10-05 | 5.0 Sterne, 26 Rezensionen, öffentlich | 0 Rezensionen; Sterne erst ab ~100 in 24 Monaten |
| Im Shop-Kopf | ja — live abgerufene, prüfbare Zahl, Link aufs Profil | nein (nichts anzudeuten); später das Store Widget (Abschnitt 9) |

Die FAQ-Antwort «Kann ich jibbit bewerten?» (`/service/faq#bewertungen`) erklärt beide Wege.

### Woher die Zahl kommt — `lib/google-profil.ts` (Normalweg: Places API)

Es gibt **keine von Hand gepflegte Zahl im Code** — damit nie eine veraltete steht. Die Zahl
kommt serverseitig von der **Places API (New), Place Details**:
`GET https://places.googleapis.com/v1/places/{placeId}?fields=rating,userRatingCount` mit
`X-Goog-Api-Key`, gecacht **6 Stunden** (`unstable_cache`, ≈ 4 Abrufe pro Tag).

Verhalten bei Störungen, in dieser Reihenfolge:

1. **Kein Schlüssel oder keine Place-ID** → Zeile **ohne Zahl**: ein Umriss-Stern und
   «Bewertungen auf Google» als Link. Hinweis im Serverlog `[google-profil] … nicht gesetzt`.
2. **API-Fehler nach einem erfolgreichen Abruf** → der **letzte gute Wert bleibt stehen**:
   die gecachte Funktion wirft bei Fehlern, darum liefert Next den alten Cache-Eintrag weiter
   aus (stale-while-revalidate); zusätzlich merkt sich der Prozess den letzten Wert mit
   Zeitstempel (`lastGood`), falls der Cache-Eintrag selbst weg ist. Log: `… zeige den
   letzten Wert (vor N h)`.
3. **API-Fehler ohne je einen erfolgreichen Abruf** → Zeile ohne Zahl (nie eine erfundene).

Antworten werden streng geprüft (Bewertung 1–5, Anzahl ganzzahlig ≥ 1; 0 Rezensionen gilt
als falsche Place-ID). Tests: `lib/google-profil.test.ts` (gemockter fetch, kein Netz);
E2E: `e2e/trust.spec.ts` gegen eine Places-Attrappe im Mock-Backend
(`GOOGLE_PLACES_ENDPOINT`, nur für Tests).

### Einrichten — Schritt für Schritt für den Inhaber

1. **Google Cloud Console** (https://console.cloud.google.com) → Projekt wählen oder neu
   anlegen (z. B. «jibbit-shop»). Abrechnung muss im Projekt eingerichtet sein (Google
   verlangt das für Places, auch wenn das Freikontingent reicht).
2. **APIs & Dienste → Bibliothek** → «Places API (New)» suchen → **Aktivieren**. (Nicht die
   alte «Places API» ohne «New».)
3. **APIs & Dienste → Anmeldedaten → Anmeldedaten erstellen → API-Schlüssel**. Schlüssel
   kopieren.
4. Schlüssel **einschränken** (Stift-Symbol): *API-Einschränkungen* → «Schlüssel
   einschränken» → nur **Places API (New)**. *Anwendungseinschränkungen*: «Keine» oder
   «IP-Adressen» mit der IP des Servers — der Schlüssel wird nur serverseitig benutzt und
   steht nie im Browser.
5. **Place-ID ermitteln**, lokal im Repo-Verzeichnis:
   ```
   GOOGLE_PLACES_API_KEY=<Schlüssel> npm run google-profil:place-id
   ```
   Das Script sucht «Jibbit Unterwegli 1 Winterthur» (Text Search) und gibt je Treffer
   Place-ID, Name, Adresse und Bewertung aus. Die Place-ID des Ladenlokals übernehmen. Ein
   anderer Suchtext geht als Argument: `npm run google-profil:place-id -- "…"`.
6. Auf dem Server in **`/opt/jibbit/medusa-ecom/.env`** eintragen:
   ```
   GOOGLE_PLACES_API_KEY=<Schlüssel>
   GOOGLE_PLACE_ID=<Place-ID>
   ```
   und sicherstellen, dass beide beim Dienst `storefront` unter `environment:` in der
   Compose-Datei aufgeführt sind (Compose reicht nur weiter, was dort steht).
7. **Storefront neu starten.** Prüfen: im Shop-Kopf stehen Sterne und Zahl; im Serverlog kein
   `[google-profil]`-Hinweis mehr; im HTML der Seite `data-trust-source="places"`.

**Kosten:** Place Details mit `rating`/`userRatingCount` fällt bei Google unter die
«Atmosphere»-/Pro-Felder und wird je Abruf verrechnet. Mit 6 Stunden Cache sind das rund
**4 Abrufe pro Tag (≈ 120 im Monat)** — weit innerhalb des monatlichen Freikontingents, also
praktisch gratis. Das Text-Search-Script wird nur einmal zum Einrichten gebraucht.

### Kein `aggregateRating` im JSON-LD

Googles Richtlinie für Rezensions-Snippets verbietet, Bewertungen, die Google selbst erhoben
hat, als eigene strukturierte Daten auszuzeichnen. `lib/seo/jsonld.ts` enthält deshalb
bewusst **kein** `aggregateRating`/`review`; `lib/trust.test.ts` und `e2e/trust.spec.ts`
prüfen das. Die Zahl steht sichtbar auf der Seite und verlinkt zur Quelle — das genügt.
