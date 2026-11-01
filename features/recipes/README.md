# Bereich: Rezepte

**Wozu:** Wiederverwendbare Rezepte – importiert von maischemalzundmehr.de (MMuM) oder selbst angelegt –,
umrechenbar auf jede Menge und auf die eigene Anlage. Aus einem Rezept wird ein Sud, aus einem Sud ein Rezept.

**Seite:** `rezepte.html` (Liste) und `rezepte.html?id=<uuid>` (Rezeptblatt im MMuM-Stil)

## Wer darf was

| Rolle | Darf |
|-------|------|
| Gast | öffentliche Rezepte lesen, umrechnen, drucken |
| Braumeister | importieren, anlegen, bearbeiten, umbenennen, klonen, exportieren, Schalter „öffentlich“, Sud daraus anlegen |
| Admin | zusätzlich löschen und das Anlagenprofil ändern |

## Funktionen

- **Import** (JSON-Datei hineinziehen oder auswählen) mit Vorschau. Liest MMuM-Export 2.0 (`Malze`, `Rasten`, `Hopfenkochen`,
  `Stopfhopfen`) und das ältere flache Format (`Malz1_Name` …). Malzfarben fehlen im MMuM-Export → typische EBC-Werte werden eingesetzt.
- **Umrechnen:** „für [x] Liter Ausschlagwürze“; optional auf das **Anlagenprofil** (Schüttung × Rezept-Ausbeute / eigene Ausbeute,
  Nachguss passend zur Verdampfung); **Alpha-Ausgleich** je Hopfengabe (Menge × alter/neuer Alpha → gleiche Bittere).
- **Nachrechnen:** Stammwürze aus Schüttung und Ausbeute, IBU nach Tinseth (mit 10 min Nachisomerisierung wie MMuM), Farbe als
  Faustformel Σ(kg × EBC) × 8 / Liter, Alkohol aus Endvergärungsgrad. Rechnung in `lib/brau.js`, Tests in `tests/brau_test.js`.
- **Stammbaum:** Varianten (Klonen merkt sich `eltern_id`), „entstanden aus Sud Nr. …“ (`aus_sud_id`), „x× gebraut“ (Sude mit `rezept_id`).
- **Sud aus Rezept:** Kopie der umgerechneten Werte in den Sud-Editor, mit Verweis aufs Rezept. Späteres Ändern des Rezepts ändert alte Sude nicht.
- **Export** als MMuM-JSON (2.0) und Druckansicht.

## Sudhausausbeute
- **Anlagenprofil** (nur Admin): Standard-Ausbeute der eigenen Anlage. Im Formular steht als Vorschlag der Schnitt der
  letzten 5 Sude mit vollständigen Werten (Schüttung, Ausschlagwürze, Stammwürze) – per Klick übernehmbar.
- **Rezept, „Ausbeute laut Quelle“** (`rezepte.sudhausausbeute`): mit dieser Ausbeute hat der Autor die Schüttung geplant;
  Bezug fürs Umrechnen.
- **Rezept, „Eigene Ausbeute für dieses Rezept“** (`rezepte.eigene_ausbeute`, optional): was die Anlage mit genau diesem
  Rezept schafft (z. B. weniger bei viel Hafer/Weizen). Geht vor dem Anlagenprofil (`Brau.zielAusbeute`). Vorschlag im
  Editor: Ø der Sude aus diesem Rezept, sonst der Sude im selben Stil.
- Umrechnen: Schüttung × Ausbeute laut Quelle / eigene Ausbeute. Jeder Sud zeigt seine tatsächliche Ausbeute
  (`Brau.istAusbeute`), „Rezept aus Sud“ übernimmt sie als Quell- und eigenen Wert.
- Schema: `schema/01_eigene_ausbeute.sql`.

## Dateien

| Datei | Inhalt |
|-------|--------|
| `common.js` | Helfer, Anlagenprofil laden, Kopfwerte |
| `list.js` | Liste, Suche, Import-Zone, Anlagenprofil-Formular |
| `detail.js` | Rezeptblatt, Umrechnen, Stammbaum, Umbenennen, Klonen, Export, Löschen, Übergabe an den Sud |
| `editor.js` | Rezept anlegen/bearbeiten mit Vorschlägen aus allen Rezepten und Suden |
| `import.js` | Datei lesen, Vorschau, anlegen |
| `main.js` | wählt die Ansicht |
| `recipes.css` | Gestaltung inkl. Druck |
| `schema.sql` | Tabellen `rezepte`, `anlagen`, Spalte `sude.rezept_id`, Funktion `rezept_sude` |

## Bilder

Rezepte haben wie Sude optional **Foto** und **Etikett** (Editor → „Bilder“). Das Foto steht über dem Rezeptblatt, das Etikett im Kopf und als Vorschaubild auf der Karte – in Kronkorken-Form zugeschnitten (gezackter Kreis); ohne Bild gibt es einen gezeichneten Kronkorken in der Rezeptfarbe (EBC). Varianten (Klonen) übernehmen keine Bilder. Pfade: `rezepte/<id>/foto-…jpg`, `rezepte/<id>/etikett-…jpg`.

## Offene Punkte

- Anlagenprofil Koldingbräu: Ausbeute am 01.11.2026 auf 55,3 % gesetzt (Ø letzte 5 Sude); Verdampfung (3 l/h) noch prüfen
- BeerXML-Import, Brautag-Modus mit Timern, Einkaufsliste
