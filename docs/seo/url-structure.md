# URL-Struktur und Umzug der Odoo-Adressen

Stand: 2026-09-29. Umsetzung: `lib/seo/legacy-redirects.ts`, `lib/seo/canonical-path.ts`,
`proxy.ts`, `app/sitemap.ts` (Tests jeweils daneben, dazu `e2e/routing.spec.ts`).
Referenzdaten: `medusa-ecom/data/odoo-redirects.json`.

> **Nachtrag vom selben Tag.** Die Handles sind im Admin umbenannt, die Zuordnung ist
> nachgezogen und um die Adressen aus der Search Console ergänzt. Der heutige Stand der
> Zuordnung, der Sitemap und des Feeds steht in
> [`sitemap-und-merchant-center.md`](sitemap-und-merchant-center.md). Wo die beiden
> Dokumente sich widersprechen, gilt jenes. Überholt sind hier: die Tabelle
> «Empfohlene Handle-Änderungen» (Stand je Zeile dort nachgetragen), die Ziele der
> Odoo-IDs 2, 10, 23, 36, 40, 47, 48, 49, 60 und die Punkte «Sitemap über 100 Produkte»
> und «Echtes `lastmod`» unter «Nicht umgesetzt».

## Kurzfassung

- **Mehr Long-Tail-Keywords in der URL bringen nichts Messbares.** Google selbst:
  Keywords im Pfad haben «hardly any effect beyond appearing in breadcrumbs». Die
  heutigen Handles (Marke, Produkt, Mass) sind bereits richtig. Keine Slugs aufblähen.
- **Stabile Adressen sind mehr wert als bessere Adressen.** Jede Umbenennung kostet
  eine Weiterleitung und Wochen der Neubewertung. Geändert wird nur, was falsch ist
  (vier Produkt-Handles, zwei Kategorie-Handles, siehe Tabelle) — und zwar **vor** dem
  Go-live, solange noch nichts davon indexiert ist.
- **Der eigentliche Hebel ist der Umzug:** jede alte Odoo-Adresse muss in einem Sprung
  mit 301 auf die passende neue Seite. Das war bereits angelegt, hatte aber Lücken
  (unten, «Befunde»). Sie sind geschlossen.

## Fragen und Antworten aus der Recherche

| Frage | Antwort | Quelle |
|---|---|---|
| Helfen Keywords im Slug beim Ranking? | Kaum. «From a ranking perspective, the keywords in the name of the domain (or URL path) alone have hardly any effect beyond appearing in breadcrumbs.» John Mueller nennt Wörter in der URL einen «very, very lightweight» Faktor, der vor allem zählt, solange Google den Inhalt noch nicht kennt. | [SEO Starter Guide][starter] (Stand 2025-12-10); [Search Engine Journal][sej]; [Search Engine Roundtable][ser] |
| Sollen trotzdem Wörter drinstehen? | Ja, für Menschen: «use readable words rather than long ID numbers». Empfohlen ist `/product/black-t-shirt-with-a-white-collar`, nicht `/product/3243`. | [URL structure][url]; [Ecommerce URL structure][ecom] |
| Wie lang? | Für das Ranking egal, für Menschen kurz. Die Handles hier haben 3–7 Wörter; das ist der Bereich, den auch die Branchenquellen nennen. | [Search Engine Land][sel]; Mueller laut [SER][ser] |
| Schreibweise | Bindestriche statt Unterstriche, Sprache des Publikums, Umlaute transliteriert oder prozentkodiert. Gross/klein ist für Google ein Unterschied; wo der Server beides gleich behandelt, auf eine Schreibweise vereinheitlichen. | [URL structure][url]; [Ecommerce URL structure][ecom] |
| Kategorie im Produktpfad (`/papers/ocb-…`)? | Nein. Google verlangt es nicht; ein Produkt, das die Kategorie wechselt oder in zweien liegt, bekäme sonst eine neue oder eine zweite Adresse. Flaches `/products/<handle>` ist die stabile Form. Die Kategorie steht im Brotkrümel-Markup. | [Ecommerce URL structure][ecom]; [Starter Guide][starter] (Brotkrümel per strukturierten Daten) |
| Numerische ID in der URL? | Nicht nötig. Odoo brauchte sie zum Auflösen; Medusa löst über den Handle auf. Beim Umzug ist die alte ID aber der einzige verlässliche Schlüssel. | [URL structure][url] |
| Schrägstrich am Ende | Beides ist zulässig, aber nur eine Form darf 200 liefern. Hier: ohne; mit Schrägstrich → 308 (Next-Standard). | [Canonicalization][canon] |
| Filter-, Sortier-, Suchparameter | `?key=value` mit `&` ist in Ordnung. Dubletten werden über 301 und `rel=canonical` zusammengeführt, **nicht** über robots.txt («Don't use the robots.txt file for canonicalization purposes») und nicht über noindex innerhalb der Site. robots.txt-Sperren für Facetten sind ein Mittel gegen Crawl-Last bei grossen Katalogen. | [Canonicalization][canon] (Stand 2026-07-10); [Faceted navigation][facet] |
| Sprachpfade `/fr_CH/`, `/it/`, `/en/` | Der neue Shop ist einsprachig (`<html lang="de-CH">`, keine Locale-Routen). hreflang gilt nur, wo es mehrere Sprachfassungen gibt, und nur gegenseitig. Also: kein hreflang, alte Sprachpfade per 301 auf die deutsche Seite. | [Localized versions][hreflang] (Stand 2026-09-21); [Site move][move] |
| Umzug | 301 je alte URL auf die passende neue, keine Ketten, nicht viele alte URLs auf die Startseite («might be treated as a soft 404»), Weiterleitungen mindestens ein Jahr halten. Das Adressänderungs-Tool der Search Console ist **nur** für Domainwechsel. | [Site move with URL changes][move] (Stand 2026-08-20) |
| `<lastmod>` in der Sitemap | Wird nur verwendet, wenn es nachweislich stimmt; `priority` und `changefreq` ignoriert Google. | [Build a sitemap][sitemap] |

[starter]: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
[url]: https://developers.google.com/search/docs/crawling-indexing/url-structure
[ecom]: https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites
[facet]: https://developers.google.com/search/docs/crawling-indexing/crawling-managing-faceted-navigation
[canon]: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
[move]: https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes
[hreflang]: https://developers.google.com/search/docs/specialty/international/localized-versions
[sitemap]: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
[sej]: https://www.searchenginejournal.com/ranking-factors/urls/
[ser]: https://www.seroundtable.com/google-urls-minimal-additional-signals-for-search-engines-38680.html
[sel]: https://searchengineland.com/seo-friendly-urls-what-you-need-to-know-457531

## Befunde

### Der alte Shop (jibbit.ch, Odoo) — geprüft per Abruf am 2026-09-29

- Adressen haben die Form `/shop/<slug>-<id>`. Odoo löst **nur über die ID** auf:
  `/shop/x-36` führt auf dasselbe Produkt wie jeder frühere Slug. Deshalb stehen in
  der Search Console mehrere Slugs je Produkt («filer»/«filter», «xtra»/«super»,
  «120»/«10x120»).
- Sprachpfade `/en/`, `/fr_CH/`, `/it/` liefern dieselben Produkte. Ohne
  `Accept-Language` leitet Odoo `/shop/…` mit 303 auf `/en/shop/…`.
- `?search=` und `?order=` ändern die Produktseite nicht; Odoos `rel=canonical` lässt
  sie weg, die Adressen wurden aber gecrawlt.
- Erreichbare Produkt-IDs (1–75 durchprobiert): 36 Stück. **23, 36 und 37 fehlen in
  Odoos Sitemap** und fehlten deshalb in der Zuordnung. ID 36 ist genau das Produkt
  aus fünf der zwölf Adressen des Betreibers.
- Odoo-Kategorieseiten (`/shop/category/…`) sind im Live-Shop nicht verlinkt.

### Die neue Storefront (test.jibbit.ch)

| Bereich | Zustand | Bewertung |
|---|---|---|
| Produkt | `/products/<handle>`, Handle aus Medusa (im Admin aus dem Titel erzeugt, frei änderbar) | gut |
| Kategorie | `/?kategorie=<handle>` auf der Startseite, unbekannter Wert → 404 | zulässig; siehe «Nicht umgesetzt» |
| Suche | `/suche?q=…`, `noindex, follow` | richtig |
| Warenkorb, Kasse, Konto | Warenkorb ohne eigene URL (Drawer), `/checkout`, `/konto/…` | nicht in der Sitemap, richtig |
| Canonical | Produkt: ohne Parameter. Startseite: `/` bzw. `/?kategorie=<handle>`; fremde Parameter fallen weg | richtig |
| Sitemap | Startseite, Rechtliches, Service, Kategorien, Produkte — nur kanonische Adressen | richtig; `lastmod` war erfunden |
| robots.txt | `Allow: /` | richtig, siehe Entscheid 4 |
| Schrägstrich | `/products/x/` → 308 → `/products/x` | richtig |
| Gross/klein | `/products/OCB-…` → 404 | behoben |
| Sprache | nur `de-CH`, keine Locale-Routen, kein hreflang | richtig |
| Odoo-Weiterleitungen | in `proxy.ts`, über die ID, mit Sprachpfaden | Lücken, behoben |

Lücken der bisherigen Weiterleitungen:

1. **Der Query-String wanderte mit.** `/it/shop/…-41?search=filter` →
   `/products/ocb-slim-filter-bio-120-tips?search=filter`. Die Dubletten wären mit
   umgezogen.
2. **IDs 23, 36, 37 fehlten** und landeten auf der Startseite.
3. **Drei Ziele gab es nicht** (IDs 3, 7, 40 → 404 auf Staging).
4. **Drei Produkte gingen auf die Kategorie, obwohl es sie gibt** (IDs 2, 54, 60).
5. `medusa-ecom/data/odoo-redirects.json` führte zehn Handles, die es so nicht gibt.

## Entscheide

1. **Produktadressen bleiben `/products/<handle>`**, flach, ohne Kategorie, ohne ID.
2. **Keine Keywords nachrüsten.** Der Nutzen ist laut Google vernachlässigbar, der
   Preis (neue Adresse, Weiterleitung) real. Long-Tail-Begriffe gehören in Titel,
   Beschreibung und Kategorietext.
3. **Alte Adressen: ein 301, über die ID, ohne Odoo-Parameter.** Behalten werden nur
   Kampagnenparameter (`utm_*`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`),
   damit alte Newsletter-Links in der Auswertung zuordenbar bleiben. Als
   Erlaubnisliste, weil sich Odoos Parameter nicht abschliessend aufzählen lassen.
4. **Keine robots.txt-Regeln für Parameter.** Drei Gründe: Google rät davon ab,
   robots.txt zur Kanonisierung zu nutzen; eine gesperrte alte Adresse könnte ihr 301
   nicht mehr zeigen; und bei 25 Produkten gibt es kein Crawl-Budget zu schützen.
   Die Suche bleibt crawlbar, damit ihr `noindex` gelesen wird.
5. **Ziel ohne Produkt ist die Kategorie, nicht die Startseite** (Soft-404-Risiko laut
   Google). Unbekannte IDs gehen weiterhin auf `/`; das sind Einzelfälle.
6. **Sprachpfade: 301 auf Deutsch, kein hreflang.**
7. **Eine Schreibweise je Produkt:** gross geschriebene `/products/…` → 301 auf klein.
8. **Kein erfundenes `lastmod`.**

## Umgesetzt

| Datei | Änderung |
|---|---|
| `lib/seo/legacy-redirects.ts` | Neu `legacyRedirectLocation(domain, pathname, search)`: Ziel samt bereinigtem Query. Zuordnung ergänzt (23, 36, 37) und berichtigt (2, 3, 7, 40, 54, 60). |
| `lib/seo/canonical-path.ts` | Neu `lowercaseProductPath()`. |
| `proxy.ts` | Nutzt beides; 301 in einem Sprung. |
| `app/sitemap.ts` | `lastModified` entfernt. |
| `tools/smoke.mjs`, `e2e/routing.spec.ts` | Prüfen eine Adresse mit Sprachpfad, altem Slug und Parametern. |
| `medusa-ecom/data/odoo-redirects.json` | Auf denselben Stand gebracht (36 Einträge). |

Die zwölf Adressen des Betreibers stehen wörtlich als Testfälle in
`lib/seo/legacy-redirects.test.ts`.

### Zuordnung, die der Betreiber bestätigen sollte

Diese Ziele sind aus Titelvergleich geschlossen, nicht aus Stammdaten:

| Odoo-ID | Odoo-Titel | Ziel | Unsicherheit |
|---|---|---|---|
| 3 | OCB Premium Rolls Slim | `ocb-black-premium-rolls-slim` | «OCB Premium» ist die schwarze Linie; auf Staging gibt es kein anderes OCB-Rolls-Produkt |
| 2 | RAW Black KSS Papers | `raw-classic-king-size-slim` («RAW Black Classic King Size Slim») | KSS = King Size Slim |
| 54 | PURIZE XTRA Slim XMAS ø 6mm | `purize-xtra-slim-6mm` | Sonderausgabe → Standardprodukt |
| 36 | Purize Super SLIM White, 50er Pack, 5mm | `purize-super-slim-white-o5mm` | 48 ist laut Slug die Kopie von 36 |
| 7, 40, 23, 47 | OCB Premium KSS mit Filter, OCB Bio Slim Organic Hemp Rolls, Black Leaf Hülsen | `/?kategorie=papers` | auf Staging nicht veröffentlicht. Kommen sie ins Sortiment, Ziel auf das Produkt umstellen |

## Empfohlene Handle-Änderungen

Im Medusa-Admin anzuwenden, **vor** dem Go-live. Nur Fehler, keine Kosmetik.
Alle übrigen 21 Produkt-Handles bleiben, wie sie sind.

Stand 2026-09-29: Die Spalte «Heute» nennt den Handle zum Zeitpunkt der Empfehlung,
die Spalte «Stand» das, was der Betreiber im Admin daraus gemacht hat.

| Heute | Empfohlen | Grund | Dringlichkeit | Stand |
|---|---|---|---|---|
| `purize-aktivkohlefilter-6mm` | `purize-aktivkohlefilter-9mm` | Das Produkt trug den Titel «PURIZE Aktivkohlefilter 9 mm», die Adresse nannte 6 mm. Es ist das 9-mm-Produkt (Odoo 60, «ø 9mm»). Das 6-mm-Produkt ist ein anderes: `purize-xtra-slim-6mm`, unverändert. | hoch | **erledigt** — vom Betreiber umbenannt, Titel «PURIZE Aktivkohlefilter 9 mm». Den Handle `…-6mm` gibt es nicht mehr (404), Odoo 60 zeigt auf `purize-aktivkohlefilter-9mm`. |
| `raw-classic-king-size-slim` | `raw-black-classic-king-size-slim` | Titel «RAW Black Classic …». RAW Classic und RAW Black sind verschiedene Produkte; der Handle bezeichnet das falsche und blockiert ihn für das echte Classic. | hoch | **erledigt** |
| `purize-super-slim-white-o5mm` | `purize-super-slim-white-5mm` | Das «o» ist ein transliteriertes «ø» und bedeutet nichts. | mittel | **erledigt** |
| `dubi-aktivkohlefilter-o7mm` | `dubi-aktivkohlefilter-7mm` | wie oben | mittel | **erledigt** |
| Kategorie `filter-&-tips` | `filter-tips` | `&` ist das Trennzeichen für Parameter und muss als `%26` kodiert werden; abgetippt oder falsch kopiert bricht die Adresse. | hoch | **erledigt** |
| Kategorie `kräutermischungen` | `kraeutermischungen` | Umlaut erscheint als `kr%C3%A4utermischungen`. Google empfiehlt Transliteration. | mittel | offen — auf Staging gibt es die Kategorie unter keinem der beiden Handles |
| `elements-ultra-thin-king-size-slim-kss` | `elements-king-size-ultra-thin` | Nachträglich (2026-10-01): Das Produkt ist laut Verpackung das breite **Elements King Size Ultra Thin** (ca. 110 × 53 mm, 33 Blatt, Strichcode 716165177814), nicht das 44 mm schmale «King Size Slim». Titel und Handle nannten das falsche Format. | hoch | **erledigt** — Titel «Elements King Size Ultra Thin», Odoo 56 und 57 zeigen auf den neuen Handle, der alte steht in `handle-redirects.data.json`. |

Bewusst **nicht** empfohlen: `elements-blue-rolls-sw`, `silikon-dose-22-mm`,
`kailar-filter-9mm-big-100-stk-schwarz` — unschön, aber richtig. (Der Handle
`elements-ultra-thin-king-size-slim-kss` stand ursprünglich auch hier, mit dem Hinweis,
das doppelte «kss» schade nicht. Der Fehler lag nicht beim «kss», sondern beim Format,
siehe Tabelle.)

Zu klären: es gibt die Kategorien `filter` **und** `filter-&-tips`. Falls beide
dasselbe meinen, eine davon auflösen.

**Wer einen Handle ändert, zieht ihn im selben Zug nach** in
`lib/seo/legacy-redirects.data.json` (dazu `lib/seo/staging-handles.fixture.json`) und
`medusa-ecom/data/odoo-redirects.json` (betroffen waren die IDs 60, 2, 36, 48, 49; alle
nachgezogen). Die Tests nennen die Handles ebenfalls. Medusa legt beim
Umbenennen keine Weiterleitung an; jede Umbenennung und jedes gelöschte Produkt
braucht zusätzlich ein 301 vom alten Handle. Dafür gibt es
`lib/seo/handle-redirects.data.json` (alter Handle → heutiger Handle): die fünf
Umbenennungen oben und die am 2026-09-29 gelöschte Dublette
`purize-xtra-slim-white-50er-pack-5-9mm` → `purize-xtra-slim-6mm` (Odoo 10 zeigt
ebenfalls dorthin) stehen drin.

## Nicht umgesetzt — und warum

- **Kategorien als Pfad (`/kategorie/papers`) statt Parameter.** Google akzeptiert
  beides ausdrücklich. Ein Pfad wäre lesbarer und in der Search Console leichter zu
  filtern, ist aber ein Umbau quer durch Navigation, Startseite, Markup und Tests
  und widerspricht dem Entscheid «Shop ist die Startseite». Wenn, dann vor dem
  Go-live; danach kostet es Weiterleitungen.
- **Sitemap über 100 Produkte.** `getProducts()` holt höchstens 100. Heute 25
  Produkte; vor dem hundertsten braucht die Sitemap Paginierung.
- **Echtes `lastmod`** aus `updated_at` — sinnvoll, sobald Produkte häufiger ändern.

## Von Hand am Go-live

1. **Handles bereinigen** (Tabelle oben), Weiterleitungen nachziehen, neu ausliefern.
2. **Vor der DNS-Umstellung** in der Search Console unter *Leistung → Seiten* und
   *Indexierung → Seiten* alle bekannten Adressen exportieren (letzte 16 Monate) und
   die Odoo-Sitemap sichern. Jede `/shop/…-<id>`, deren ID nicht in
   `ODOO_PRODUCTS` steht, nachtragen.
3. `SITE_INDEXABLE=true` für die Produktion setzen (siehe `lib/seo/indexing.ts`).
4. **Weiterleitungen prüfen:** `npm run smoke -- --base-url=https://jibbit.ch`, dazu
   Stichproben:

       curl -sI "https://jibbit.ch/fr_CH/shop/purize-super-slim-white-50er-pack-5mm-36?search=filter"

   Erwartet: `301`, `location: https://jibbit.ch/products/purize-super-slim-white-5mm`,
   danach `200`. Ein Sprung, kein Parameter.
5. **Search Console:** neue Sitemap `https://jibbit.ch/sitemap.xml` einreichen (die
   alte war als `http://` gemeldet). **Kein** Adressänderungs-Tool — die Domain
   bleibt. Einige wichtige Adressen über die URL-Prüfung zur Indexierung anmelden.
6. **Vier bis acht Wochen beobachten:** *Indexierung → Seiten*, Gründe «Seite mit
   Weiterleitung» (erwartet, steigt), «Nicht gefunden (404)» und «Soft 404» (jede
   Adresse dort ist eine fehlende Zuordnung).
7. **Weiterleitungen mindestens ein Jahr stehen lassen**, besser dauerhaft.
8. Externe Links, die man selbst in der Hand hat (Google-Unternehmensprofil,
   Social-Profile, Lieferantenverzeichnisse, Merchant Center), direkt auf die neuen
   Adressen umstellen.

## Nicht überprüft

- Die Search-Console-Daten selbst (kein Zugriff). Die Liste der Odoo-IDs stammt aus
  Abrufen von `/shop/x-1` bis `/shop/x-75`; höhere IDs und gelöschte Produkte, die
  Google noch kennt, sind nicht erfasst.
- Ob Odoo weitere indexierte Seitentypen hat (Blog, `/shop/category/…`, `/page/…`).
  Im Live-Shop ist nichts davon verlinkt.
- Das Verhalten hinter dem produktiven Reverse-Proxy. Geprüft sind Unit-Tests,
  Build und die Playwright-Suite lokal; auf test.jibbit.ch läuft noch der alte Stand.
- Die Zuordnungen in der Tabelle «bestätigen» oben.
