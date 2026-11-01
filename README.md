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
supabase/    bereichsübergreifende Datenbank (Profile, Rollen) und Edge Functions „einladen“, „galerie-hochladen“,
             „galerie-loeschen“
scripts/     assets.sh = Bibliothek und Schriften holen, build-previews.mjs = Vorschauseiten für geteilte Links
tests/       Klicktests mit Test-Attrappe statt echter Datenbank
fonts/, vendor/   Schriften und Supabase-Bibliothek – beim Veröffentlichen geholt
sude.json    Altbestand: die 22 Sude von 2018 bis 2025 als Rohdaten, aus denen die Datenbank einmalig befüllt
             wurde – die Seite liest die Datei nicht
docs/        Konzept und Pläne – nur lokal, nicht im Repo (also auch nirgends gesichert)
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
- Fotos: Titelbild und Galerie je Verkostung (Gäste bis zu drei Fotos), Kronkorken- und Flaschenbild je Bier, Foto und Etikett je Sud und Rezept. Ohne Foto gibt es einen gezeichneten Platzhalter. Die Galerie einer Verkostung sehen nur Braumeister (privater Speicher). Löschen dürfen Braumeister; Gäste können nur ihr zuletzt hochgeladenes Foto wieder entfernen, solange die Verkostung läuft.
- Einzelheiten: `features/tastings/README.md`.

## Arbeitsweise

Der Ordner `Documents/koldingbraeu` auf dem Mac ist die Arbeitskopie dieses Repos.

- **`main`** ist der Arbeits-Branch. Neue Funktionen entstehen auf einem eigenen Branch (`feature/…`, `fix/…`)
  und kommen per Pull Request nach `main`. Auf `main` ist noch nichts live.
- **`production`** ist das, was tatsächlich auf kolding.de steht. Soll etwas veröffentlicht werden, geht `main`
  per Pull Request nach `production` – etwa eine Minute nach dem Mergen ist die Seite live.
- Der Veröffentlichen-Workflow (`.github/workflows/pages.yml`) läuft außerdem alle vier Stunden von selbst, damit
  neue öffentliche Sude, Rezepte, Verkostungen und Biere ihre Vorschauseite bekommen (siehe unten).

Vor dem Arbeiten den lokalen Stand holen: `git pull` auf `main`.

## Vorschaubilder für geteilte Links

WhatsApp & Co. lesen beim Teilen nur rohes HTML und führen kein JavaScript aus. Deshalb erzeugt
`scripts/build-previews.mjs` beim Veröffentlichen kleine statische Seiten unter `/sud/<id>/`, `/rezept/<id>/`,
`/verkostung/<id>/` und `/bier/<id>/` mit passendem Titel und Bild, die sofort zur eigentlichen Seite weiterleiten.
Angefragt wird wie von einem Gast: nur öffentliche Sude und Rezepte, abgeschlossene Verkostungen und Biere mit
Kronkorken-Bild bekommen eine Seite. Alles andere zeigt beim Teilen das allgemeine Logo (`assets/og-default.png`).

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
