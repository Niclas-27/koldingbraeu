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

## Offene Punkte

- Anlagenprofil Koldingbräu: echte Werte eintragen (Start: 65 % Ausbeute, 3 l/h Verdampfung, 20 l)
- BeerXML-Import, Brautag-Modus mit Timern, Einkaufsliste
