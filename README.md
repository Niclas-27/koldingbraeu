# Koldingbräu – Das Braubuch

Unsere Sude seit 2018: Schüttung, Maischplan, Hopfengaben, Hefe, Messwerte und Abfüllung. Gäste sehen die freigegebenen Sude, Braumeister melden sich an und pflegen alles im Browser.

**Online:** <https://kolding.de> (`www.kolding.de` und <https://niclas-27.github.io/koldingbraeu/> leiten dorthin weiter)

## Domain

`kolding.de` liegt bei Host Europe (KIS → Domainservices → Nameserver / DNS-Einträge). Für GitHub Pages gesetzt:

- `kolding.de` A: 185.199.108.153, .109.153, .110.153, .111.153
- `kolding.de` AAAA: 2606:50c0:8000::153, 8001::153, 8002::153, 8003::153
- `www.kolding.de` CNAME: niclas-27.github.io

Die Domain ist in den Repo-Einstellungen unter *Pages → Custom domain* eingetragen. E-Mail (MX, SPF, DKIM, `mail.`, `mailout.`) und die übrigen Subdomains bleiben unverändert bei Host Europe.

## Aufbau

| Datei / Ordner | Inhalt |
|----------------|--------|
| `index.html`, `sude.js` | Seite „Sude“: das Braubuch mit Liste, Details und Editor |
| `verkostung.html`, `verkostung.js` | Seite „Verkostungen“: anlegen, QR-Einladung, Bewertungsbogen für Gäste, Live-Zwischenstand |
| `liga.html`, `liga.js` | Seite „Liga“: öffentliche Rangliste aller verkosteten Biere, filterbar nach Bierstil |
| `rezepte.html` | Platzhalter für das Rezeptbuch |
| `kern.js`      | Gemeinsamer Kern aller Seiten: Anmeldung, Konto, Verwaltung, Menü |
| `qr.js`        | Kleiner eigener QR-Code-Erzeuger (ohne fremde Dienste) |
| `braubuch.css` | Gestaltung aller Seiten |
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

## Verkostungen und Liga

- Ein Braumeister legt eine Verkostung an, fügt Biere hinzu und zeigt den QR-Code. Gäste scannen ihn, geben nur ihren Namen ein und bewerten am Handy (Gesamtnote 0–10 Pflicht, alles andere freiwillig).
- Ablauf: *In Vorbereitung* (Gäste können mitgebrachte Biere vorschlagen) → *Läuft* (bewerten, Live-Zwischenstand) → *Abgeschlossen* (Ergebnis aufgedeckt, zählt für die Liga).
- Gäste haben keinen Tabellenzugriff; sie arbeiten nur über die Datenbankfunktionen `vk_*` mit dem Code der Verkostung und einem persönlichen Schlüssel, der auf ihrem Handy liegt.
- Öffentlich sind abgeschlossene Verkostungen (Liste und Ergebnisseite `verkostung.html?e=…` mit Podest, Rangliste, Einzelnoten, Geschmacksprofil, Kommentaren ohne Namen und den Namen der Teilnehmer) sowie die Liga. Wer welche Note gab, sehen nur Braumeister; sie können einzelne Bewertungen ausblenden.
- Der Admin kann Bewertungen nachträglich ändern oder fehlende nachtragen (Verkostung → Bier antippen → „Bearbeiten“ bzw. „+ Bewertung nachtragen“). Jede Änderung wird intern vermerkt, die ursprüngliche Note bleibt erhalten.
- Datenbank: `supabase/verkostung.sql`, `supabase/verkostung_ergebnis.sql`, `supabase/verkostung_admin.sql`.

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
