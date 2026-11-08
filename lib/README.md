# lib – gemeinsame Hilfsbausteine

Eigene Bausteine ohne Bezug zu einem Bereich. Jede Datei ist ein einfaches Skript (kein Build-Schritt) und legt
ein globales Objekt an. Die Bereiche binden sie per `<script>` ein. `lib/` greift nie auf einen Bereich zu (braucht aber `core/core.js`).

| Datei | Global | Wozu |
|---|---|---|
| `brau.js` | `Brau` | Brau-Rechnungen: Stammwürze aus Schüttung/Ausbeute, IBU (Tinseth), Farbe, Alkohol (Balling, Refraktometer nach Terrill), Karbonisierung, MMuM-Import/-Export. Tests: `tests/brau_test.js` |
| `bilder.js` | `Bilder` | Alles rund um Fotos (siehe unten). Tests: `tests/exif_test.js` und die Bildabläufe in `tests/run_tests.py` |
| `qr.js` | `QR` | QR-Codes im Browser, ohne fremden Dienst |
| `bierform.js` | `BierForm` | Biere laden (inkl. wie oft/wann zuletzt verkostet), Suche + Filter-Chips, Formular zum Anlegen/Bearbeiten. Genutzt vom Bierkeller und von „Bier hinzufügen“ in der Verkostung |

## bilder.js

### Speicher
- Bucket `bilder` (öffentlich lesbar): Sude, Rezepte, Biere, Titelbilder, „Fotos vom Brautag“.
- Bucket `verkostung-galerie` (privat): Galerie der Verkostungen. Anzeige nur über kurzlebige signierte Links
  (`galerieSignierteUrls`). Gäste laden über die Edge Function `galerie-hochladen` hoch.
- Zu jedem Bild `name.jpg` gibt es `name_t.jpg` (Vorschau). Wurde ein Bild zugeschnitten, liegt das unbeschnittene
  Foto als `name_b.jpg` daneben (max. 1600 px), damit man den Ausschnitt später ändern kann.
- Neue Datei = neuer Name (Zeitstempel im Pfad). So greift der lange Browser-Cache (`cacheControl` 1 Jahr) nie
  auf ein altes Bild.

### Zuschnitt (seit 07.11.2026)
- `waehlen({form, titel, vorlage, datei})` öffnet den Bild-Dialog: Datei wählen (oder `datei` übergeben), Rahmen
  über dem ganzen Bild verschieben/aufziehen, Ecken greifen.
  - `form: "rund"` (Kronkorken, 600×600), `"hoch"` (Flasche, 600×800, 3:4), `"frei"` (Fotos: Schnellknöpfe
    Frei / Ganzes Bild / 1:1 / 4:3 / 16:9, dann ein zweiter Schritt für die quadratische Vorschau).
  - Rückgabe `{gross, klein, basis, basisPfad, ausschnitt:{rahmen, quadrat}}`, Koordinaten als Anteile 0…1.
- `hochladen(basis, blobs, {bucket})` lädt Groß- und Vorschaubild hoch, bei Zuschnitt dazu das Basisbild, und legt
  einen Eintrag in der Tabelle `bild_ausschnitte` an (pfad → basis_pfad, rahmen, quadrat).
  Wurde das **ganze** Foto übernommen (nur bei „frei“), gibt es kein zusätzliches Basisbild: Das Großbild ist dann
  selbst die Grundlage. Das spart Speicher.
- `ausschnittAendern(pfad, {art, titel, basis, bucket})` öffnet den Dialog mit dem gespeicherten Ausschnitt auf dem
  Basisbild und legt ein neues Bild an. Ältere Bilder ohne Eintrag lassen sich nur enger schneiden.
- `ohneZuschnitt(datei)` liefert dasselbe Ergebnis wie „Übernehmen“ ohne Anfassen (für Mehrfach-Uploads).
- Tabelle und Rechte: `features/brews/schema/11_kronkorken_flasche_ausschnitte.sql`.

### Löschen
`loeschen(pfad, {bucket})` prüft vorher mit `nochVerwendet`, ob das Bild noch irgendwo hängt (Sud, Rezept, Bier,
Verkostung, Galerien). Sud und verknüpftes Bier teilen sich Kronkorken und Flasche (dieselbe Datei). Ist das Bild
Grundlage eines anderen Ausschnitts, bleibt das Großbild liegen und nur die Vorschau geht. Ein Basisbild wird
erst gelöscht, wenn kein Ausschnitt es mehr braucht.

### Bausteine für die Oberfläche
- `feldHtml` / `feldVerdrahten`: ein Bildfeld im Formular mit Knöpfen Neu / Ausschnitt ändern / Entfernen.
- `galerieModul(cfg)`: komplette Galerie mit Raster, Ablage für mehrere Fotos (je Foto Bildunterschrift und
  „Zuschneiden“), Drag & Drop, Bearbeiten (Bildunterschrift, Aufnahmedatum, „Ausschnitt ändern“) und Löschen mit
  Rückfrage. Der Aufrufer liefert nur die Tabellenzugriffe (`einfuegen`, `aendern`, `entfernen`). Genutzt von
  „Fotos vom Brautag“ (`features/brews/brews.js`) und der Verkostungs-Galerie (`features/tastings/admin.js`).
  `beschaeftigt()` sagt, ob gerade etwas offen ist (dann kein automatisches Neuladen).
- `zeigen`: Großansicht mit Wischgeste, von allen Galerien genutzt.
- `platzhalter`, `titelPlatzhalter`, `bier`: gezeichnete Kronkorken und Titel, wenn kein Foto da ist.
- `exifDatum` (eigener kleiner EXIF-Parser), `alsJpegDatei` (HEIC → JPEG; lädt dafür einmalig `heic2any` von
  einem CDN – die einzige externe Laufzeit-Abhängigkeit).

### Speicherplatz (Free-Plan)
1 GB Speicher, 5 GB Abruf pro Monat. Stand 07.11.2026 belegt: etwa 61 MB. Ein Foto kostet grob 0,3–0,6 MB, mit
Basisbild etwa das Doppelte. Den Verbrauch zeigt Supabase unter *Settings → Usage*.
