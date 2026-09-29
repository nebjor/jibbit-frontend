# Google-Merchant-Center-Feed — `/merchant-feed.tsv`

Stand: 2026-09-29 (Spalten ergänzt, Befund und Begründung in
[`sitemap-und-merchant-center.md`](sitemap-und-merchant-center.md)). Umsetzung: `app/merchant-feed.tsv/route.ts` (Handler) und
`lib/seo/merchant-feed.ts` (Zeilenlogik, Tests in `lib/seo/merchant-feed.test.ts`).
Vorlage und Begründungen der Spaltenwahl: `medusa-ecom/export/merchant-center/README.md`
(Stand Odoo-Shop, 2026-09-20).

## URL

    https://jibbit.ch/merchant-feed.tsv

Tabulator-getrennt, UTF-8, `Content-Type: text/tab-separated-values; charset=utf-8`.
Kopfzeile mit Googles englischen Attributnamen, danach **eine Zeile je Variante**
(ein Produkt mit einer Packung = eine Zeile). Erzeugt wird live aus Medusa, serverseitig
eine Stunde zwischengespeichert (je Mandant); bei Preis- oder Bestandsänderungen im Admin
holt der nächste Abruf nach spätestens einer Stunde den neuen Stand.

Ist das Backend nicht erreichbar, antwortet die Route mit **503** (nie mit einem leeren Feed):
das Merchant Center behält dann den letzten erfolgreichen Abruf, statt alle Artikel zu löschen.

Der Feed ist auch auf Staging abrufbar (`test.jibbit.ch/merchant-feed.tsv`): der
Noindex-Header sperrt nur die Suche, `robots.txt` erlaubt in beiden Zuständen alles.
Das Merchant Center respektiert `robots.txt` — dort darf der Pfad also nie blockiert werden.

## Spalten

| Attribut | Quelle in Medusa / Regel |
|---|---|
| `id` | `variant.sku`, ohne SKU die Medusa-Varianten-ID. Derselbe Wert wie `sku` im JSON-LD (`offerId` in `lib/seo/jsonld.ts`) |
| `title` | `product.title`; bei mehreren Varianten `Titel – Variantentitel` (wie `name` im JSON-LD), ≤ 150 Zeichen |
| `description` | `product.description`, sonst `subtitle`, sonst der Titel; bei mehreren Varianten mit Variantentitel davor, ≤ 5000 Zeichen |
| `link` | eine Variante: `https://<domain>/products/<handle>` (kanonisch); mehrere: `…?variant=<id>` — dieselbe URL wie `Offer.url` im JSON-LD |
| `canonical_link` | immer `https://<domain>/products/<handle>`, ohne Parameter |
| `image_link` | erstes Bild der Variante über den eigenen Bildproxy (`/media/<host>/<key>`), identisch mit `image` im JSON-LD. Kein Bild → leer (Zeile bleibt, Google meldet «Bild fehlt») |
| `availability` | `in_stock` / `out_of_stock` nach derselben Regel wie die Produktseite (`manage_inventory`, `allow_backorder`, `inventory_quantity`) |
| `price` | Preis für Menge 1 (erste Preisstufe aus `/store/price-tiers`, sonst `calculated_price`), Endpreis, `12.34 CHF` |
| `brand` | `product.metadata.brand`; nicht gepflegt: der Hersteller aus der Liste in `lib/placeholder.ts`, mit dem der Titel beginnt; sonst leer |
| `gtin` | `variant.ean` (ersatzweise `upc`/`barcode`), nur mit gültiger Prüfziffer |
| `identifier_exists` | `yes`, sobald Marke oder GTIN vorhanden; sonst leer. **Nie `no`** (Markenartikel haben eine GTIN, auch wenn sie noch nicht gepflegt ist) |
| `condition` | `new` |
| `item_group_id` | Handle des Produkts, nur bei mehreren Varianten. Derselbe Wert wie `productGroupID` im JSON-LD |
| `size` | Titel der Variante («Einzeln», «Display (24 Stk.)»), nur bei mehreren Varianten |
| `shipping` | `CH:4.50 CHF:1:3:1:3` (Land, Preis, Bearbeitung min/max, Transport min/max in Werktagen); kostet die Packung allein CHF 69 oder mehr, `CH:0.00 CHF:…`. Die Kopfzeile nennt die Unterattribute in Klammern |
| `free_shipping_threshold` | `CH:69.00 CHF` |
| `google_product_category` | nach Kategorie-Handle: `papers`, `filter`, `filter-tips` → 600 (Rauchzubehör); `aschenbecher` (oder «Aschenbecher» im Titel) → 4082; alles andere leer — Google ordnet dann selbst zu |
| `product_type` | Name der Shop-Kategorie (`Papers`, `Filter`, `Aschenbecher`, `Zubehör`) |
| `color` | Wert einer Produktoption, die im Admin «Farbe»/«Color» heisst; sonst leer |
| `material` | `variant.material`, sonst `product.material`; sonst leer |
| `custom_label_0` | erwartete Richtlinien-Einordnung: `tabakzubehoer-papers`, `tabakzubehoer-filter`, `zubehoer-unkritisch` (Aschenbecher); sonst leer |
| `custom_label_1` | Packungsart aus `variant.metadata.pack_type`: `einzeln` / `display` / `box` |

Bewusst **nicht** im Feed: `shipping_label` (ein Versandpreis), `sale_price` (Streichpreise
sind nicht im Sinn der Google-Regeln belegt), `multipack` (nur für vom Händler gebündelte
Packungen; Display und Box sind Herstellergebinde mit eigener GTIN),
`unit_pricing_measure`/`unit_pricing_base_measure` (Medusa kennt die Inhaltsmenge nicht).

Alle Produkte kommen in den Feed — auch die, die Google nach der Tabakzubehör-Richtlinie
voraussichtlich ablehnt. Kategorisiert wird wahrheitsgemäss; `custom_label_0` erlaubt das
Filtern im Merchant Center.

## Einrichtung im Merchant Center

1. **Produkte → Datenquellen → Produktquelle hinzufügen** → «Datei über URL abrufen»
   (geplanter Abruf). URL: `https://jibbit.ch/merchant-feed.tsv`, Abruf **täglich**
   (Uhrzeit frei, z. B. 05:00 Europe/Zürich), keine Anmeldung nötig.
2. Zielland **Schweiz (CH)**, Sprache **Deutsch (de)**, Feedlabel `CH`, Währung CHF.
   Ziele: «Kostenlose Einträge» (und «Shopping-Anzeigen», falls später geworben wird).
3. **Versand** (Versand und Rückgaben → Versandrichtlinie hinzufügen), Land Schweiz,
   Währung CHF, Bearbeitungszeit 1–3 Werktage, Transport 1–3 Werktage:

   | Bedingung | Versandkosten |
   |---|---|
   | Bestellwert ab CHF 69.00 | gratis |
   | sonst | CHF 4.50 |

   Werte müssen mit `lib/config.ts` (`SHIPPING`) und dem Backend
   (`swiss-shipping`-Provider) übereinstimmen. Der Feed führt dieselben Werte in
   `shipping` und `free_shipping_threshold`; die Angabe im Feed schlägt die des Kontos.
4. **Rückgabe**: Rückgaberichtlinie für die Schweiz mit «Keine Rückgabe / Rückgaben werden
   nicht akzeptiert» und der URL `https://jibbit.ch/agb` (Rückgabe- und Mängelregelung;
   menschenlesbar auch unter `/service/rueckgabe`). Die gesetzliche Sachgewährleistung ist
   keine «Rückgabe» im Sinn von Google.
5. Nach dem ersten Abruf **Produkte → Alle Produkte / Behebung erforderlich** prüfen.
   Ablehnungen wegen der Richtlinie sind für Papers und Filter zu erwarten.

Website `jibbit.ch` muss im Merchant Center bestätigt und beansprucht sein; Impressum, AGB,
Kontakt und Zahlungsarten sind im Shop verlinkt (`/impressum`, `/agb`, `/service/kontakt`,
`/service/zahlungsarten`).

## Automatische Artikelaktualisierungen

Im Merchant Center «Automatische Artikelaktualisierungen» (Preis, Verfügbarkeit) aktiviert
lassen. Google liest dafür die strukturierten Daten der Landingpage — das JSON-LD aus
`lib/seo/jsonld.ts` (`Offer.price`, `availability`, `image`, `sku`, `gtin`). Der Feed nutzt
dieselben Helfer für Kennung, URL, Bild, Marke und Preis; weichen Seite und Feed ab, ist das ein Fehler in
einem der beiden und nicht Absicht.
