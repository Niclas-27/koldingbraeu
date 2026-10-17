# Koldingbräu – Das Braubuch

Unsere Sude seit 2018: Schüttung, Maischplan, Hopfengaben, Hefe, Messwerte und Abfüllung. Gäste sehen die freigegebenen Sude, Braumeister melden sich an und pflegen alles im Browser.

**Online:** <https://niclas-27.github.io/koldingbraeu/> (später <https://kolding.de>)

## Aufbau

| Datei / Ordner | Inhalt |
|----------------|--------|
| `index.html`   | Seitengerüst |
| `app.js`       | Programmlogik: Anmeldung, Liste, Details, Bearbeiten, Verwaltung |
| `braubuch.css` | Gestaltung (auch für Impressum und Datenschutz) |
| `impressum.html`, `datenschutz.html` | Rechtstexte |
| `fonts/`       | Schriften, lokal ausgeliefert (keine Verbindung zu Google) |
| `vendor/`      | Supabase-Bibliothek, lokal ausgeliefert |
| `supabase/`    | Dokumentation des Backends: Datenbankschema, Rechte, Edge Function `einladen` |
| `.nojekyll`    | Sorgt dafür, dass GitHub Pages die Dateien unverändert ausliefert |
| `archiv/`      | Nur lokal, nicht auf GitHub: alte Offline-Fassung und frühere Exporte |

## Daten und Rechte

Die Sude liegen in Supabase (Projekt `koldingbraeu`, Frankfurt). Die Rechte setzt die Datenbank durch:

- **Gäste** sehen freigegebene Sude ohne Notizen und Bewertung.
- **Braumeister** sehen alle Sude, legen an und bearbeiten. Jeder Sud hat einen Schalter „Öffentlich zeigen“.
- **Admin** darf zusätzlich löschen, Braumeister einladen und Rollen vergeben.

Neue Zugänge gibt es nur per Einladung (Verwaltung → Braumeister einladen).

## Arbeitsweise

Der Ordner `Documents/koldingbraeu` auf dem Mac ist die Arbeitskopie dieses Repos. Änderungen werden dort gemacht und zu GitHub hochgeladen – nach etwa einer Minute ist die Seite live.

## Lokal ansehen

Im Ordner einen kleinen Server starten und <http://localhost:8000> öffnen:

```bash
python3 -m http.server
```

Die Seite spricht dabei mit der echten Datenbank.

## Bibliothek und Schriften

`vendor/` und die Schriftdateien in `fonts/` stehen nicht im Repo. Beim Veröffentlichen holt sie GitHub Actions
(`.github/workflows/pages.yml` → `scripts/assets.sh`) in fest eingestellten Versionen. Zum lokalen Testen einmal
`./scripts/assets.sh` ausführen (braucht Node.js und Internet).
