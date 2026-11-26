# Bereich: Sude (Braubuch)

**Wozu:** Dokumentation aller Sude seit 2018 – Schüttung, Maischplan, Hopfengaben, Hefe, Messwerte, Abfüllung.

**Seite:** `index.html` (Startseite)

## Wer darf was

| Rolle | Darf |
|-------|------|
| Gast | freigegebene Sude lesen – ohne Notizen und Bewertung |
| Braumeister | alle Sude lesen, anlegen, bearbeiten, als CSV sichern; Schalter „Öffentlich zeigen“ je Sud |
| Admin | zusätzlich Sude löschen |

## Dateien

| Datei | Inhalt |
|-------|--------|
| `brews.js` | Kennzahlen, Notenverlauf, Liste nach Jahrgang, Suche/Filter, Details, Editor, CSV-Export, Braugang-Assistent mit Brauprotokoll zum Drucken |
| `brews.css` | Gestaltung nur dieses Bereichs |
| `schema.sql` | Tabelle `sude` mit Rechten (Stand); `rezept_id` kommt aus `features/recipes/schema.sql` |
| `schema/01_messwerte_einheiten.sql` | Messwerte von Freitext auf Zahl + Einheit umstellen (noch nicht angewendet, siehe Offene Punkte) |

## Verbindung zu Rezepten

- „+ Neuer Sud“ fragt: **leer beginnen** oder **aus Rezept** (mit Zielmenge und Anlagenprofil). Der Sud ist eine Kopie mit Verweis.
- Malz hat jetzt Sorte, Gramm, EBC; Hopfen hat Sorte, Gramm, Alpha, Minuten und Art (Vorderwürze, Kochen, Whirlpool, Stopfen).
  Alte Einträge („22 g Magnum · 60 min“) werden beim Bearbeiten in Felder zerlegt, der alte Text bleibt als Hinweis sichtbar.
- **Als Rezept speichern** im Sud macht daraus ein Rezept (Rückweg, mit errechneter Sudhausausbeute).
- Jeder Sud hat eine eigene Seite (wie bei den Rezepten): `index.html?sud=<uuid>`, mit Zurück-Link zur Liste statt Seitenblatt. Bearbeiten, Löschen-Bestätigung und „Neuer Sud“ laufen weiterhin über das Seitenblatt.

## Messwerte (seit 25.10.2026)

Hauptguss, Nachguss, Kochzeit, Würzemenge, Stammwürze, Restextrakt, Ausschlagwürze und Alkohol sind Zahl + Einheit
(gleicher Spaltenname/Typ wie beim entsprechenden Rezept-Feld), „Abgefüllt am“ ein echtes Datum. Der Maischplan ist
wie bei den Rezepten strukturiert: Einmaisch-/Abmaischtemperatur plus `rasten` als `[{temperatur, zeit}]` statt
freier Textzeilen. Die Detailseite folgt jetzt dem Brautag: Schüttung → Brauwasser → Maischplan → Läutern & Kochen
(inkl. Hopfengaben) → Gärung → Abfüllung → Notizen. Freitext bleiben bewusst Wasserbehandlung, Läutern-Beschreibung,
Hefemenge, Messungs-Verlauf, Speise/Zucker und Notizen – das sind Beschreibungen bzw. ein Verlauf, keine Einzelwerte.
Alte Werte alter Sude liegen nach der Migration in `..._alt`-Spalten (Hauptguss etc.) bzw. `maischplan_alt`
(kompletter alter Maischplan) und werden beim Bearbeiten als Hinweis gezeigt, bis sie geprüft/nachgetragen sind.

Bei alten Suden ohne gemessenen Alkoholgehalt wurde teils ein grober Anhaltspunkt aus Stammwürze und Restextrakt
errechnet (ohne Alkoholkorrektur, daher eher die Untergrenze). Solche Werte sind in `alkohol_geschaetzt` markiert
und zeigen auf der Detailseite den Hinweis „Alkohol geschätzt“. Wird der Alkoholwert im Editor von Hand geändert,
setzt `save()` die Markierung automatisch zurück (gleiches Muster wie `datum_geschaetzt`/„Jahr ergänzt“).

## Bewertung: Farbe und Verkostungen (seit 31.10.2026)

Die Bewertung (0–10) ist überall, wo sie angezeigt wird, farbcodiert: Grün ab 7,0, Gelb 4,0–6,9, Rot darunter
(`gradeCls()` in `core/core.js`, gemeinsam genutzt von Suden, Liga und Verkostungen; Farben/Grenzen siehe
`.grade`/`.kw b` in `core/base.css`).

Ist ein Sud über `biere.sud_id` mit einem (eigenen) Bier aus dem Bereich „Verkostungen“ verknüpft, übernimmt die
Sud-Bewertung automatisch den Schnitt aus dessen Bewertungen in abgeschlossenen Verkostungen, sobald mindestens
eine vorliegt (ohne Markierung – anders als `alkohol_geschaetzt`). Das läuft über Datenbank-Trigger in
`features/tastings/schema/10_sud_bewertung_aus_verkostung.sql`, die bei jeder Änderung an Bewertungen, beim
Abschließen/Wiedereröffnen einer Verkostung und beim (Neu-)Verknüpfen eines Biers neu rechnen. Gibt es (noch)
keine abgeschlossene Verkostung mit Bewertungen, bleibt die zuletzt eingetragene bzw. übernommene Bewertung
unverändert – sie wird also nicht automatisch wieder gelöscht.

## Bilder

Jeder Sud kann ein **Foto**, einen **Kronkorken** (rund) und eine **Flasche mit Etikett** (3:4) haben (Editor → „Bilder”, alles freiwillig; bis 07.11.2026 gab es stattdessen ein „Etikett” – vorhandene Etiketten wurden zur Flasche, `bild_etikett` wird nur noch als Rückfall gelesen). Das Foto steht oben in der Ansicht, Kronkorken und Flasche im Kopf; Vorschaubild in der Liste ist der Kronkorken, sonst die Flasche, sonst das Foto – in Kronkorken-Form; ohne Bild zeichnet `lib/bilder.js` einen Kronkorken in der gewählten Kronkorken-Farbe (Feld „Kronkorken”, bleibt auch mit Foto sichtbar – echte farbige Rohlinge), sonst in der Bierfarbe. **Gemeinsam mit dem Bier:** Ist ein Bier im Bier-Katalog mit dem Sud verknüpft (`biere.sud_id`), nutzen beide dieselben Kronkorken-/Flaschen-Dateien; Speichern auf einer Seite zieht die andere mit. „Kopie anlegen” übernimmt keine Bilder. Zuschneiden, „Ausschnitt ändern” und sicheres Löschen: siehe `core/README.md` bzw. `lib/bilder.js`. Pfade: `sude/<id>/foto-…jpg`, `…/kronkorken-…jpg`, `…/flasche-…jpg` (jeweils mit `_t` Vorschau und `_b` unbeschnittenem Basisbild).

## Fotogalerie „Fotos vom Brautag” (seit 25.10.2026)

> **Stand 07.11.2026:** Die Galerie-Oberfläche steckt jetzt im gemeinsamen Modul `Bilder.galerieModul` (`lib/bilder.js`),
> das auch die Verkostungs-Galerie nutzt. `brews.js` liefert nur noch Laden/Einfügen/Ändern/Löschen für `sud_bilder`
> (`galerieLaden()`). Neu: In der Ablage kann jedes Foto vor dem Hochladen zugeschnitten werden („Zuschneiden“), beim
> Bearbeiten eines vorhandenen Fotos gibt es „Ausschnitt ändern“. Ohne Zuschneiden wird das ganze Foto übernommen –
> dann wird **kein** zusätzliches Basisbild gespeichert (Großbild = Basisbild, Speicher sparen). Die Abschnitte unten
> beschreiben die Entstehung; Funktionsnamen wie `galerieDateienHinzufuegen`/`galerieTrayZeichnen` gibt es nicht mehr.

Eigener Abschnitt auf der Sud-Detailseite, unterhalb der übrigen Werte. Tabelle `sud_bilder`
(`features/brews/schema/02_sud_fotos.sql`): Pfad, optionale Bildunterschrift, wer hochgeladen hat.
Anders als bei den Verkostungsfotos gibt es hier **keine Gäste-Uploads** – nur Braumeister/Admin laden
hoch, bearbeiten die Bildunterschrift (✎) oder löschen (✕, mit Bestätigung). **Seit 25.10.2026 ist auch das
Ansehen nur Braumeister/Admin vorbehalten**, unabhängig vom „Öffentlich zeigen”-Status des Suds (zuvor durften
Gäste die Galerie öffentlicher Sude lesend sehen – auf Nutzerwunsch geändert, siehe `schema/04_sud_fotos_nur_braumeister.sql`,
RLS-Policy „Galerie lesen” per `alter policy ... to authenticated` auf `private.ist_braumeister()` eingeschränkt,
`anon` zusätzlich das Tabellen-Grant entzogen). Gäste sehen statt der Fotos nur den Hinweis „Melde dich als
Braumeister an, um die Fotos vom Brautag zu sehen.” – die Oberfläche fragt dafür `sud_bilder` für Gäste gar nicht
erst ab (`galerieLaden()` in `brews.js` überspringt die Abfrage, wenn `!isBM()`).

- **Hochladen:** Kachel „Fotos hinzufügen” am Ende des Rasters → Mehrfachauswahl (auch Kamera am Handy) →
  jedes Foto landet zuerst in einer Ablage mit eigenem, optionalem Bildunterschrift-Feld; erst „Hochladen”
  verkleinert (`Bilder.verkleinern`) und lädt tatsächlich hoch (`Bilder.hochladen`, Pfad
  `sude/<id>/galerie/foto-…jpg`) und legt je Foto eine Zeile in `sud_bilder` an.
- **Anzeige:** Raster mit Bild + Bildunterschrift (`Bilder.galerieHtml(…, {beschriftet:true})`), Antippen
  öffnet die Großansicht zum Durchklicken (`Bilder.zeigen`, zeigt die Bildunterschrift mit an). Sortierung
  nach `angelegt` aufsteigend (älteste zuerst, wie der Brauverlauf).
- `lib/bilder.js`s `galerieHtml`/`galerieVerdrahten`/`zeigen` wurden dafür erweitert: Einträge dürfen jetzt
  `{pfad, bildunterschrift}` statt nur ein Pfad-String sein; neue Optionen `bearbeitbar` (✎-Knopf) und
  `extra` (zusätzliches Raster-Element, hier die „Hinzufügen”-Kachel). Abwärtskompatibel – Verkostungen
  übergeben weiterhin reine Pfad-Arrays ohne Bildunterschrift.

### Aufnahmedatum auf dem Vorschaubild (seit 25.10.2026)

Jedes Vorschaubild zeigt klein unten rechts das Datum im Format `DD.MM.JJ` (nicht in der Großansicht).

- Quelle ist das **EXIF-Aufnahmedatum** der Foto-Datei (`DateTimeOriginal`, sonst `DateTime`), ausgelesen
  im Browser aus der Originaldatei *bevor* `Bilder.verkleinern` sie auf ein Canvas zeichnet (dabei geht
  EXIF verloren). Dafür `Bilder.exifDatum(datei)` in `lib/bilder.js` – ein minimaler, abhängigkeitsfreier
  JPEG/Exif-Parser (liest nur die ersten 128 KB), liefert `"YYYY-MM-DD"` oder `null`.
- Hat ein Foto kein EXIF-Datum (z. B. Screenshot, bereits bearbeitetes Bild), zeigt die Oberfläche
  stattdessen das Hochlade-Datum (`sud_bilder.angelegt`) an.
- Neue Spalte `sud_bilder.aufgenommen` (date, nullable) – `schema/03_sud_fotos_datum.sql`.
- `galerieHtml`-Einträge dürfen zusätzlich `datum` (fertig formatierter String) tragen → rendert
  `<span class="g-datum">` unten rechts im Vorschaubild; ohne `datum` bleibt alles wie zuvor.
- **Von Hand nachtragen/korrigieren (seit 26.10.2026):** Der ✎-Knopf bearbeitet jetzt Bildunterschrift UND
  Aufnahmedatum zusammen (`galerieBearbeiten()` in `brews.js`, zweizeilige Eingabe: Bildunterschrift oben,
  Datum + Knöpfe darunter, `<input type="date">` für die native Datumsauswahl auch am Handy). Nicht nur für
  Fotos ohne Exif-Datum gedacht, sondern für alle – so lässt sich auch ein falsches Exif-Datum korrigieren
  (z. B. Kamera-Uhr nicht gestellt). Leer gelassen/gelöscht fällt die Anzeige wieder automatisch auf Exif
  bzw. Hochlade-Datum zurück, wie zuvor.
- Unit-Test für den Exif-Parser: `tests/exif_test.js` (reiner Node, baut sich einen minimalen
  JPEG+Exif-Puffer selbst), da das Playwright-Testfoto `tests/data/foto.jpg` kein EXIF enthält und daher
  nur den Fallback-Pfad abdeckt.

### Fotos per Drag & Drop hinzufügen (seit 25.10.2026)

Zusätzlich zur Kachel „Fotos hinzufügen” (Klick → Dateiauswahl, nötig fürs Handy) kann man am Computer Fotos
auch direkt per Drag & Drop auf die Galerie ziehen – z. B. aus der Mac-Fotos-Mediathek.

- **Drop-Fläche** ist die ganze Galerie-Sektion (`#sudGalerieSec`), nicht nur die Kachel – leichter zu
  treffen. Beim Drüberziehen hebt sich die Fläche hervor (`.sg-dragover`, gestrichelter Rahmen). Nur für
  Braumeister/Admin wirksam; bei Gästen passiert nichts (RLS verbietet den Upload ohnehin, aber schon die
  Oberfläche reagiert gar nicht erst).
- Gezogene Dateien landen genau wie ausgewählte in der Ablage (gemeinsame Funktion
  `galerieDateienHinzufuegen` in `brews.js`) – gleiche Bildunterschrift-Eingabe, gleicher „Hochladen”-Knopf.
- **HEIC/HEIF:** macOS Fotos liefert je nach Einstellung („Originale beibehalten”) beim Herausziehen HEIC
  statt JPEG – das kann kein Browser direkt in ein `<img>` laden. `Bilder.alsJpegDatei(datei)` in
  `lib/bilder.js` erkennt das (Dateityp/-endung) und lädt bei Bedarf einmalig `heic2any` von cdnjs nach, um
  nach JPEG zu wandeln (einzige CDN-Abhängigkeit im sonst komplett lokal eingebundenen Code – ein
  selbst gehosteter HEIC-Decoder bräuchte ein größeres WASM-Binary, das nur für diesen Randfall ständig
  mitgeladen würde). Das Exif-Aufnahmedatum wird vor der Umwandlung vom Original gelesen; falls die
  HEIC-Datei doch keins enthält, greift wie gehabt der Fallback auf das Hochlade-Datum.
- Playwright-Test simuliert Drag & Drop per selbst gebautem `DataTransfer` (`foto_dragdrop()` in
  `tests/run_tests.py`) – echtes Browser-Drag lässt sich darüber nicht testen, wohl aber die Events, die ein
  echter Drop auslöst.

### Mit dem Finger wischen in der Großansicht (seit 25.10.2026)

In der Großansicht (`Bilder.zeigen()` in `lib/bilder.js`, nicht brews-spezifisch) kann man jetzt auf dem Handy
zum nächsten/vorigen Foto wischen, statt nur die Pfeil-Knöpfe zu treffen. Da `zeigen()` von allen Galerien der
Seite genutzt wird (Sud-Fotos, Verkostungs-Galerie, Liga-Bilder), profitieren automatisch alle davon.

- Reine `touchstart`/`touchend`-Auswertung (kein Live-Mitziehen des Bildes) – zählt nur eine überwiegend
  waagerechte Wischgeste über 45 px Mindestlänge als Foto-Wechsel, damit ein leicht schräger Tap zum
  Schließen nicht versehentlich das Foto wechselt. Nach links = nächstes, nach rechts = voriges Foto.
  Bei nur einem Foto passiert nichts.
- Playwright-Test löst dafür eigene `TouchEvent`/`Touch`-Objekte aus (`wische()` in `tests/run_tests.py`);
  der Browser-Kontext braucht dafür `has_touch=True` beim `new_context(...)`.

## Checkliste zum Brautag (27.10.2026 – 07.11.2026, entfernt)

Gab es bis 7.11.2026 als eigenen Modus auf der Sud-Detailseite (abhakbare Schritte, abgeleitet aus Maischplan
und Hopfengaben). Auf Wunsch des Nutzers komplett aus dem Code entfernt – der Braugang-Assistent deckt den
Brautag ab. Die Tabelle `sud_schritte` (`schema/05_sud_schritte.sql`) und ihre Daten liegen bewusst
unverändert in der Datenbank, werden aber von keinem Code mehr gelesen; sie kann bei Gelegenheit im
Supabase SQL Editor gelöscht werden.

## Normaler Editor = alle Werte des Assistenten (seit 07.11.2026)

Vorher gab es Wasserhärte, Milchsäure je Guss, pH vorher/nachher, Refraktometer (Anstellen/Restextrakt),
Karbonisierung, „Eigene Angaben“ (`wizard_notizen`) und Zwischenmessungen (`sud_messungen`) nur im
Braugang-Assistenten. Nach „Sud abschließen“ führt „Bearbeiten“ aber in den normalen Editor – Tippfehler
waren dann nicht mehr korrigierbar. Jetzt hat der normale Editor alle diese Felder (`FIELDS`, `WRITE_COLS`),
Zwischenmessungen werden beim Speichern abgeglichen (`edMessungenSpeichern`: neu/geändert/entfernt).
- Alte Freitextfelder „Hopfensorten“ und „Messungen“ erscheinen nur noch, wenn sie befüllt sind
  (`altFeld()`), gekennzeichnet als „(alter Freitext)“.
- Speichern-Leiste beim Bearbeiten auf der Detailseite bleibt unten am Bildschirm stehen (`.edit-fuss`).
- Malz- und Messungszeilen am Handy zweizeilig (Sorte/Bezeichnung oben), damit vierstellige Grammangaben passen.
- Detailseite: „Bearbeiten“/„Braugang-Assistent“ zuerst, dann „Kopie anlegen“ (hieß „Als Vorlage nutzen“),
  „Als Rezept speichern“, „Löschen“. Kennzahlen am Handy 2 × 2, wenn es vier sind.

## Eingaben schützen und Rechnungen glätten (22.11.2026)

Ergebnis einer Prüfung des ganzen Brauvorgangs (Logik, Bedienung, Barrierefreiheit). Die wichtigsten Funde, bei denen
Eingaben verloren gehen oder falsche Zahlen erscheinen konnten, sind behoben:

- **Abbrechen fragt nach**, wenn seit dem Öffnen etwas geändert wurde – im Editor auf der Detailseite (`editInline`) und im
  Blatt (`openEditor`, z. B. „Kopie anlegen“; auch bei Esc und Klick daneben). Dafür gibt es in `core/core.js`
  `KB.sheetSchutz(f)`; `closeSheet(true)` schließt ohne Rückfrage (nach dem Speichern, beim Abmelden). Vergleich über
  `aenderungsstand()`.
- **Esc** schließt in einer Rückfrage nur die Rückfrage, nicht auch das Blatt darunter.
- **„Sud abschließen“** (Schritt 9) fragt nach, wenn Abfülldatum oder Flaschen fehlen.
- **Autosave im Assistenten:** Bei einem Verbindungsfehler (Fehler ohne Datenbank-Code) bleibt die Änderung erhalten und
  wird nach 5 s erneut geschickt; die Anzeige sagt „noch nicht gespeichert“. Eine von der Datenbank *abgelehnte* Änderung
  wird bewusst nicht wiederholt (sie würde sonst alle folgenden Änderungen mitblockieren).
- **Rezept → Sud** übernimmt jetzt auch die Karbonisierung (damit startet der Zucker-Rechner gefüllt) und die weiteren
  Zutaten (als Zeile in den Notizen).
- **Alte Hopfengaben:** Der Originaltext wird beim ersten Speichern einmalig in die Notizen übernommen
  („Hopfengaben vor der Umwandlung: …“), statt zu verschwinden.
- **„Kopie anlegen“** setzt auch den Alkohol-Status zurück. **0 Flaschen** ist ein gültiger Wert.
- **Farbe (EBC)** ist stetig und wird mit mehr Malz nie heller (vorher sprang sie bei 60 EBC, z. B. 58 → 29). Über
  60 EBC gilt weiter Morey, aber nie weniger als 60.
- **Alkohol** aus Messung oder Refraktometer wird nie negativ (Restextrakt über Stammwürze → kein Wert).
- `fmtGramm(999,6)` zeigt „1 kg“ statt „1.000 g“.

## Offene Punkte

Aus der Prüfung vom 22.11.2026 bewusst noch nicht umgesetzt (jeweils mit Grund):

- **Entwürfe verwerfen:** „Sud aus Rezept“ legt sofort einen Eintrag an; nur der Admin kann löschen. Braucht eine
  zusätzliche Datenbank-Policy (löschen erlaubt für `status = 'entwurf'`) plus Knopf – Rechteänderung, eigene Entscheidung.
- **IBU für Whirlpool:** `ibu()` zählt Whirlpool fest wie 0,5 min Kochzeit (Näherung nach MMuM), „Kochen 0 min“ dagegen
  mit 10 min Nachisomerisierung. Das ist im Code so begründet; ob es für die eigene Anlage stimmt, ist eine fachliche Frage.
- **Milchsäure-Empfehlung** (`Hauptguss/Nachguss`): rechnet mit Gesamthärte × Liter × 0,09 ml, ohne Säurestärke und
  Karbonathärte; vermutlich zu hoch. Fachlich prüfen, dann Formel anpassen oder deutlich als grobe Schätzung kennzeichnen.
- **`stil` bei Sud aus Rezept** wird auf den Rezeptnamen gesetzt (der Bierstil des Rezepts fällt weg) – wirkt sich auf
  Titel und Stil-Auswahl aus; Entscheidung, was `stil` bedeuten soll.
- **Rechte:** Wer eingeloggt ist, aber keine Rolle hat, sieht keine öffentlichen Sude (bei Rezepten ist es anders gelöst);
  ein öffentlich geschalteter Entwurf wäre für Gäste sichtbar.
- **Bedienung am Handy** (Tippflächen unter 44 px, Schriftgrößen unter 16 px, Rezept-Editor ohne feste Leiste, Schritt 9)
  und **Barrierefreiheit** (Dialoge mit Fokusführung, Feldrahmen-Kontrast, Fehlermeldungen als `role="alert"`): eigener Block.
- **Ungespeicherte Eingaben beim Verlassen der Seite** („← Alle Sude“, Zurück-Taste) werden noch nicht abgefangen.

**Entscheidung zu den Altdaten (22.11.2026):** Die Hopfen-Freitexte der alten Sude (Nr. 1–21, aus Google Sheets
übernommen) werden bewusst **nicht** in einem Rutsch umgeschrieben. Sie haben noch die Form
`{zeit: "40 Min. vor Ende", menge: "14 g Magnum"}` plus den Freitext `hopfensorten`; neue Sude (ab Nr. 22) haben
`{sorte, gramm, alpha, zeit, typ}`. Beides nebeneinander ist gewollt und funktioniert:

- **Anzeige:** `hopfenLinks()`/`hopfenRechts()` zeigen alte Gaben als Text, neue strukturiert.
- **Bearbeiten:** `hopfenNeu()` rechnet eine alte Gabe beim Öffnen im Editor um (Gramm, Alpha, Sorte, Minuten aus
  dem Text; den Originaltext behält das Feld `alt`). Gespeichert wird erst mit „Speichern“ – dann liegt der Sud im
  neuen Format. Der Freitext `hopfensorten` erscheint nur noch, wenn er befüllt ist.
- Einzelne Eigenheiten stecken im Inhalt, nicht in der Struktur (Sud 3: „Stopfen“/„Whirlpool“ ohne Menge; Sud 6:
  Gewürze statt Hopfen; Sud 14: zwei Spalter-Gaben mit verschiedenem Alpha; Sud 21: `hopfensorten` nennt Northern
  Brewer, die erste Gabe aber Magnum). Wer einen dieser Sude bearbeitet, korrigiert das dabei von Hand.

## Braugang-Assistent (seit 31.10.2026, Schritt „Abfüllung” + Alkohol-Berechnung 31.10.2026 ergänzt)

Der Assistent erfasst während des Brauens die tatsächlichen Werte eines aus einem Rezept gestarteten Braugangs,
in neun Schritten (Rezept & Start, Wasser & Milchsäure, Schüttung, Maischen, Läutern, Kochen, Kühlen &
Anstellen, Gärung, Abfüllung). Kopf/Fuß sind bewusst wie beim Verkostungs-Bewertungsbogen gehalten
(`features/tastings/form.js`): oben klein nur der Braugang-Titel, darunter groß der aktuelle Schrittname;
unten eine schmale Punkte-Leiste + „n / 9” + Zurück/Weiter (hier zusätzlich: die Punkte sind anklickbar, um
direkt zu einem Schritt zu springen – im Bewertungsbogen selbst nicht, dort ist die Reihenfolge fest). Anders
als beim Bewertungsbogen ist die Fußleiste `#wzFuss` hier `position:fixed` am unteren Bildschirmrand verankert,
damit Zurück/Weiter bei unterschiedlich hohen Schritten nicht auf der Seite herumspringen und immer ohne
Scrollen erreichbar sind – `.sud-blatt.wz` reserviert dafür unten entsprechend Platz. (`position:sticky` wäre
die naheliegendere Lösung gewesen, scheitert aber an `overflow-x:hidden` auf html/body – siehe Kommentar in
`brews.css`.) Zurück/Weiter (`#wzBack`/`#wzNext`) sind zusätzlich exakt wie `#bWeiter`/`#bZurueck` im
Bewertungsbogen gleich breit (`flex:1`), statt Zurück als kleiner Kreis und Weiter als großer Pill-Button.

Die Abschnitte auf der fertigen Sud-Seite (`zeigeDetail()`) folgen seit Kurzem derselben Reihenfolge wie die
Schritte des Assistenten (Brauwasser vor Schüttung, davor war es umgekehrt) – Läutern/Kochen bzw.
Anstellen/Gärung bleiben weiterhin zu je einem Abschnitt zusammengefasst wie schon vorher, weil sie inhaltlich
ohnehin direkt aufeinander folgen und eine weitere Aufspaltung nicht verlangt war.

- **Kein eigenes Datenmodell für die Werte selbst** – jedes Feld schreibt direkt in dieselbe Spalte von
  `public.sude`, die auch der normale Editor benutzt (`hauptguss`, `malz`, `rasten`, `hopfen`, `kochzeit`,
  `stammwuerze`, `hefe`, `abgefuellt`, …). Neu sind nur ein paar bisher fehlende Messwerte und ein Status –
  siehe `schema/08_braugang_assistent.sql`: `status` (`entwurf` → `gaerung` → `dokumentiert`; alle Alt-Sude
  stehen auf `dokumentiert`), `wasserhaerte`, `milchsaeure`, `ph_vorher`, `ph_nachher`,
  `refraktometer_anstellen`, `refraktometer_restextrakt`, `wizard_notizen` (offenes Katalog-Feld für Angaben,
  die zu keiner festen Spalte passen) sowie die neue Tabelle `sud_messungen` für beliebig viele
  Zwischenmessungen während der Gärung (Bezeichnung frei, z. B. „Tag 4“, plus Grad Plato und/oder
  Refraktometer) – RLS wie bei `sud_schritte`/`sud_bilder`, reines Arbeitswerkzeug.
- **Sofortiger Entwurf:** Der Sud entsteht schon bei Schritt 1 in Supabase (Status `entwurf`) und erscheint
  damit sofort in der normalen Sudliste (Status-Badge „Entwurf“/„Gärung läuft“), statt erst am Ende.
- **Autosave statt Speichern-Knopf:** Jede Änderung schreibt mit kurzer Verzögerung (`wizardQueueSave`,
  500 ms, alle gleichzeitig anstehenden Änderungen gesammelt in einem Schreibvorgang) direkt nach Supabase –
  ein versehentliches Neuladen verliert nichts, weil beim erneuten Öffnen einfach der zuletzt gespeicherte
  Stand geladen wird. Kein eigener Zwischenspeicher im Browser nötig.
- **Schüttung/Maischen/Kochen** nutzen dieselben Listen-Felder (`rowsHTML`) wie der normale Editor – „+ Malz“/
  „+ Rast“/„+ Hopfengabe“ funktionieren identisch, nur mit Autosave statt Sammel-Speichern.
- **Milchsäure-Rechner** im Wasser-Schritt: aus Karbonathärte (KH, °dH), Ziel-KH und Hauptguss/Nachguss die
  Menge Milchsäure 80 % je Guss (`Brau.milchsaeure` in `lib/brau.js`, Herleitung dort: ≈ 0,035 ml je Liter
  und °dH, also 1 ml senkt 10 l um knapp 3 °dH). Die Ziel-KH steht in `ziel_kh` (`schema/12_ziel_kh_speise.sql`),
  ohne eigenen Wert zeigt das Feld 2 °dH und speichert ihn beim ersten „übernehmen“ (vorher sprang sie beim
  Zurückblättern auf 2). Die Spalte `wasserhaerte` heißt in der Oberfläche „Karbonathärte (KH)“ – Säure wirkt
  nur auf die KH. Die erste Fassung rechnete `Härte × Liter × 0,09` (ca. 2,6-mal zu viel Säure).
- **Speise/Zucker als Auswahl:** `speise_art` (Haushaltszucker, Traubenzucker, Speise) plus `speise_menge`
  (Zucker in g für die ganze Biermenge, Speise in l), im Assistenten und im Editor. Der Zucker-Rechner rechnet
  g/l × Biermenge, Traubenzucker × 198/171 (Monohydrat). Für Speise weiter kein Rechner. Die alte Freitextspalte
  `zucker` erscheint nur noch, wenn sie befüllt ist, die Sud-Seite zeigt beides.
- **Abfüllung neu geordnet (22.11.2026):** drei Blöcke wie am Abfülltag – Abfüllen (Datum, Biermenge, Flaschen),
  Karbonisieren (Ziel, höchste Gärtemperatur, Knöpfe Haushaltszucker/Traubenzucker/Speise statt Dropdown,
  Menge mit Empfehlung direkt darunter), Ergebnis (Alkohol). „Sud abschließen“ sitzt in der Fußleiste statt
  „Weiter“, die Ausschlagwürze bei „Kühlen & Anstellen“ (im Editor und auf der Sud-Seite bei Läutern & Kochen).
  Die Gärtemperatur (`gaertemperatur`, `schema/13_gaertemperatur.sql`) bestimmt die Restkohlensäure
  (`Brau.restkohlensaeure`); ohne Wert gilt weiter 1,7 g/l. Im Editor bleibt Speise/Zucker ein Dropdown.
- **Hefemenge in g:** Zahlenfeld (Feldtyp `gramm`), gespeichert in der bestehenden Textspalte `hefemenge`.
  Alte Einträge wie „2 × 11 g“ bleiben ein Textfeld, bis sie geändert werden; reine Zahlen zeigt die Sud-Seite
  mit „g“.
- **Kein Undo-Knopf** im Assistenten: bewusst entschieden (22.11.2026), passt nicht zum automatischen Speichern.
- **Gärung bleibt offen:** Dieser Schritt lässt sich beliebig oft erneut besuchen (über die Sud-Detailseite,
  Knopf „Braugang-Assistent“, oder automatisch beim Öffnen eines noch nicht dokumentierten Suds), um weitere
  Zwischenmessungen nachzutragen, ohne die vorherigen Schritte anzufassen.
- **Abfüllung** ist ein eigener, letzter Schritt (Abfülldatum, Speise/Zucker, Flaschen, Biermenge,
  Ausschlagwürze, Alkohol) – bewusst von der Gärung getrennt, weil das inhaltlich zwei verschiedene Phasen
  sind. Erst der bewusste Klick auf „Sud abschließen“ dort setzt den Status auf `dokumentiert`.
- **Alkohol automatisch berechnet:** Sobald sowohl Stammwürze (Anstellen-Schritt) als auch Restextrakt
  (Gärung-Schritt) vorliegen, füllt `wizardAlkoholAutoberechnen()` das Alkohol-Feld im Abfüllung-Schritt
  automatisch – über die neue `Brau.alkoholAusMessung(stammwuerze, restextrakt)` in `lib/brau.js`
  (Balling-Näherung wie bei der bestehenden `Brau.alkohol(plato, evg)`, aber mit zwei echten Messwerten statt
  einem angenommenen Endvergärungsgrad, also genauer). Wird der Wert von Hand im Abfüllung-Schritt
  überschrieben, merkt sich das bestehende Feld `alkohol_geschaetzt` das (wie schon beim normalen Editor) und
  die Automatik überschreibt ihn danach nicht mehr kommentarlos – stattdessen erscheint, solange der Wert vom
  berechneten abweicht, ein Warnhinweis „Von Hand geändert – weicht von der Berechnung ab“ mit einem
  „↺ Auf Berechnung zurücksetzen“-Link (`#wzAlkoholZuruecksetzen` in `brews.js`), der `alkohol_geschaetzt`
  wieder auf `true` setzt. Zusätzlich, sobald beide Refraktometer-Werte
  (Anstellen + Gärung) vorliegen, zeigt der Abfüllung-Schritt als reinen Hinweistext (nicht gespeichert, nur
  zum Vergleich) einen zweiten Alkoholwert aus `Brau.alkoholAusRefraktometer(ogBrix, fgBrixUnkorrigiert)` –
  Refraktometer-Endwerte lassen sich nicht wie Plato-Werte direkt verrechnen, weil der Alkohol selbst die
  Lichtbrechung verfälscht; die Funktion korrigiert das nach der in der Homebrewing-Szene verbreiteten
  „Sean-Terrill“-Näherungsformel (lineare Fassung). Wie beim Wasserhärte-Rechner: eine anerkannte
  Faustformel zur Orientierung, kein Laborwert, keine Berücksichtigung eines geräteeigenen Korrekturfaktors.
- **„Messungs-Verlauf” (Freitext) bewusst nicht im Assistenten:** Das Feld gab es schon vorher auf `sude`, als
  Freitext-Platz für einen handschriftlichen Verlauf der Gärungsmessungen. Mit den strukturierten
  Zwischenmessungen (`sud_messungen`, siehe oben) ist das für neue, über den Assistenten geführte Sude
  überflüssig – die Spalte und das Feld im normalen Editor bleiben für ältere Sude bestehen, tauchen im
  Gärung-Schritt des Assistenten aber nicht mehr auf.
- **Zucker-Rechner im Abfüllung-Schritt:** neues Feld `karbonisierung` (g/l CO2, analog zu `rezepte.karbonisierung`,
  siehe `schema/09_karbonisierung.sql`) plus `Brau.primingZucker(zielGl, restGl)` in `lib/brau.js` – errechnet aus
  der gewünschten Karbonisierung die nötige Menge Haushaltszucker **je Liter Bier** (nicht als Gesamtmenge für die
  ganze Biermenge), mit „Übernehmen“ in das freie „Speise / Zucker“-Feld. Braucht dafür bewusst keine Biermenge
  als Eingabe – die Dosierung pro Liter ist unabhängig von der Gesamtmenge. Nimmt ohne eigenen Messwert eine
  Restkohlensäure von ca. 1,7 g/l an (Richtwert für ca. 18–20 °C Gärtemperatur, `Brau.REST_CO2_STANDARD_GL`) – wie
  beim Wasserhärte-Rechner eine Näherung, kein Laborwert.
  Geprüft, ob die Formel mit Stammwürze/Restextrakt zusammenhängt: **nein** – die Restkohlensäure beim Abfüllen
  ist rein temperaturabhängig (gelöstes CO2 aus der Gärung), nicht von der Stammwürze oder dem erreichten
  Restextrakt. Die Formel braucht nur das Karbonisierungsziel und die angenommene/gemessene Restkohlensäure.
  **Für Speise (unvergorene Würze statt Zucker) gibt es bewusst keinen Rechner:** die dafür in der Fachliteratur
  übliche Formel (nach Ludwig Narziss) hängt tatsächlich von Stammwürze und Restextrakt (bzw. Vergärungsgrad) ab
  – ergab bei einer Gegenprobe mit Beispielwerten aber ein unplausibles Ergebnis (~46 % der Biermenge als Speise
  statt der in der Praxis üblichen wenigen Prozent) – bevor die nicht zuverlässig verifiziert werden kann, lieber
  kein Wert als ein möglicherweise falscher.
- **Resume:** `index.html?sud=<id>` öffnet für Braumeister/Admin automatisch den Assistenten (statt der
  normalen Detailansicht), solange der Status nicht `dokumentiert` ist – bei `gaerung` direkt beim
  Gärung-Schritt, sonst beim ersten.
- **Ohne Seiten-Kopf-/Fußzeile, fürs Handy:** Während des Assistenten sind die sticky Kopfzeile
  (Logo/Menü/Konto), die Seiten-Fußzeile (Impressum/Datenschutz-Links) und die „Sude“-Titelzeile samt
  „+ Neuer Sud“-Knopf ausgeblendet (`kopfzeileZeigen()` plus `#sudeActions` in `brews.js`) – es bleibt nur der
  kleine „← Zurück“-Link oben, das spart auf dem Handy spürbar Höhe. Alle drei werden beim Verlassen
  (Detailansicht, „Sud nicht gefunden“) wieder eingeblendet.
- **Wasser-Schritt mit getrennter Milchsäure je Guss:** Hauptguss und Nachguss haben jeweils ein eigenes
  Milchsäure-Feld direkt daneben (`milchsaeure_hauptguss`/`milchsaeure_nachguss`, ersetzt die zu grobe erste
  Fassung mit nur einem gemeinsamen Feld – siehe `schema/10_milchsaeure_getrennt.sql`), mit je einem eigenen
  „übernehmen“-Link für die Wasserhärte-Empfehlung. **Wichtiger Bugfix dabei:** der alte „Übernehmen“-Knopf
  setzte den Feldwert mit `Bz.fmtZahl()` (deutsches Komma-Format, z. B. „12,3“) direkt als `.value` eines
  `<input type="number">` – das lehnt der Browser bei einem Komma still ab (HTML-Zahlenfelder verlangen immer
  einen Punkt als Dezimaltrennzeichen), sichtbar wurde der tatsächlich gespeicherte Wert erst nach erneutem
  Rendern (z. B. Zurück/Vor), weil `field()` dort den rohen Zahlenwert nutzt. Jetzt wird der rohe Wert gesetzt.
- **Zusätzliche Felder landen auf der fertigen Sud-Seite:** alle im Assistenten neu hinzugekommenen Werte
  (Wasserhärte, pH vorher/nachher, Milchsäure Hauptguss/Nachguss, Refraktometer-Werte, Karbonisierung) werden
  jetzt auch in `zeigeDetail()` angezeigt (Brauwasser-, Läutern & Kochen-, Gärung- und Abfüllung-Abschnitt),
  die Zwischenmessungen bekommen einen eigenen Abschnitt (`messungenDetailLaden()`, lädt `sud_messungen` nach,
  nur für Braumeister/Admin sichtbar wie die Fotogalerie) und „eigene Angaben“ (`wizard_notizen`) einen
  eigenen „Eigene Angaben“-Abschnitt. Vorher wurden diese Werte zwar gespeichert, aber nirgends mehr gezeigt.
- Ausgelöst wird der Assistent an den beiden bestehenden „Aus Rezept”-Stellen: „+ Neuer Sud” → „Aus Rezept”
  auf der Sude-Seite, und „Sud aus diesem Rezept anlegen” auf der Rezept-Detailseite (`einstiegVerarbeiten()`/
  `neuerSud()` in `brews.js`) – beide riefen zuvor den normalen Editor auf. „Leer beginnen” und „Als Vorlage
  nutzen” (Kopie eines bestehenden Suds) bleiben unverändert beim normalen Editor, da dort kein Rezept-Plan
  zum Vergleich existiert.

## Brauprotokoll drucken (seit 23.11.2026)

Im Braugang-Assistenten sitzt oben rechts im Kopf, auf jedem Schritt neben „gespeichert“, ein kleiner Knopf
„Drucken“. Er druckt immer den ganzen Sud als **Brauprotokoll auf einem A4-Bogen, Vorder- und Rückseite**,
egal auf welchem Schritt man gerade ist. Es gibt keine PDF-Bibliothek: Gedruckt wird über den Druckdialog des
Browsers, dort auch „Als PDF sichern“, genau wie bei den Rezepten. Strg+P während des Assistenten druckt
ebenfalls den Bogen (`beforeprint`).

- **Gedacht als Arbeitsblatt am Kessel:** Was im Assistenten schon eingetragen ist, wird gedruckt, alles
  Fehlende ist eine leere Schreiblinie. Darum lohnt es sich, vor dem Drucken z. B. die Karbonathärte
  einzutragen. Die Rezept-Sollwerte stehen bewusst **nicht** neben jedem Feld, weil die Felder beim Anlegen
  ohnehin aus dem Rezept vorbefüllt sind. Im Kopf steht nur eine Zeile „Nach Rezept … · Ziel: Liter, °P, IBU,
  EBC, % vol“.
- **Gliederung wie die Schritte des Assistenten** (mit derselben Nummer): vorne der Brautag mit Kopf (Rezept
  & Start), Wasser & Milchsäure, Schüttung, Maischen, Läutern, Kochen. Hinten folgen Kühlen & Anstellen,
  Gärung, Abfüllung und linierte Notizen bis zum Seitenende.
- **Zum Mitschreiben:** Rasten und Hopfengaben haben eine Spalte für die Uhrzeit und ein Kästchen zum
  Abhaken, Schüttung ebenfalls ein Kästchen. Alle drei Tabellen bekommen eine freie Reservezeile. Dazu gibt es
  leere Felder für Uhrzeiten (Einmaischen, Abmaischen, Läuterbeginn, Kochbeginn), für Anstelltemperatur und
  „Angestellt am“. Die Gärung hat eine Messtabelle (Datum/Tag, Spindel, Refraktometer, Temperatur, Notiz),
  vorhandene Zwischenmessungen stehen darin, aufgefüllt auf 7 Zeilen. Stopfhopfen steht nicht beim Kochen,
  sondern als eigene Tabelle unter der Gärung.
- **Empfehlungen wie im Assistenten:** Milchsäure je Guss (`Brau.milchsaeure`). Ohne Karbonathärte steht
  stattdessen die Faustregel (ml je Liter und °dH) zum Selbstrechnen da. Zucker für die Nachgärung
  (`Brau.primingZucker`): als g/l mal Biermenge, ohne Biermenge mit Lücke zum Ausrechnen. Für Speise gibt es
  wie im Assistenten keinen Rechner. Die Wahl Haushaltszucker/Traubenzucker/Speise steht als drei Kästchen
  da, die gewählte ist angekreuzt.
- Eigene Angaben (`wizard_notizen`) erscheinen beim jeweiligen Schritt.
- **Technik:** `brauProtokollHtml()` in `brews.js` baut den Bogen bei jedem Druck frisch aus `wizard.sud`
  (dort stehen alle Änderungen sofort, auch die, deren Autosave noch läuft) und `wizard.messungen`. Der Bogen
  liegt als `#brauProtokoll` direkt im `body`, außerhalb von `.wrap`, und ist auf dem Bildschirm unsichtbar.
  `kopfzeileZeigen()` setzt während des Assistenten `body.wz-aktiv`. Damit blendet das Druck-CSS in
  `brews.css` (`@page` A4, feste Schwarz-Weiß-Farben, also kein Dunkelmodus im Druck) alles andere aus.
- **Passt auf den Bogen:** `tests/_wizard_check.py` erzeugt das PDF wie der Druckdialog und prüft, dass es
  2 Seiten sind (auch mit Werten). Von Hand geprüft mit 6 Malzen, 4 Rasten, 5 Koch- und 2 Stopfgaben: Vorne
  ist dann noch etwas Platz. Bei sehr langen Listen (geprüft mit 16 Malzen) läuft der Bogen auf
  eine dritte Seite über. Abgeschnitten wird nichts, die Abschnitte bleiben ganz, nur die Seitenangabe
  „Seite 1 / 2“ im Fuß stimmt dann nicht mehr.
- **Auch auf der Sud-Seite:** Braumeister und Admin haben bei den Aktionen unten (neben „Als Rezept
  speichern“) einen Knopf „Drucken“, der denselben Bogen druckt, egal ob der Sud abgeschlossen ist oder nicht.
  Gäste sehen den Knopf nicht. Rezept-Zielwerte und Zwischenmessungen kommen aus den Abfragen, die die
  Sud-Seite ohnehin macht (`detailDruck`). Wer sehr schnell nach dem Öffnen druckt, bevor sie geladen sind,
  bekommt den Bogen ohne diese Werte. `sudProtokollDrucken()` setzt `body.bp-druck` (wirkt nur im Druck).
  Die Klasse fällt erst beim nächsten Tippen/Klicken/Tastendruck oder beim Seitenwechsel weg, nicht mit
  `afterprint`: auf dem iPad kehrt `window.print()` sofort zurück, `afterprint` feuert unzuverlässig und die
  Druckvorschau wird erst danach aus der Seite gebaut. Bis zur nächsten Bedienung druckt Strg+P auf der
  Sud-Seite deshalb ebenfalls den Bogen. `brauProtokollHtml()` bekommt dafür
  einen Kontext `{sud, rezept, messungen, zielMenge}` statt direkt auf `wizard` zuzugreifen.
- **Safari/iPad und Papierformat (Stand 26.11.2026):** Der Bogen hat keine feste Seitenhöhe und kein Flex-Layout
  mehr, nur der Umbruch zwischen Vorder- und Rückseite ist erzwungen. Vorher bekam jede Seite 262 mm Mindesthöhe.
  Wo der bedruckbare Bereich kleiner ist als A4 minus `@page`-Rand (Safari/iPad übernimmt den Rand nicht
  verlässlich, auch Papier „Letter“), lief jede Seite auf ein zweites Blatt über: vier statt zwei Seiten. Jetzt
  messen die Seiten mit den Beispielwerten rund 235 mm (vorne) und 236 mm (hinten), mit leerem Sud 187 und 216 mm,
  und der Fuß folgt dem Inhalt statt am Seitenende zu kleben. Dafür hat die Rückseite 7 Notizzeilen (je 7 mm) und
  die Gärungstabelle 5 Leerzeilen. Notizlinien sind echte Elemente statt Hintergrund-Verlauf (Safari druckt
  Hintergründe nur mit Einstellung), Seitenumbruch-Regeln stehen zusätzlich als `page-break-*`.
  Nachgemessen in Chromium mit entfernter `@page`-Regel: A4 und Letter mit 9, 18 und 25 mm Rand ergeben alle
  2 Seiten (der alte Stand: 4 Seiten ab 18 mm Rand oder bei Letter). In WebKit selbst nicht getestet. Wenn der
  Druck auf dem iPad doch schief aussieht: Papierformat A4 und „Skalieren 100 %“ in der Druckvorschau prüfen.
