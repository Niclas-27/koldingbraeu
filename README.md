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

Das Projekt ist in **Bereiche (Feature-Slices)** gegliedert. Jeder Bereich hat einen eigenen Ordner mit Code,
Gestaltung, Datenbank und einer `README.md` (Wozu · Wer darf was · Dateien · Datenbank · Offene Punkte).

```
index.html, verkostung.html, liga.html, rezepte.html   Seiten (Adressen bleiben stabil)
impressum.html, datenschutz.html                       Rechtstexte
core/        gemeinsamer Kern: Anmeldung, Konto, Verwaltung, Menü, Grundgestaltung
features/
  brews/     Sude (Braubuch)
  tastings/  Verkostungen: Mitmachen per QR-Code, Verwalten, Ergebnisseiten
  league/    Liga
  recipes/   Rezepte: MMuM-Import, Umrechnen, Stammbaum
lib/         eigene Hilfsbausteine ohne Bereichsbezug (qr.js, brau.js = Brau-Rechnungen und MMuM-Format,
             bilder.js = Fotos wählen, zuschneiden, verkleinern, hochladen, Großansicht, gezeichnete Platzhalter)
supabase/    bereichsübergreifende Datenbank (Profile, Rollen) und Edge Functions „einladen“, „galerie-hochladen“
tests/       Klicktests mit Test-Attrappe statt echter Datenbank
fonts/, vendor/   Schriften und Supabase-Bibliothek – beim Veröffentlichen geholt
docs/        Konzept und Pläne – nur lokal, nicht im Repo
```

**Regeln:** Ein Bereich nutzt nur `core/` und `lib/`, nie direkt einen anderen Bereich. Rechte werden in der
Datenbank abgesichert. Neuer Bereich = neuer Ordner nach demselben Muster + Menüpunkt in allen Seiten.

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
- Fotos: Titelbild und Galerie je Verkostung (Gäste bis zu drei Fotos), Kronkorken- und Flaschenbild je Bier, Foto und Etikett je Sud und Rezept. Ohne Foto gibt es einen gezeichneten Platzhalter. Löschen dürfen nur Braumeister.
- Einzelheiten: `features/tastings/README.md`.

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

## Tests

```bash
python3 tests/run_tests.py   # Klicktests
node tests/brau_test.js      # Rechentests (Umrechnen, IBU, EBC, MMuM-Import)
```

Klickt alle Bereiche am Computer und in Handygröße durch – gegen eine Attrappe, die echte Datenbank bleibt unberührt.
