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
| `brews.js` | Kennzahlen, Notenverlauf, Liste nach Jahrgang, Suche/Filter, Details, Editor, CSV-Export |
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

Jeder Sud kann ein **Foto** und ein **Etikett** haben (Editor → „Bilder”, beides freiwillig). Das Foto steht oben in der Ansicht, das Etikett erscheint als Vorschaubild in der Liste – in Kronkorken-Form zugeschnitten (gezackter Kreis); ohne Bild zeichnet `lib/bilder.js` einen Kronkorken in der gewählten Kronkorken-Farbe (Feld „Kronkorken”), sonst in der aus der Schüttung berechneten Bierfarbe. „Als Vorlage nutzen” übernimmt keine Bilder. Ein ersetztes oder entferntes Bild wird beim Speichern aus dem Speicher gelöscht. Pfade: `sude/<id>/foto-…jpg`, `sude/<id>/etikett-…jpg`.

## Fotogalerie „Fotos vom Brautag” (seit 25.10.2026)

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

## Checkliste zum Brautag (seit 27.10.2026)

Eigener Modus auf der Sud-Detailseite (Knopf „Checkliste“, nur Braumeister/Admin – reines Arbeitswerkzeug wie
die Fotogalerie, keine Gäste-Sicht). Gedacht, um während des Brauens Schritt für Schritt abzuhaken, ohne etwas
zu vergessen.

- **Schritte kommen aus den Sud-Daten, nicht aus einem eigenen Formular:** `schritteAbleiten()` in `brews.js`
  baut aus Maischplan (Einmaischen/Rasten/Abmaischen), Hopfengaben (nach Art und Kochzeit sortiert: Vorderwürze
  beim Läutern, Kochgaben absteigend nach Kochzeit, Whirlpool nach Kochende, Stopfhopfen bei der Gärung) und
  Kochzeit automatisch sechs Phasen: Schüttung, Maischen, Läutern, Kochen, Kühlen & Anstellen, Gärung. Nichts
  davon wird doppelt gepflegt – ändert sich der Maischplan, ändert sich beim nächsten Öffnen auch die Checkliste.
- **Fortschritt** liegt in `sud_schritte` (`features/brews/schema/05_sud_schritte.sql`): ein abgeleiteter Schritt
  existiert als Zeile nur, solange er abgehakt ist (Abhaken = anlegen, Abwählen = löschen, mit `erledigt_von`/
  `erledigt_am`); überlebt Neuladen und Gerätewechsel, anders als ein rein lokaler Zustand im Browser.
- **Eigene Zusatzschritte** (z. B. „Milchsäure zugeben“) lassen sich je Phase über „+ Eigener Schritt“ frei
  ergänzen, abhaken und wieder entfernen (mit Lösch-Bestätigung) – für alles, was nicht aus den strukturierten
  Feldern kommt.
- **Bewusst nicht enthalten (Stand jetzt):** Timer/Erinnerungen für Rasten oder Hopfengaben – war explizit
  zurückgestellt, kann bei Bedarf nachträglich ergänzt werden.
- Playwright-Test `sud_checkliste` in `tests/run_tests.py` deckt Ableitung, Abhaken/Abwählen, eigene
  Zusatzschritte und Persistenz über einen Seitenwechsel ab.

## Offene Punkte

- Altdaten aufräumen (Hopfen-Freitexte der 22 alten Sude)
