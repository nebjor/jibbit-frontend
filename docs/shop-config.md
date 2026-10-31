# Shop-Konfiguration (White-Label)

Alles, was an **einem** Shop hängt, steht in **einer Datei**: [`shop.config.ts`](../shop.config.ts)
im Repo-Wurzelverzeichnis. Der Typ ist `ShopConfig` in
[`lib/shop-config.ts`](../lib/shop-config.ts). Gelesen wird sie über
[`lib/config.ts`](../lib/config.ts) (`STORE`, `SHIPPING`, `BUSINESS`, `PICKUP`,
`FEATURES` …) — die Importe im Code haben sich dadurch nicht geändert.

Stand Schritt 1: **jibbit.ch verhält sich unverändert**; die Werte in
`shop.config.ts` sind genau die bisherigen.

## Abgrenzung: Shop-Konfiguration und Mandant

| | Shop-Konfiguration (`shop.config.ts`) | Mandant (`TenantConfig`, `lib/tenant/`) |
|---|---|---|
| Gilt für | ein Deployment (Build) | eine Anfrage (nach `Host`) |
| Enthält | Marke, Firma, Versand, Zahlung, Cookies, Schalter, Design | Backend-URL, Publishable Key, Domain, Name, Browserfarbe |
| Quelle | Code | `STATIC_TENANTS` bzw. Control Plane |

Name, Domain und Browserfarbe des Mandanten haben Vorrang für Titel, Canonical
und `<meta name="theme-color">`. Die Shop-Konfiguration liefert die
Voreinstellung (z. B. für `STATIC_TENANTS`-Einträge ohne `themeColor` und für
den lokalen Entwicklungs-Mandanten).

## Neuen Shop einrichten (z. B. stecklingspost.ch)

1. `shop.config.ts` anpassen (oder pro Shop-Deployment eine eigene Fassung der
   Datei verwenden; eine Auswahl per Umgebungsvariable gibt es noch nicht, siehe
   «Offen»).
2. Mandant eintragen: `STATIC_TENANTS` bzw. Control Plane mit `host`,
   `backendUrl`, `publishableKey`, `theme.storeName`, `theme.domain`.
3. Funktionen ein-/ausschalten (`features`), siehe unten.
4. Design anpassen (`theme.tokens`), siehe unten.
5. Offene Inhalte aus der Liste unten ersetzen.

## Was die Konfiguration enthält

| Block | Inhalt | Wird gelesen von |
|---|---|---|
| `id` | Kurzname; Präfix für Events und Storage-Schlüssel (`<id>:consent-changed`, `<id>-intro-seen` …) | Consent, Intro, Aktionsbanner, Analytics |
| `brand` | `name`, `domain`, `tagline`, `titleSuffix`, `locale`, `currency` | Layout (Titel/OG), Footer, Logo, Preisformat, JSON-LD |
| `priceClaim` | Preisversprechen in Kopf/Startseite | Header, Startseite |
| `business` | Firma, Inhaber, Adresse, Telefon, E-Mail | Footer, JSON-LD (nur auf der eigenen Domain), Seiten |
| `shipping` | Tarif, Paketporto, Gratisversand-Grenze | Warenkorb, Kasse, Merchant-Feed, JSON-LD |
| `paymentMethods` | angezeigte Zahlungsarten | Zahlungsicons, Vertrauenszeile |
| `pickup` | Abholung: Adresse, Öffnungszeiten, Hinweis | Kasse, Bestellseite, JSON-LD |
| `delivery`, `returns` | Lieferfristen, Rückgabe (maschinenlesbar) | JSON-LD, Merchant-Feed |
| `minAge` | Mindestalter | Altersabfrage, AGB, Produktseiten |
| `cookies` | `age`, `consent`, `cart` | `lib/consent/*`, `lib/cart/cookie.ts` |
| `googleProfile` | Google-Unternehmensprofil oder `null` | Vertrauenszeile, `scripts/google-place-id.mjs` (dort noch eigener Default) |
| `features` | Schalter, siehe unten | siehe unten |
| `theme` | Browserfarbe und Design-Tokens | `app/layout.tsx`, `lib/theme.ts` |

**Cookie-Namen von jibbit nie ändern** (`jibbit_alterscheck`,
`jibbit_cookie_consent`, `jibbit_cart_id`): sonst gelten bestehende Antworten
und Warenkörbe nicht mehr. Ein neuer Shop wählt eigene Namen (`stecklingspost_…`).

### Schalter (`features`)

| Schalter | Aus bedeutet |
|---|---|
| `ageGate` | keine Altersabfrage; Antwort gilt immer als «adult» (serverseitig und im Client). Die Cookie-Einwilligung bleibt. |
| `intro` | kein Startseiten-Intro (`HomeIntro` wird nicht gerendert) |
| `legacyOdooRedirects` | keine 301/410-Antworten für alte Odoo-Adressen, umbenannte Handles und die zusammengelegte Kategorie |
| `googleReviews` | weder Kundenrezensionen-Opt-in noch Store Widget noch Google-Bewertungszeile |
| `merchantFeed` | `/merchant-feed.tsv` antwortet 404 |

### Design (`theme`)

`app/tokens.css` bleibt die Quelle der Standardwerte. Ein Shop überschreibt
einzelne Variablen:

```ts
theme: { tokens: { "--c-accent": "#2f7d32", "--c-ground": "#eef5ee", "--radius": "8px" } }
```

- Der Root-Layout schreibt sie als ein `<style>` (`:root:root{…}`) in den
  `<head>`. Ohne Überschreibung (jibbit) entsteht kein Element, das HTML ist
  unverändert.
- Es gelten nur Namen der Form `--kleinbuchstaben-und-bindestriche` und Werte
  ohne `; { } < > \ @ /* */`; anderes wird verworfen und geloggt.
- Die Browserfarbe wird nicht doppelt gepflegt: Voreinstellung ist
  `theme.themeColor`, sonst `tokens["--c-ground"]`, sonst der Standard. Der
  Mandant (`TenantConfig.theme.themeColor`) überschreibt nur das Meta-Tag, nicht
  die Seitenfarbe.
- Schriften: eigene `@font-face` und `--font-*` setzen (Schriftdateien liegen
  noch nicht shop-spezifisch im Repo).

## Offen für Schritt 2 (noch jibbit-spezifisch)

**Rechtstexte** (enthalten Firma, Adresse, Sortiment/Altersgrenze, Rückgabe-
regelung; Prosa, nicht aus der Konfiguration):
`app/impressum`, `app/agb`, `app/datenschutz`, `app/widerrufsrecht`,
`app/terms` (Alias von `/agb`, Merchant-Center-URL), dazu `docs/legal-review.md`.

**Service- und Inhaltsseiten:** `app/service/faq`, `kontakt`, `rueckgabe`,
`versand`, `zahlungsarten`; `lib/content/kundenservice.ts`.

**Startseite und Texte:** Beschreibungstext in `app/page.tsx`
(«Papers, Filter und Zubehör …»), Vertrauenszeile (`lib/trust.ts`, `TRUST_FACTS`),
`components/ProduktWunsch.tsx` und weitere Texte rund
um das Headshop-Sortiment, Mock-Katalog (`lib/mock-catalog.ts`).

**Intro und Logo:** `components/intro/*` (Rauchgrafik `SmokeCloud`,
Choreografie `lib/intro/timings.ts`, internes Attribut `data-jibbit-intro`),
`components/Logo.tsx` (Platzhalter-Schriftzug), `components/PixelJoint.tsx` und
`public/loader/*` (Pixel-Art), Icons `app/icon.png`, `app/apple-icon.png`.

**Daten und Werkzeuge mit jibbit-Bezug:** `lib/seo/legacy-redirects.data.json`,
`handle-redirects.data.json` und die Fixtures (bei ausgeschaltetem Schalter
unwirksam), `tools/smoke.mjs`, `tools/seo/probe-jsonld.mjs`,
`scripts/google-place-id.mjs` (eigener Default-Suchtext), `playwright.config.ts`
und `e2e/mock-backend/*` (Testdaten jibbit), `Dockerfile`/`.env.example`, `docs/seo/*`,
`docs/google-kundenrezensionen.md`.

**Mechanik:** Auswahl der Shop-Konfiguration pro Deployment (z. B.
`SHOP_ID` → `shops/<id>.ts`); heute eine Datei pro Build. Die
Konfiguration ist öffentlich (wird auch in Client-Bundles gebündelt) — keine
Geheimnisse hineinschreiben.
