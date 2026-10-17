# Koldingbräu – Das Braubuch

Alle Sude von Koldingbräu seit 2018: Schüttung, Maischplan, Hopfengaben, Hefe, Messwerte, Abfüllung und Bewertung – durchsuchbar, filterbar nach Stil und mit Notenverlauf.

## Aufbau

| Datei        | Inhalt                                                        |
|--------------|---------------------------------------------------------------|
| `index.html` | Die komplette Seite (HTML, CSS und JavaScript in einer Datei) |
| `sude.json`  | Schnappschuss aller Sude, den die Seite beim Laden einliest   |
| `.nojekyll`  | Sorgt dafür, dass GitHub Pages die Dateien unverändert ausliefert |

## Zwei Fassungen

- **In Claude** (Artifact) ist das Braubuch das Original: Dort werden Sude angelegt, bearbeitet und gelöscht.
- **Hier auf GitHub Pages** ist es eine Lesefassung. Neue Einträge erscheinen erst, wenn `sude.json` aktualisiert wird.

## Daten aktualisieren

1. In Claude das Braubuch öffnen und um einen neuen Export der Sude als `sude.json` bitten (oder „Als CSV sichern“ nutzen und umwandeln lassen).
2. Die neue `sude.json` hier im Repo ersetzen („Add file → Upload files“).
3. Nach etwa einer Minute ist die Seite aktualisiert.

## Lokal ansehen

Die Seite lädt `sude.json` per `fetch`, darum direkt aus dem Ordner einen kleinen Server starten:

```bash
python3 -m http.server
```

und dann <http://localhost:8000> öffnen.
