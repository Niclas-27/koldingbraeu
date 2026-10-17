# Koldingbräu – Das Braubuch

Alle Sude von Koldingbräu seit 2018: Schüttung, Maischplan, Hopfengaben, Hefe, Messwerte, Abfüllung und Bewertung – durchsuchbar, filterbar nach Stil und mit Notenverlauf.

**Online:** <https://niclas-27.github.io/koldingbraeu/>

## Aufbau

| Datei / Ordner | Inhalt |
|----------------|--------|
| `index.html`   | Die komplette Seite (HTML, CSS und JavaScript in einer Datei) |
| `sude.json`    | Alle Sude als Datensätze, die Seite liest sie beim Laden ein |
| `.nojekyll`    | Sorgt dafür, dass GitHub Pages die Dateien unverändert ausliefert |
| `archiv/`      | Nur lokal, nicht auf GitHub: alte Offline-Fassung und frühere Exporte |

## Arbeitsweise

Der Ordner `Documents/koldingbraeu` auf dem Mac ist die Arbeitskopie dieses Repos.
Änderungen werden dort gemacht, dann zu GitHub hochgeladen – nach etwa einer Minute ist die Seite live.

## Fassungen des Braubuchs

- **GitHub Pages** (diese Seite): Lesefassung, für alle sichtbar.
- **Claude** (Artifact): Dort werden Sude derzeit angelegt und bearbeitet. Neue Einträge erscheinen online erst, wenn `sude.json` neu exportiert wird.
- **Offline-Fassung** (`archiv/offline-version.html`): läuft ohne Internet per Doppelklick und speichert Änderungen nur im Browser dieses Computers. Mit „Sicherung speichern/laden“ lassen sie sich sichern. Wird nicht mehr weiterentwickelt.

Geplant: Umzug der Daten nach Supabase mit Login, Nutzern und Rollen – dann gibt es nur noch eine Datenquelle.

## Lokal ansehen

Die Seite lädt `sude.json` per `fetch`, darum im Ordner einen kleinen Server starten:

```bash
python3 -m http.server
```

und dann <http://localhost:8000> öffnen.
