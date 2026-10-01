# Sitemap, alte Adressen und Merchant Center

Stand: 2026-09-29. Umsetzung: `app/sitemap.ts` und `lib/seo/sitemap.ts`,
`lib/seo/legacy-redirects.ts` mit `legacy-redirects.data.json`, `proxy.ts`,
`lib/seo/merchant-feed.ts`, `lib/seo/jsonld.ts`, `tools/smoke.mjs` (Tests jeweils
daneben, dazu `e2e/routing.spec.ts`). Ergänzt `url-structure.md` und `merchant-feed.md`.

## Kurzfassung

- **Die leere Sitemap auf test.jibbit.ch ist Absicht, kein Defekt.** Solange
  `SITE_INDEXABLE` nicht gesetzt ist, liefert `/sitemap.xml` ein leeres `<urlset>`, und
  `robots.txt` nennt keine Sitemap. Mit `SITE_INDEXABLE=true` führt sie jede kanonische
  Adresse und `robots.txt` verweist auf sie. Geprüft im Code, im Build (Route ist
  dynamisch, `ƒ /sitemap.xml`) und in der Playwright-Suite, die mit
  `SITE_INDEXABLE=true` läuft.
- **Zwei echte Lücken darunter sind geschlossen:** Der Produktabruf hörte bei 100
  Produkten still auf, und ein Backend, das nichts liefert, hätte eine Sitemap ohne
  Produkte mit Status 200 ergeben.
- **Merchant Center bekommt die Produkte auf zwei Wegen** — Datei unter
  `/merchant-feed.tsv` und Auslesen der Produktseiten. Beide beschreiben jetzt denselben
  Artikel unter derselben Kennung. Vorher trug die Seite die Medusa-ID, der Feed die
  Artikelnummer.
- **Alte Adressen:** alle 37 Produkt-IDs und alle 485 Pfade, die die Search Console
  kennt, sind beantwortet und als Test hinterlegt.
- **Vor dem Go-live zwingend:** zwei Produkte veröffentlichen, einen Preis eintragen,
  `www` im DNS umstellen. Siehe «Von Hand».

## Wie Google an die Daten kommt

| Frage | Antwort | Quelle |
|---|---|---|
| Grenzen einer Sitemap | 50 MB unkomprimiert oder 50 000 Adressen. Nur absolute Adressen. | [Build a sitemap][sm] (Stand 2026-07-08) |
| `<lastmod>`, `<priority>`, `<changefreq>` | «Google uses the `<lastmod>` value if it's consistently and verifiably accurate.» `priority` und `changefreq` ignoriert Google. | [Build a sitemap][sm] |
| Einreichen | Search Console (Bericht «Sitemaps») oder Zeile `Sitemap:` in `robots.txt`. | [Build a sitemap][sm] |
| Abruf scheitert | Google versucht es einige Male erneut. Ein späterer Fehlschlag lässt Google nicht vergessen, was es früher gelesen hat. | [Search Console-Hilfe][smerr] |
| Bilder in der Sitemap | Nur `<image:image>` mit `<image:loc>`. `caption`, `title`, `geo_location`, `license` sind abgeschafft. Höchstens 1000 Bilder je Adresse. Bilder auf einer anderen Domain sind zulässig, wenn beide in der Search Console bestätigt sind. | [Image sitemaps][img] (Stand 2025-12-10) |
| Weg 1: Datei | Merchant Center holt eine Datei (`.txt`, `.tsv`, `.xml`) von einer Adresse, in der Voreinstellung alle 24 Stunden. | [Datei hinzufügen][file], [Zeitplan][sched] |
| Weg 2: Website | Google liest die Produktseiten und ihre strukturierten Daten und legt die Produkte selbst an. Voraussetzung: strukturierte Daten, Googlebot nicht gesperrt. | [Automatisch gefundene Produkte][auto] |
| Beide Wege zugleich | «if the same product is both automatically found on your online store and uploaded by you in a data source, we'll keep the version you uploaded». | [Automatisch gefundene Produkte][auto] |
| Automatische Aktualisierung | Preis, Sonderpreis, Verfügbarkeit und Zustand werden aus den strukturierten Daten der Seite nachgeführt. Das Markup muss im ausgelieferten HTML stehen. | [Automatisierungen][autoupd], [Strukturierte Daten einrichten][sd] |
| Mehrere Angebote auf einer Seite | Jedes Angebot braucht eine SKU oder GTIN, und die Zeile im Feed muss **dieselbe** tragen. Feed-`id` entspricht `sku`, `item_group_id` entspricht `inProductGroupWithID`. | [Strukturierte Daten einrichten][sd], [Unterstützte Daten][sdmap] |
| Varianten | Jede Variante braucht eine eigene Kennung und eine Adresse, die sie vorwählt. | [Product variants][var] (Stand 2026-09-08) |
| Ablauf | Produkte verfallen 30 Tage nach der letzten Aktualisierung. | [expiration_date][exp] |
| Pflichtangaben Schweiz | `id`, `title`, `description`, `link`, `image_link`, `availability`, `price`, `brand`, `shipping`; `gtin`, wo es eine gibt. | [Produktdatenspezifikation][spec] |
| `description` leer | Warnung, keine Ablehnung. | [description][desc] |
| `brand` | Im Zweifel weglassen: «When in doubt don't provide a brand». | [brand][brand] |
| `shipping` | Ohne benannte Unterattribute gilt `country:region:service:price`. Wer im Feed einen Preis angibt, überschreibt die Versandeinstellung des Kontos samt Lieferzeit und Mindestbestellwert. | [shipping][ship] |
| `free_shipping_threshold` | Format `CH:69.00 CHF`. | [free_shipping_threshold][fst] |
| `canonical_link` | Für Links mit Parametern zur Variantenwahl: `link` wählt die Variante, `canonical_link` nennt die Adresse ohne Parameter. | [canonical_link][canon] |
| Richtlinie | Blättchen und Filter gelten als Tabakzubehör und sind in Anzeigen **und** kostenlosen Einträgen nicht zugelassen. Aschenbecher sind nicht genannt. | [Gefährliche Produkte][pol] |

Nicht aus einer Quelle belegt, deshalb als offen zu behandeln:

- ob Merchant Center bei einem fehlgeschlagenen Abruf die bisherigen Produkte behält,
- ob «automatisch gefundene Produkte» für die Schweiz verfügbar ist,
- ob eine in der Search Console eingereichte Sitemap das Auslesen für Merchant Center
  beeinflusst,
- ob Packungsgrössen bei Google als Variante zählen. Die Hilfeseiten zeigen für
  Nicht-Bekleidung nur Beispiele wie Speichergrösse.

[sm]: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
[smerr]: https://support.google.com/webmasters/answer/7451001
[img]: https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
[var]: https://developers.google.com/search/docs/appearance/structured-data/product-variants
[file]: https://support.google.com/merchants/answer/12158380
[sched]: https://support.google.com/merchants/answer/14991445
[auto]: https://support.google.com/merchants/answer/12158480
[autoupd]: https://support.google.com/merchants/answer/12157888
[sd]: https://support.google.com/merchants/answer/7331077
[sdmap]: https://support.google.com/merchants/answer/6386198
[exp]: https://support.google.com/merchants/answer/6324499
[spec]: https://support.google.com/merchants/answer/7052112
[desc]: https://support.google.com/merchants/answer/6324468
[brand]: https://support.google.com/merchants/answer/6324351
[ship]: https://support.google.com/merchants/answer/6324484
[fst]: https://support.google.com/merchants/answer/14768922
[canon]: https://support.google.com/merchants/answer/9340054
[pol]: https://support.google.com/merchants/answer/6150004

## Stand auf test.jibbit.ch

Abgelesen aus den ausgelieferten Seiten. Die Store-API verlangt den Publishable Key;
er steht nur in der Serverkonfiguration (`STATIC_TENANTS`) und war nicht zugänglich.

### Kategorien

| Name | Handle | Produkte |
|---|---|---|
| Papers | `papers` | 9 |
| Filter & Tips | `filter-tips` | 2 |
| Aschenbecher | `aschenbecher` | 3 |
| Filter | `filter` | 10 |

`filter-tips` und `filter` tragen die gewünschten Handles. `kraeutermischungen` und
`zubehoer` antworten mit 404; es gibt sie also nicht oder unter einem anderen Handle.

### Produkte

25 veröffentlichte Produkte, 34 Varianten (gezählt vor dem Löschen der Dublette
`purize-xtra-slim-white-50er-pack-5-9mm`, siehe «Auffälligkeiten»; die Zahlen hier und
unten sind danach nicht neu erhoben). Die umbenannten Handles sind
`raw-black-classic-king-size-slim`, `purize-super-slim-white-5mm`,
`dubi-aktivkohlefilter-7mm`, `purize-aktivkohlefilter-9mm` und die Kategorie
`filter-tips`. Die vollständige Liste steht
in `lib/seo/staging-handles.fixture.json`.

### Auffälligkeiten

| Produkt | Befund | Folge |
|---|---|---|
| `purize-aktivkohlefilter-9mm` | Hiess bis 2026-09-29 `purize-aktivkohlefilter-6mm`, bei Titel «PURIZE Aktivkohlefilter 9 mm». Der Betreiber hat den Handle umbenannt; der alte antwortet mit 404. Die Artikelnummern lauteten `PUR-AK6-50`, `-100`, `-250`; ob sie mit umbenannt wurden, ist nicht geprüft. | Handle und Titel stimmen überein. Odoo 60 zeigt auf den neuen Handle. |
| `purize-xtra-slim-white-50er-pack-5-9mm` | «Purize Xtra SLIM White, 50er Pack, 5.9mm» ist eine Dublette von `purize-xtra-slim-6mm` («PURIZE XTRA Slim Aktivkohlefilter 6 mm»). Entscheid des Betreibers vom 2026-09-29: die Dublette wird gelöscht, `purize-xtra-slim-6mm` bleibt. | Odoo 10 zeigt auf `purize-xtra-slim-6mm`. `/products/purize-xtra-slim-white-50er-pack-5-9mm` antwortet mit 301 dorthin, siehe «Alte Handles des neuen Shops». Aus `staging-handles.fixture.json` gestrichen. |
| `silikon-dose-22-mm` | Preis 0.00 CHF, keine Artikelnummer, keine Kategorie. | Die Seite zeichnet das Produkt für CHF 0 aus. Google lehnt die Zeile ab. |
| `raw-black-classic-king-size-slim` | Variante «Box (50 Heftchen)» hat `pack_type` `single`. | `custom_label_1` ist `einzeln` statt `box`. |
| alle 25 | `metadata.brand` ist leer. | Siehe «Feed». |
| 19 von 25 | keine Beschreibung | Siehe «Feed». |
| 24 von 34 Varianten | keine GTIN | Google kann das Angebot keinem bekannten Artikel zuordnen. |
| 8 Produkte | Bildadresse enthält Leerzeichen oder Klammern. Der Bildproxy lehnt solche Namen ab, das Bild kommt deshalb direkt von `api-test.jibbit.ch`. | Wird `api-test` nach dem Go-live abgeschaltet, fehlen diese Bilder. |

## Sitemap

### Befund

| Punkt | Zustand vorher | Jetzt |
|---|---|---|
| Leere Sitemap auf Staging | Absicht (`SITE_INDEXABLE` fehlt) | unverändert |
| Erzeugung | je Anfrage | unverändert, im Build als `ƒ` bestätigt |
| Mehr als 100 Produkte | Das 101. fehlte ohne Meldung | Der Abruf blättert, bis `count` erreicht ist |
| Mehr als 50 Kategorien | Die 51. fehlte | Obergrenze 200 |
| Backend nicht erreichbar | Fehler 500, ohne Eintrag im Log | Fehler 500 und `console.error` |
| Backend liefert null Produkte | Sitemap ohne Produkte, Status 200, kein Hinweis | Sitemap wird ausgeliefert, `console.error` nennt die Zahlen |
| `lastmod` | fehlte | an Produkten aus Medusa `updated_at` |
| Bilder | fehlten | je Produkt als `<image:image>` |
| Doppelte Adressen | möglich | jede Adresse einmal |
| Sonderzeichen | Next setzt Adressen unmaskiert ins XML | `&`, `<`, `>` werden maskiert |
| Canonical auf Rechtstexten und Service | fehlte | gesetzt, ohne Parameter |
| `robots.txt` in Produktion | nennt die Sitemap | unverändert, jetzt auch im End-to-End-Test |

### Inhalt

| Gruppe | Adressen | `lastmod` | Bilder |
|---|---|---|---|
| Startseite | `/` | nein | nein |
| Rechtliches | `/impressum`, `/agb`, `/datenschutz`, `/widerrufsrecht` | nein | nein |
| Service | `/service/kontakt`, `/versand`, `/zahlungsarten`, `/rueckgabe`, `/faq` | nein | nein |
| Kategorien | `/?kategorie=<handle>` | nein | nein |
| Produkte | `/products/<handle>`, nur veröffentlichte | ja | ja |

Nicht enthalten: `/shop` (Weiterleitung), `/terms` (Canonical ist `/agb`), `/suche`,
`/checkout`, `/konto` (alle `noindex`), Varianten-Adressen mit `?variant=`.

`lastmod` steht nur an Produkten, weil nur dort ein echtes Datum vorliegt. Grenze:
Preis und Bestand liegen in Medusa in eigenen Modulen. Ändern sie sich, bewegt sich
`updated_at` des Produkts nicht. Das Datum ist also nie zu neu, kann aber zu alt sein.

## Alte Adressen

Grundlage ist der Export der Search Console vom 2026-09-29: 544 Adressen, 485
verschiedene Pfade, 37 Produkt-IDs. Die Pfade liegen als
`lib/seo/legacy-paths.fixture.json` im Repo. Der Test lässt jede davon durch dieselbe
Funktion laufen wie der Proxy.

### Geänderte Ziele

| Odoo-ID | Vorher | Jetzt |
|---|---|---|
| 2 | `raw-classic-king-size-slim` | `raw-black-classic-king-size-slim` |
| 36, 48 | `purize-super-slim-white-o5mm` | `purize-super-slim-white-5mm` |
| 49 | `dubi-aktivkohlefilter-o7mm` | `dubi-aktivkohlefilter-7mm` |
| 23, 47 | Kategorie Papers | `black-leaf-el-humeros-konische-huelsen-ks-100x` (Entwurf) |
| 40 | Kategorie Papers | `ocb-bio-slim-organic-hemp-rolls` (Entwurf) |
| 5 | fehlte, landete auf der Startseite | Kategorie Papers |
| 7 | Kategorie Papers | unverändert, das Produkt wird nicht mehr geführt |
| 60 | `purize-aktivkohlefilter-6mm` | `purize-aktivkohlefilter-9mm` (im Admin umbenannt, siehe «Auffälligkeiten») |
| 10 | `purize-xtra-slim-white-50er-pack-5-9mm` | `purize-xtra-slim-6mm` (Dublette gelöscht, siehe «Auffälligkeiten») |
| 56, 57 | `elements-ultra-thin-king-size-slim-kss` | `elements-king-size-ultra-thin` (im Admin umbenannt am 2026-10-01: laut Verpackung das breite King Size, nicht King Size Slim) |

### Alte Handles des neuen Shops

Medusa legt beim Umbenennen oder Löschen keine Weiterleitung an. Die alten Adressen
standen auf Staging, in der Sitemap und im Feed. `lib/seo/handle-redirects.data.json`
führt sie; `lib/seo/legacy-redirects.ts` beantwortet sie an derselben Stelle wie die
Odoo-Adressen mit 301, in einem Sprung, nur für jibbit.ch. `?variant=` fällt weg, weil
es die Varianten-IDs des alten Produkts am Ziel nicht gibt; Kampagnenparameter bleiben.

| Alte Adresse | Ziel | Grund |
|---|---|---|
| `/products/purize-xtra-slim-white-50er-pack-5-9mm` | `/products/purize-xtra-slim-6mm` | Dublette gelöscht |
| `/products/raw-classic-king-size-slim` | `/products/raw-black-classic-king-size-slim` | umbenannt |
| `/products/purize-super-slim-white-o5mm` | `/products/purize-super-slim-white-5mm` | umbenannt |
| `/products/dubi-aktivkohlefilter-o7mm` | `/products/dubi-aktivkohlefilter-7mm` | umbenannt |
| `/products/purize-aktivkohlefilter-6mm` | `/products/purize-aktivkohlefilter-9mm` | umbenannt |
| `/products/elements-ultra-thin-king-size-slim-kss` | `/products/elements-king-size-ultra-thin` | umbenannt (2026-10-01) |

Wird ein alter Handle im Admin neu vergeben (etwa `raw-classic-king-size-slim` für ein
echtes RAW Classic), muss seine Zeile aus der Datendatei, sonst ist das neue Produkt
nicht erreichbar. `tools/smoke.mjs` prüft diese Liste nicht.

### Antwort je Muster

| Alte Adresse | Antwort | Grund |
|---|---|---|
| `/shop/<slug>-<id>` | 301 auf Produkt oder Kategorie | über die ID |
| `/shop`, `/shop/page/<n>`, `/shop?search=`, `/shop?order=` | 301 auf `/` | der Katalog ist die Startseite |
| `/contactus` | 301 auf `/service/kontakt` | |
| `/about-us`, `/website/info` | 301 auf `/impressum` | eine «Über uns»-Seite gibt es nicht |
| `/web/login` | 301 auf `/konto/anmelden` | die Anmeldung gibt es weiterhin |
| `/terms` | **200**, Inhalt von `/agb`, Canonical `/agb` | im Merchant Center als Adresse der Rückgaberichtlinie hinterlegt |
| `/<sprache>/terms` | 301 auf `/agb` | |
| `/impressum` | bleibt | dieselbe Adresse |
| `/shop/cart`, `/shop/change_pricelist/…` | 410 | keine Entsprechung |
| `/website/translations`, übriges `/web/…` und `/website/…` | 410 | Odoo-Endpunkte |
| `/web/image/product.template/<n>/…` | 410 | alte Bildadressen |
| `/blog`, `/blog/…` | 410 | kein Blog |
| `/en`, `/it`, `/fr_CH`, `/de_CH`, `/fr_BE` davor | Sprachpfad fällt weg, dann wie oben | Muster `/xx` oder `/xx_XX` statt fester Liste |
| `www.jibbit.ch/…` | 301 auf `jibbit.ch/…`, bei alten Adressen direkt aufs Ziel | ein Sprung |

410 statt Startseite, weil Google viele alte Adressen, die auf die Startseite zeigen,
als Soft 404 wertet.

Das Sprachpfad-Muster trifft keine Route der Storefront: keine beginnt mit einem Segment
aus genau zwei Buchstaben. Ein Test prüft das gegen das Verzeichnis `app/`.

### `www`

Die Search Console kennt 44 Adressen unter `www.jibbit.ch`. Bisher beantwortete die
Storefront `www` mit 200, sofern der Host als Alias in `STATIC_TENANTS` stand. Jetzt
leitet sie mit 301 auf die Hauptdomain. Das greift nur, wenn die Anfrage die Storefront
erreicht, siehe «Von Hand».

## Feed

### Prüfung gegen die Anforderungen

| Attribut | Vorher | Jetzt |
|---|---|---|
| `id` | Artikelnummer, sonst Varianten-ID | unverändert, dieselbe Funktion wie `sku` im JSON-LD |
| `title`, `link`, `image_link`, `availability`, `price`, `condition` | in Ordnung | unverändert |
| `description` | bei 23 von 34 Zeilen leer | ohne gepflegten Text steht der Titel |
| `brand` | bei allen 34 Zeilen leer | Hersteller, mit dem der Titel beginnt, aus einer festen Liste |
| `gtin` | nur mit gültiger Prüfziffer | unverändert |
| `identifier_exists` | `yes` mit Marke oder GTIN, sonst leer | unverändert |
| `shipping` | fehlte, für die Schweiz Pflicht | `CH:4.50 CHF:1:3:1:3`, ab CHF 69 je Packung `CH:0.00 CHF:…` |
| `free_shipping_threshold` | fehlte | `CH:69.00 CHF` |
| `item_group_id` | fehlte | Handle, bei Produkten mit mehreren Packungen |
| `size` | fehlte | Name der Packung, bei Produkten mit mehreren Packungen |
| `canonical_link` | fehlte | kanonische Produktadresse ohne Parameter |
| `google_product_category` | für «Filter & Tips» leer | 600 |
| Vollständigkeit | höchstens 100 Produkte | alle |

### Zum `link`

Bei Produkten mit einer Packung ist `link` die kanonische Adresse. Bei mehreren
Packungen ist `link` die Adresse mit `?variant=<id>`, und `canonical_link` nennt die
kanonische. Das weicht von der Vorgabe «Link gleich Canonical» ab, mit Grund: Google
verlangt für Varianten eine Adresse, die die Variante vorwählt, und gleicht Preis und
Bild der Zeile gegen genau diese Seite ab. Mit der Adresse ohne Parameter zeigte die
Seite das Einzelstück, während die Zeile das Display beschreibt. Wer es anders will,
ändert eine Zeile in `merchantFeedRows`.

### Marke

`metadata.brand` aus dem Admin gewinnt. Ist das Feld leer, greift die Liste in
`lib/placeholder.ts`, aber nur, wenn der Titel mit dem Hersteller **beginnt**. «Silikon
Dose» bekommt keine Marke. Die Liste: Black Leaf, Zig Zag, Greengo, Elements, Smoking,
PURIZE, Kailar, Gizeh, Angel, dubi, OCB, RAW. Ein neuer Hersteller braucht einen
Eintrag dort oder das Feld im Admin.

### Feed und Seite

| Angabe | Feed | JSON-LD | Stand |
|---|---|---|---|
| Kennung | `id` | `sku` | **war verschieden**, jetzt gleich |
| Gruppe | `item_group_id` | `productGroupID`, `inProductGroupWithID` | jetzt gleich |
| Unterschied der Varianten | `size` | `size`, `variesBy` | jetzt gleich |
| Preis | `price` | `Offer.price` | gleich |
| Verfügbarkeit | `availability` | `Offer.availability` | gleich |
| GTIN | `gtin` | `gtin8`, `gtin12`, `gtin13`, `gtin14` | gleich |
| Adresse | `link` | `Offer.url` | gleich |
| Bild | `image_link` | erstes `image` | gleich |
| Marke | `brand` | `brand.name` | gleich |
| Versand | `shipping` | `shippingDetails.shippingRate` | gleich |

Ein Test vergleicht diese Werte Zeile für Zeile
(`lib/seo/merchant-feed.test.ts`, «Feed und JSON-LD sagen dasselbe»).

**Achtung beim Umstellen:** Wer im Merchant Center bereits Produkte hat, die über die
Website gefunden wurden, hat sie dort unter der Medusa-ID. Nach dem Ausliefern dieses
Stands tragen sie die Artikelnummer. Google legt sie neu an, die alten laufen nach 30
Tagen ab.

## Prüfen

    npm run smoke -- --base-url=https://test.jibbit.ch
    npm run smoke -- --base-url=https://jibbit.ch --require-sitemap

Der Lauf prüft jetzt zusätzlich:

| Zeile | Bedeutung |
|---|---|
| `/merchant-feed.tsv` | antwortet, hat Zeilen |
| `Feed: id` | keine doppelte Kennung |
| `Feed: price` | kein Preis von 0.00 |
| `Feed: brand`, `description`, `gtin` | Hinweis, wie viele Zeilen leer sind |
| `Feed: link` | jede Produktseite des Feeds antwortet mit 200 |
| `Feed ↔ Sitemap` | beide führen dieselben Produkte |
| `robots.txt: Sitemap` | die Zeile steht da, sobald die Sitemap Adressen führt |
| `Odoo-Weiterleitungen` | jede der 37 IDs leitet mit 301 auf ihr Ziel, das Ziel antwortet mit 200 |
| `UNVERÖFFENTLICHTE ZIELE` | eigene Warnung mit Handle und Odoo-ID für Ziele, die noch Entwurf sind |

Ein Ziel, das als unveröffentlicht vermerkt ist und mit 404 antwortet, ist eine Warnung.
Jedes andere Ziel ohne 200 lässt den Lauf scheitern. Antwortet ein vermerktes Ziel mit
200, fordert der Lauf dazu auf, es aus `unveroeffentlicht` zu streichen.

Auf test.jibbit.ch läuft noch der Stand vor diesen Änderungen. Der Lauf meldet dort
deshalb Abweichungen bei den Weiterleitungen, bis neu ausgeliefert ist.

## Von Hand

### Vor dem Go-live

1. **Zwei Produkte veröffentlichen:** `black-leaf-el-humeros-konische-huelsen-ks-100x`
   (Kategorie Papers ist zugewiesen) und `ocb-bio-slim-organic-hemp-rolls`. Bis dahin enden
   die Odoo-IDs 23, 40 und 47 auf einem 404. Danach beide Handles in
   `lib/seo/legacy-redirects.data.json` aus `unveroeffentlicht` streichen und in
   `lib/seo/staging-handles.fixture.json` unter `produkte` eintragen.
2. ~~Entwurf `ocb-premium-kss-papers-mit-filter` löschen.~~ Erledigt, der Entwurf ist
   gelöscht. Die Odoo-IDs 5 und 7 zeigen auf die Kategorie Papers.
3. **`silikon-dose-22-mm`:** Preis eintragen, Artikelnummer und Kategorie vergeben, oder
   das Produkt auf Entwurf setzen.
4. ~~`purize-aktivkohlefilter-6mm`: klären, ob 6 oder 9 mm.~~ Erledigt: es ist das
   9-mm-Produkt, der Handle heisst jetzt `purize-aktivkohlefilter-9mm`, die Odoo-ID 60
   ist in der Datendatei nachgezogen.
5. **Marke, Beschreibung, GTIN im Admin pflegen.** Die Rückfälle im Feed sind ein
   Notbehelf.
6. **Bilder mit Leerzeichen oder Klammern im Dateinamen** neu hochladen, mit Namen aus
   Buchstaben, Ziffern, Punkt, Bindestrich und Unterstrich. Betroffen sind acht Produkte.
7. **DNS und Server für `www.jibbit.ch`:** den Eintrag `www` auf den neuen Server
   zeigen lassen, das Zertifikat auf `www.jibbit.ch` ausstellen, `www.jibbit.ch` im
   nginx-`server_name` und als `aliases` in `STATIC_TENANTS` führen. Fehlt eines davon,
   laufen 44 bekannte Adressen ins Leere.
8. `SITE_INDEXABLE=true` setzen und den Container neu starten.
9. Prüfen:

       npm run smoke -- --base-url=https://jibbit.ch --require-sitemap
       curl -sI https://www.jibbit.ch/shop/dubi-aktivkohlefilter-7mm-49

   Erwartet beim zweiten Befehl: `301`,
   `location: https://jibbit.ch/products/dubi-aktivkohlefilter-7mm`.

### Search Console

1. Bericht **Sitemaps**: `https://jibbit.ch/sitemap.xml` ist seit 06.07.2025
   eingereicht. Die neue Sitemap liegt unter derselben Adresse, die Einreichung bleibt
   gültig. Nach dem Go-live dort «Letzter Lesevorgang» und «Erkannte Seiten» prüfen.
   Erwartet sind rund 40 Adressen.
2. Die Property ist eine Domain-Property und deckt `www` mit ab. Nichts einzurichten.
3. **Kein** Adressänderungs-Tool, die Domain bleibt.
4. **URL-Prüfung** für `/`, zwei Kategorien und die vier Produkte mit Klicks (Odoo 49,
   27, 24, 13) und «Indexierung beantragen».
5. Vier bis acht Wochen **Indexierung → Seiten** beobachten. «Seite mit Weiterleitung»
   steigt wie erwartet. «Nicht gefunden (404)» und «Soft 404» zeigen fehlende
   Zuordnungen.

### Merchant Center

1. **Website bestätigen und beanspruchen**, falls noch nicht geschehen.
2. **Datenquelle:** Produkte → Datenquellen → Produktquelle hinzufügen → Datei über
   Adresse abrufen.

   | Feld | Wert |
   |---|---|
   | Adresse | `https://jibbit.ch/merchant-feed.tsv` |
   | Abruf | täglich, zum Beispiel 05:00 Europe/Zürich |
   | Anmeldung | keine |
   | Land | Schweiz |
   | Sprache | Deutsch |
   | Währung | CHF |

   Die Datei wird auf dem Server eine Stunde zwischengespeichert. Ein häufigerer Abruf
   als stündlich bringt nichts.
3. **Automatisch gefundene Produkte:** Produkte → Produkte hinzufügen → Karte «Produkte
   aus dem Onlineshop hinzufügen», falls sie für das Konto angeboten wird. Bei gleicher
   Kennung gewinnt die Datei.
4. **Automatisierungen** für Preis und Verfügbarkeit eingeschaltet lassen.
5. **Versand:** Die Angaben im Feed überschreiben die Einstellung des Kontos. Im Konto
   trotzdem dieselben Werte hinterlegen: CHF 4.50, gratis ab CHF 69, Bearbeitung 1–3
   Werktage, Transport 1–3 Werktage.
6. **Rückgaberichtlinie:** Hinterlegt ist `https://jibbit.ch/terms`. Die Adresse
   antwortet weiter. Besser auf `https://jibbit.ch/service/rueckgabe` umstellen. Danach
   kann `app/terms/page.tsx` entfallen und `/terms` ein 301 werden.
7. Nach dem ersten Abruf **Behebung erforderlich** prüfen. Zu erwarten sind Ablehnungen
   für Blättchen und Filter nach der Richtlinie für Tabakzubehör, und Warnungen zu
   fehlender GTIN. Die Spalte `shipping` dort ausdrücklich prüfen, siehe «Nicht
   überprüft».

## Nicht überprüft

- **Die Store-API selbst.** Ohne Publishable Key sind Handles, Titel, Preise und GTIN aus
  den ausgelieferten Seiten und dem Feed gelesen. Kategorien ohne Eintrag in der
  Navigation und Entwürfe sind so nicht sichtbar.
- **Ob `updated_at` je Variante in der Antwort der Store-API steht.** Die Feldliste von
  Medusa 2.18 führt es; ohne Schlüssel nicht abgerufen. Fehlt es, zählt das Datum des
  Produkts.
- **Die Schreibweise von `shipping` mit benannten Unterattributen in der Kopfzeile.**
  Sie folgt der Hilfeseite, ist aber nicht gegen ein Merchant-Center-Konto geprüft.
  Meldet Google die Spalte, genügt `CH:::4.50 CHF` ohne Klammern in der Kopfzeile.
- **Das Verhalten hinter nginx** für `www` und für die 410-Antworten. Geprüft sind
  Unit-Tests, Build und die Playwright-Suite lokal.
- **Merchant Center und Search Console selbst.** Kein Zugriff.
- **Die zwei Entwürfe.** Ihre Handles stammen aus der Angabe des Betreibers. Beide
  Zieladressen antworten auf Staging mit 404.
