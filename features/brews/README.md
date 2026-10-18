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

## Verbindung zu Rezepten

- „+ Neuer Sud“ fragt: **leer beginnen** oder **aus Rezept** (mit Zielmenge und Anlagenprofil). Der Sud ist eine Kopie mit Verweis.
- Malz hat jetzt Sorte, Gramm, EBC; Hopfen hat Sorte, Gramm, Alpha, Minuten und Art (Vorderwürze, Kochen, Whirlpool, Stopfen).
  Alte Einträge („22 g Magnum · 60 min“) werden beim Bearbeiten in Felder zerlegt, der alte Text bleibt als Hinweis sichtbar.
- **Als Rezept speichern** im Sud macht daraus ein Rezept (Rückweg, mit errechneter Sudhausausbeute).
- Direktlink auf einen Sud: `index.html?sud=<uuid>`

## Bilder

Jeder Sud kann ein **Foto** und ein **Etikett** haben (Editor → „Bilder“, beides freiwillig). Das Foto steht oben in der Ansicht, das Etikett erscheint als Vorschaubild in der Liste; ohne Bild zeichnet `lib/bilder.js` eine Flasche in der aus der Schüttung berechneten Bierfarbe. „Als Vorlage nutzen“ übernimmt keine Bilder. Ein ersetztes oder entferntes Bild wird beim Speichern aus dem Speicher gelöscht. Pfade: `sude/<id>/foto-…jpg`, `sude/<id>/etikett-…jpg`.

## Offene Punkte

- Altdaten aufräumen (Hopfen-Freitexte der 22 alten Sude)
- Brautagebuch je Sud; Fotos und Etiketten
