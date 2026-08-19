/**
 * Alle Texte der Konto-Formulare an einem Ort.
 *
 * WARUM ALS KONSTANTEN UND NICHT INLINE
 * Zwei dieser Meldungen dürfen sich zwischen zwei Fällen NICHT unterscheiden,
 * weil der Unterschied verraten würde, ob es zu einer E-Mail-Adresse ein Konto
 * gibt. Als Konstante kann ein Test genau das prüfen: dass beide Zweige
 * dasselbe Objekt zurückgeben. Als zwei getippte Zeichenketten an zwei Stellen
 * im Code driftet das irgendwann auseinander, und niemand merkt es.
 *
 * Schweizer Schreibweise: ss statt ß.
 */

/**
 * Die einzige Antwort auf "Passwort vergessen" — bei bekannter Adresse, bei
 * unbekannter Adresse, und auch dann, wenn das Backend gar nicht erreichbar
 * war.
 *
 * Der letzte Fall ist der, den man leicht übersieht: ein `catch`, das einen
 * Netzwerkfehler anders beantwortet als den Erfolgsfall, verrät zwar nicht
 * direkt die Existenz eines Kontos — aber sobald ein Zweig anders aussieht als
 * der andere, hat man wieder ein Orakel. Deshalb: eine Antwort, immer.
 */
export const PASSWORT_RESET_ANGEFORDERT =
  "Wenn zu dieser Adresse ein Konto besteht, ist eine E-Mail mit einem Link unterwegs. " +
  "Der Link gilt 15 Minuten. Schau auch im Spam-Ordner nach."

/**
 * Die einzige Antwort auf eine fehlgeschlagene Anmeldung — unbekannte Adresse,
 * falsches Passwort, Konto aus dem Odoo-Import, alles dasselbe.
 *
 * Der Hinweis auf den alten Shop steht hier drin, obwohl er nur eine Minderheit
 * betrifft. Genau das ist der Punkt: bekäme ihn nur, wer wirklich ein
 * importiertes Konto hat, wäre die Meldung selbst die Auskunft "diese Adresse
 * existiert und stammt aus Odoo".
 */
export const ANMELDUNG_FEHLGESCHLAGEN =
  "E-Mail-Adresse oder Passwort stimmen nicht. " +
  "Kommst du aus unserem früheren Shop? Dann setz bitte einmalig ein neues Passwort — " +
  "Passwörter lassen sich technisch nicht übernehmen."

/** Backend nicht erreichbar, an Stellen, an denen das kein Geheimnis verrät. */
export const BACKEND_NICHT_ERREICHBAR =
  "Das hat gerade nicht geklappt. Bitte versuch es in einem Moment noch einmal."

export const EMAIL_UNGUELTIG = "Bitte gib eine gültige E-Mail-Adresse an."

export const PASSWORT_ZU_KURZ = `Das Passwort braucht mindestens ${8} Zeichen.`

export const PASSWOERTER_UNGLEICH = "Die beiden Passwörter stimmen nicht überein."

/**
 * Registrierung mit bereits vergebener Adresse.
 *
 * Diese Meldung verrät die Existenz des Kontos — anders geht es bei einer
 * Registrierung ohne E-Mail-Bestätigung nicht, das Konto kann ja nicht zweimal
 * angelegt werden. Sie ist deshalb bewusst so formuliert, dass sie zur
 * Anmeldung führt statt zu einer Sackgasse. Siehe PR-Text.
 */
export const KONTO_BESTEHT_BEREITS =
  "Mit dieser Adresse besteht bereits ein Konto. Melde dich an oder setz dein Passwort neu."

export const REGISTRIERUNG_FEHLGESCHLAGEN =
  "Das Konto liess sich nicht anlegen. Bitte versuch es noch einmal."

/** Das Reset-Token war ungültig oder die 15 Minuten sind um. */
export const RESET_LINK_ABGELAUFEN =
  "Dieser Link gilt nicht mehr. Fordere auf der Anmeldeseite einen neuen an — " +
  "die Links sind aus Sicherheitsgründen nur 15 Minuten gültig."

export const RESET_LINK_FEHLT =
  "Dieser Aufruf enthält kein Token. Öffne den Link aus der E-Mail direkt, " +
  "ohne ihn abzutippen."

export const PASSWORT_GESETZT =
  "Passwort gespeichert. Du kannst dich jetzt damit anmelden."

export const PROFIL_GESPEICHERT = "Deine Angaben sind gespeichert."

export const ADRESSE_GESPEICHERT = "Die Adresse ist gespeichert."

export const ADRESSE_GELOESCHT = "Die Adresse ist gelöscht."

export const NICHT_ANGEMELDET =
  "Deine Sitzung ist abgelaufen. Bitte melde dich noch einmal an."

/** Mindestlänge des Passworts. Medusa selbst schreibt keine vor. */
export const PASSWORT_MIN_LAENGE = 8
