# core – gemeinsamer Kern

Wird von jeder Seite geladen, vor dem Code des jeweiligen Bereichs.

| Datei | Inhalt |
|-------|--------|
| `core.js`  | Supabase-Client, Anmeldung, Passwort vergessen/festlegen, Mein Konto, Verwaltung (Einladen, Rollen), Menü, Seitenblatt, Hilfsfunktionen. Stellt alles unter `window.KB` bereit. |
| `base.css` | Farben (hell/dunkel), Schriften, Kopf, Menü, Knöpfe, Formulare, Seitenblatt, Ranglisten, aufklappbare Details, Fußzeile, Textseiten |

## So hängt sich ein Bereich ein

```js
KB.seite = {
  start()  { /* einmalig: Knöpfe verdrahten */ },
  chrome() { /* Kopfzeile je nach Rolle anpassen (optional) */ },
  async laden() { /* Daten laden und anzeigen – läuft nach jeder An-/Abmeldung erneut */ },
};
```

Wichtige Helfer: `KB.sb` (Supabase), `KB.state` (session, profile), `KB.isBM()`, `KB.isAdmin()`, `KB.sheet()`,
`KB.toast()`, `KB.notice()`, `KB.fehlertext()`, `KB.esc()`.

## Gemeinsame Bausteine (seit 07.11.2026)

- `KB.bestaetigen(titel, text, knopf, ok, gefahr = true)` – die eine Rückfrage vor dem Löschen/Entfernen für
  alle Seiten. Eigenes kleines Fenster (`.frage`), funktioniert also auch über einem offenen Seitenblatt.
- `.nur-maus` – blendet Hinweise aus, die nur mit Maus/Trackpad Sinn ergeben (Dateien hierher ziehen), auf
  Touch-Geräten aus.
- `.toast` rückt automatisch über feste untere Knopfleisten (Sud bearbeiten, Assistent, Seitenblatt).
- `details.mehr` – „Mehr …“-Menü für seltene Aktionen (zuerst im Rezept-Detail).
- Fußzeile auf allen Seiten: „Koldingbräu · JFNLNF · Eimsbüttel · Sereetz“. Abschnittsüberschriften überall
  in `--amber`.

## Bilder zuschneiden (seit 07.11.2026, `lib/bilder.js`)

- **Ein Dialog für alle Bildfelder** (`Bilder.waehlen`): ganzes Foto mit Rahmen darüber – innen ziehen =
  verschieben, Ecken ziehen = Größe (Griffe ≥ 44 px). Kronkorken bleibt rund (1:1), Flasche 3:4; alle anderen
  Bilder frei, mit Schnellknöpfen (Frei, Ganzes Bild, 1:1, 4:3, 16:9) und zweitem Schritt für das quadratische
  Vorschaubild. Gross/klein werden aus dem Foto in voller Auflösung geschnitten.
- **„Ausschnitt ändern“** an jedem Bildfeld: Beim Hochladen werden zusätzlich das unbeschnittene Foto (max. 1600 px,
  `…_b.jpg`, „Variante B“ – rund 450 statt 250 KB pro Bild) und der Ausschnitt (Tabelle `bild_ausschnitte`,
  Anteile 0…1) gespeichert. Neu zuschneiden erzeugt immer einen **neuen Dateinamen** (Bilder werden ein Jahr lang
  im Browser zwischengespeichert). Altbilder ohne Basisbild lassen sich nur enger schneiden; ihr altes Großbild
  wird dabei zum Basisbild.
- **Sicheres Löschen** (`Bilder.loeschen`): löscht nur, was keine Zeile in sude/rezepte/biere/verkostungen mehr
  verwendet (Sud und Bier teilen Bilder), räumt den Ausschnitt-Eintrag und ein nicht mehr gebrauchtes Basisbild mit auf.
- Speicher-Stand 07.11.2026: Free-Tarif, 61 MB von 1 GB belegt.

## Regeln

- Bereiche greifen nur auf `core/` und `lib/` zu, nie direkt auf einen anderen Bereich. Verbindungen laufen über Links
  und die Datenbank.
- Rechte immer in der Datenbank absichern; die Oberfläche blendet nur aus.
