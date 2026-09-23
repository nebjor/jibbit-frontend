# Rechtliche Durchsicht der Shop-Texte (jibbit.ch)

Stand: 21. September 2026 · Geprüft: AGB, Impressum, Datenschutzerklärung,
Widerrufsrecht, Rückgaberecht & Reklamation (`/service/rueckgabe`), dazu die
Preis- und Versandangaben im Shop.

> **Kein Anwaltsgutachten.** Diese Durchsicht ist eine sorgfältige, aber
> nicht-anwaltliche Prüfung anhand des Gesetzestexts. Sie ersetzt keine
> Rechtsberatung. Wo eine Einschätzung unsicher ist, steht das beim Befund.

Geprüfte Grundlagen: OR (SR 220), UWG (SR 241, insb. Art. 3 Abs. 1 lit. s
und Art. 8), DSG (SR 235.1) mit DSV, Preisbekanntgabeverordnung PBV
(SR 942.211), MWSTG (SR 641.20), Tabakproduktegesetz TabPG (SR 818.32),
Produktehaftpflichtgesetz PrHG (SR 221.112.944).

Schweregrade: **hoch** = Rechtsverstoss oder falsche Zusage an Kundschaft,
vor Livegang beheben · **mittel** = Rechtsrisiko oder Unklarheit ·
**tief** = Verbesserung.

---

## A. Befunde, die direkt behoben wurden

### A1 — AGB Ziffer 4: Ablehnung einer bereits bezahlten Bestellung
- **Problem:** Der Vertrag kommt erst mit Bestätigung oder Versand zustande,
  bezahlt wird aber schon an der Kasse (TWINT, Karte). Die AGB sagten nicht,
  was bei einer Ablehnung mit dem Geld passiert.
- **Grundlage:** UWG Art. 8 (Ungleichgewicht zulasten Konsumenten),
  Art. 3 Abs. 1 lit. b UWG (Klarheit).
- **Schwere:** mittel
- **Neu:** «Einen bereits bezahlten Betrag erstatten wir in diesem Fall
  umgehend über die ursprüngliche Zahlungsart.»

### A2 — AGB Ziffer 6: Pauschaler Ausschluss von Schadenersatz
- **Problem:** «Verzögerungen beim Transport begründen keinen
  Schadenersatzanspruch» ohne Vorbehalt. Für Absicht und grobe Fahrlässigkeit
  ist ein Ausschluss nichtig.
- **Grundlage:** OR Art. 100 Abs. 1
- **Schwere:** tief
- **Neu:** «… begründen, soweit gesetzlich zulässig, keinen
  Schadenersatzanspruch.»

### A3 — AGB Ziffer 6: Transportgefahr nicht geregelt
- **Problem:** Beim Versendungskauf geht die Gefahr nach Gesetz schon mit der
  Übergabe an die Post auf die Käuferin über. Rückgabeseite und Widerrufsseite
  versprechen aber, Transportschäden auf jibbits Kosten zu ersetzen. Die AGB
  sagten dazu nichts, die beiden Texte passten also nicht zusammen.
- **Grundlage:** OR Art. 185 Abs. 2; UWG Art. 3 Abs. 1 lit. b (widersprüchliche
  Angaben)
- **Schwere:** mittel
- **Neu:** «Die Gefahr eines Verlusts oder einer Beschädigung auf dem
  Transport tragen wir; sie geht mit der Zustellung auf dich über.»
- **Entscheid Joris (21.09.2026):** bestätigt.

### A4 — AGB Ziffer 11: Produktehaftpflicht nicht vorbehalten
- **Problem:** Die Haftung nach PrHG kann nicht wegbedungen werden. Die
  Klausel behielt nur Personenschäden vor.
- **Grundlage:** PrHG Art. 8
- **Schwere:** tief
- **Neu:** «Die Haftung für Personenschäden sowie die Haftung nach dem
  Produktehaftpflichtgesetz bleiben in jedem Fall vorbehalten.»

### A5 — Widerrufsrecht Ziffer 3: «lässt sich nicht wegbedingen»
- **Problem:** Die Sachgewährleistung kann nach Schweizer Recht grundsätzlich
  wegbedungen werden (Grenzen: arglistiges Verschweigen, Art. 199 OR;
  Mindestverjährung bei neuen Sachen für Konsumenten, Art. 210 Abs. 4 OR;
  UWG Art. 8). Die Aussage war rechtlich falsch, auch wenn sie zugunsten der
  Kundschaft lautete.
- **Grundlage:** OR Art. 199, 210; UWG Art. 3 Abs. 1 lit. b
- **Schwere:** tief
- **Neu:** «Sie beträgt zwei Jahre ab Ablieferung der Ware (Art. 210 OR), und
  wir schränken sie nicht ein.»

### A6 — AGB Ziffer 5: «inklusive Endpreise»
- **Problem:** Sprachlich verunglückt. Aus der Fassung ging nicht klar hervor,
  dass keine Abgaben mehr hinzukommen.
- **Grundlage:** PBV Art. 3 f. (tatsächlich zu bezahlender Preis)
- **Schwere:** tief
- **Neu:** «Alle Preise verstehen sich in Schweizer Franken (CHF) als
  Endpreise. Wir sind nicht mehrwertsteuerpflichtig; es wird keine
  Mehrwertsteuer erhoben und keine ausgewiesen.» Im Backend-Seed hat die
  Steuerregion CH keinen Steuersatz mehr; auf der bestehenden Instanz nimmt
  Joris den Satz im Admin von der Region.

### A7 — Rückgabe: Kulanz und Ausnahmen einheitlich
- **Problem:** Joris' Entscheid (keine Rückgabe bei Sinneswandel, Kulanz im
  Einzelfall ohne Anspruch, keine Erstattungsfrist) musste auf AGB Ziffer 9/10,
  Widerrufsrecht, Rückgabeseite und FAQ gleich lauten.
- **Grundlage:** UWG Art. 3 Abs. 1 lit. b (widersprüchliche Angaben);
  Google-Merchant-Center-Richtlinien
- **Schwere:** mittel
- **Neu (AGB Ziffer 9):** «In besonderen Fällen kann der Inhaber eine Rückgabe
  ungeöffneter, unbenutzter Ware in der Originalverpackung aus Kulanz annehmen;
  ein Anspruch darauf besteht nicht. Die Kosten der Rücksendung trägst in
  diesem Fall du. Geöffnete oder benutzte Verbrauchsartikel (Papers, Filter,
  Tips) sind davon ausgeschlossen.» Eine Erstattungsfrist steht nirgends mehr.

### A8 — Entwurfsvermerke entfernt
- «Entwurf … vor Livegang juristisch prüfen lassen» und die Kästen
  «Hinweis für den Betreiber» sind aus AGB, Impressum, Datenschutz und
  Versand entfernt (Entscheid Joris). Stand-Datum jetzt 21. September 2026.

### A9 — Kontakt-E-Mail vereinheitlicht
- Kundenseitig überall `info@jibbit.ch` (`BUSINESS.email` in `lib/config.ts`,
  damit auch im Organization-JSON-LD). Rechtlich muss `joris@` an keiner
  Stelle bleiben: UWG Art. 3 Abs. 1 lit. s Ziff. 1 und DSG Art. 19 Abs. 2
  lit. a verlangen eine funktionierende Kontaktadresse, keine persönliche.
  **Voraussetzung:** Das Postfach `info@jibbit.ch` muss existieren und
  gelesen werden.

---

## B. Offene Punkte: Entscheid oder Umsetzung durch Joris

### B1 — Keine Bestellbestätigung per E-Mail — **hoch**
- **Ort:** AGB Ziffer 4 («Den Eingang deiner Bestellung bestätigen wir dir
  unverzüglich per E-Mail»); Backend `medusa-ecom`
- **Problem:** Im Backend (Stand `origin/main`, 21.09.2026) gibt es keinen
  Subscriber auf `order.placed`. Konfiguriert ist nur das
  SMTP-Notification-Modul für das Zurücksetzen des Passworts. Die AGB
  versprechen also eine E-Mail, die nicht verschickt wird. Das UWG verlangt,
  dass die Bestellung unverzüglich elektronisch bestätigt wird. Ob die
  Bestätigungsseite im Shop allein genügt, ist umstritten. Üblich und sicher
  ist die E-Mail.
- **Grundlage:** UWG Art. 3 Abs. 1 lit. s Ziff. 4; UWG Art. 3 Abs. 1 lit. b
- **Vorschlag:** Bestellbestätigung per E-Mail im Backend umsetzen (es gibt
  einen Worktree `_wt-medusa-notify`, prüfen ob der das abdeckt). Bis dahin
  in AGB Ziffer 4: «Den Eingang deiner Bestellung bestätigen wir dir
  unverzüglich auf der Bestätigungsseite und per E-Mail.» Erst ändern, wenn
  die E-Mail tatsächlich verschickt wird.

### B2 — Altersprüfung nur durch Selbstdeklaration — **mittel**
- **Ort:** AGB Ziffer 3, Altersabfrage im Shop
- **Problem:** Das TabPG verbietet die Abgabe von Tabakprodukten und
  gleichgestellten Produkten an Minderjährige und stellt Anforderungen an den
  Onlinehandel. Ob und wie weit Zigarettenpapier, Filter und Grinder unter die
  Abgabe- und Werbebestimmungen des TabPG fallen, konnte hier nicht
  verbindlich geklärt werden. Fällt das Sortiment darunter, genügen ein Klick
  auf «18+» und die Selbstdeklaration in den AGB voraussichtlich nicht.
- **Grundlage:** TabPG (SR 818.32), Bestimmungen zur Abgabe an Minderjährige
  und zur Werbung; kantonale Jugendschutzbestimmungen
- **Vorschlag:** Beim BAG oder beim kantonalen Lebensmittelinspektorat
  (Zürich) die Einordnung von Zigarettenpapier und Filtern schriftlich
  anfragen. Je nach Antwort eine Altersprüfung bei der Zustellung einführen
  (z. B. Post-Zusatzleistung) oder im Checkout (ID-Prüfung).

### B3 — Datenschutz: E-Mail-Versand nicht unter den Empfängern — **mittel**
- **Ort:** Datenschutz Ziffer 5
- **Problem:** Der Shop verschickt E-Mails über einen SMTP-Dienst (Passwort,
  künftig Bestellbestätigung). Der Anbieter dieses SMTP-Servers steht nicht in
  der Empfängerliste.
- **Grundlage:** DSG Art. 19 Abs. 2 lit. c (Empfänger oder Kategorien von
  Empfängern); Art. 19 Abs. 4 (Staat bei Bekanntgabe ins Ausland)
- **Vorschlag:** Anbieter und Standort eintragen, z. B. «**E-Mail-Versand:**
  [Anbieter], [Land] — für den Versand von Bestell- und Konto-E-Mails erhält
  er Name und E-Mail-Adresse.»

### B4 — Datenschutz: PostHog, US-Mutterhaus — **tief**
- **Ort:** Datenschutz Ziffer 5–7
- **Problem:** Die Daten liegen zwar in der EU-Cloud, PostHog, Inc. sitzt aber
  in den USA. Behördenzugriffe nach US-Recht sind nicht ausgeschlossen.
  Zusammen mit der Sitzungsaufzeichnung sollte das transparent sein.
- **Grundlage:** DSG Art. 16 f., Art. 19 Abs. 4
- **Vorschlag:** Ergänzen: «PostHog, Inc. hat ihren Sitz in den USA. Ein
  Zugriff durch US-Behörden auf die in der EU gespeicherten Daten kann nicht
  vollständig ausgeschlossen werden.»

### B5 — Datenschutz: Aufbewahrung der Server-Logs — **tief**
- **Ort:** Datenschutz Ziffer 3 («Technische Daten») und 8
- **Problem:** Für IP-Adressen und Zugriffsdaten ist keine Frist genannt.
- **Grundlage:** DSG Art. 6 Abs. 4 (nicht länger als nötig); Art. 19
- **Vorschlag:** «Server-Logdaten löschen wir spätestens nach [30] Tagen,
  sofern sie nicht zur Aufklärung eines Sicherheitsvorfalls gebraucht werden.»
  Die tatsächliche Frist beim Hosting nachsehen.

### B6 — Zahlungsarten: Apple Pay, Google Pay, Samsung Pay — **tief**
- **Ort:** `/service/zahlungsarten`
- **Problem:** Die Seite nennt diese Wallets. Das Backend
  (`docs/zahls-plugin.md`) bestätigt nur TWINT, Kreditkarte und PostFinance.
  Sind die Wallets in der zahls.ch-Instanz nicht aktiv, ist die Angabe falsch.
- **Grundlage:** UWG Art. 3 Abs. 1 lit. b
- **Vorschlag:** Im zahls.ch-Backend prüfen. Sind die Wallets nicht aktiv,
  den Satz streichen.

### B7 — Strukturierte Daten: `valueAddedTaxIncluded: true` — **tief**
- **Ort:** `lib/seo/jsonld.ts` (Mengenpreise)
- **Problem:** jibbit ist nicht mehrwertsteuerpflichtig. Das Feld behauptet
  wörtlich «MWST inbegriffen». Gemeint ist «es kommt nichts dazu», und für
  Google ist das der richtige Wert. Wer das Markup liest, könnte es aber als
  MWST-Angabe verstehen.
- **Grundlage:** PBV Art. 3 f.; UWG Art. 3 Abs. 1 lit. b (gering)
- **Vorschlag:** Belassen (die Seite selbst sagt korrekt «keine
  Mehrwertsteuer»). Nur ändern, falls Google Merchant Center eine abweichende
  Steuereinstellung verlangt.

### B8 — UID, Handelsregister, MWST: Beobachten — **tief**
- **Befund:** Keine Quelle (Repo, Impressum und AGB auf jibbit.ch) zeigt eine
  MWST-Registrierung oder einen Handelsregistereintrag. Das Impressum behauptet
  auch keines von beidem: keine «MWST-Nr.», keine UID, kein «inkl. MWST». Die
  Preisangaben lauten überall «Endpreise, keine Mehrwertsteuer (nicht
  mehrwertsteuerpflichtig)». Das stimmt mit dem Status überein und ist nach
  PBV korrekt. Eine Suche nach «inkl. MWST» im Frontend ergab keinen Treffer.
- **Grundlage:** MWSTG Art. 10 Abs. 2 lit. a (Befreiung unter
  CHF 100 000 Umsatz); OR Art. 931 Abs. 1 (Eintragungspflicht Einzelunternehmen
  ab CHF 100 000 Umsatz)
- **Vorschlag:** Keine Änderung. Erreicht der Umsatz CHF 100 000, werden
  MWST-Pflicht und Handelsregistereintrag fällig. Dann UID ins Impressum,
  Preise auf «inkl. MWST» umstellen und AGB Ziffer 5, Zahlungsarten, Footer
  und Kasse anpassen.

### B9 — AGB: Kundenkonto nicht geregelt — **tief**
- **Ort:** AGB
- **Problem:** Die Kasse verlangt ein Kundenkonto (Kontopflicht). Die AGB
  erwähnen das nicht (die Datenschutzerklärung schon).
- **Grundlage:** UWG Art. 3 Abs. 1 lit. s Ziff. 2 (technische Schritte zum
  Vertragsschluss)
- **Vorschlag:** In Ziffer 4 ergänzen: «Für eine Bestellung brauchst du ein
  Kundenkonto. Du kannst es jederzeit löschen lassen, soweit keine gesetzliche
  Aufbewahrungspflicht entgegensteht.»

### B10 — Hinweis «Wir teilen das Paketporto» — **mittel** (entschärft)
- **Ort:** Warenkorb (`FreeShippingMeter`), Kasse (`CheckoutFlow`),
  `components/ShippingSplitNote.tsx`
- **Problem:** Gewünscht war «Paket nur CHF 4.50 statt 9.–». CHF 9.00 war
  aber bis 21.09.2026 der Paketpreis. Ein «statt» liest sich deshalb als
  Vergleich mit dem früheren Preis. Solche Selbstvergleiche sind nur befristet
  zulässig und nur, wenn der Vergleichspreis vorher tatsächlich verlangt
  wurde. Nach Ablauf der Frist wird der Hinweis unzulässig, ohne dass es
  jemand merkt.
- **Grundlage:** PBV Art. 16 f.; UWG Art. 3 Abs. 1 lit. g
- **Umgesetzt:** «Wir teilen das Paketporto (9.–) mit dir: du zahlst nur
  CHF 4.50». Die 9.– stehen so als Porto da, das jibbit bezahlt, und nicht
  als früherer Preis. Das gilt ohne Befristung, solange das Porto tatsächlich
  CHF 9.00 beträgt (`SHIPPING.postage`).
- **Joris:** Soll es wörtlich «statt 9.–» heissen, dann nur befristet (als
  Einführungsaktion mit Enddatum) und mit Wiedervorlage.

---

## C. Geprüft und in Ordnung

- **Impressum:** Name, Einzelunternehmen, Postadresse, E-Mail und Telefon
  genügen UWG Art. 3 Abs. 1 lit. s Ziff. 1. Die MWST-Angabe ist korrekt.
- **AGB Ziffer 4:** Bestellschritte, Korrekturmöglichkeit vor dem Absenden,
  Vertragsschluss: UWG Art. 3 Abs. 1 lit. s Ziff. 2 und 3 sind erfüllt (zu
  Ziff. 4 siehe B1).
- **AGB Ziffer 10:** Zwei Jahre Gewährleistung ab Ablieferung (OR Art. 210),
  Mängelrüge «möglichst bald» (OR Art. 201), keine Verkürzung (OR Art. 210
  Abs. 4).
- **AGB Ziffer 14:** Schweizer Recht, CISG ausgeschlossen, Gerichtsstand
  Winterthur mit Vorbehalt zwingender Gerichtsstände (ZPO Art. 32 für
  Konsumenten).
- **Widerrufsrecht Ziffer 1:** OR Art. 40a ff. ist zutreffend beschrieben
  (Haustür- und Telefongeschäfte, nicht der Onlinekauf).
- **Datenschutz:** Verantwortlicher, Zwecke, Empfänger (Zahlung, Post,
  Hosting, Analyse), Bekanntgabe ins Ausland, Aufbewahrung nach OR Art. 958f,
  Rechte nach DSG Art. 25, 28 und 32, Einwilligung und Widerruf bei Cookies,
  EDÖB als Aufsichtsbehörde.
- **Preisbekanntgabe:** Preise in CHF als Endpreise. Versandkosten stehen vor
  Abschluss der Bestellung und im Warenkorb (CHF 4.50 pro Bestellung,
  gratis ab CHF 69.00).
- **Rückgaberecht & Reklamation:** Alle Punkte, die Google Merchant Center
  abfragt, stehen da. Die Aussagen stimmen mit AGB Ziffer 9/10,
  Widerrufsrecht, FAQ und `MerchantReturnNotPermitted` im Markup überein.
