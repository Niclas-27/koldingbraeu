# Übergabe-Dokumentation

Diese Datei ergänzt die `README.md` in diesem Ordner und die `README.md` in jedem
`features/`-Unterordner. Sie ist dafür gedacht, dass eine andere Person – oder eine andere
KI/Sitzung, die das Projekt noch nicht kennt – es vollständig übernehmen kann, ohne mit dem
bisherigen Entwickler sprechen zu müssen.

**Aufbau dieser Datei:** Zuerst ein kurzer, allgemein verständlicher Überblick für jemanden ohne
Code-Kenntnis. Danach ein technischer Anhang mit allem, was beim Weiterarbeiten am Code wichtig
ist – vor allem die Dinge, die *nirgends sonst* stehen und die beim bisherigen Entwickler schon
einmal zu Verwirrung geführt haben.

Wo die einzelnen Funktionen im Detail funktionieren, steht weiterhin in der jeweiligen
`features/<bereich>/README.md` – das wird hier nicht wiederholt.

---

## Teil 1: Was ist das Braubuch? (für alle)

Koldingbräu ist eine private Website für eine Hobby-Hausbrauerei, erreichbar unter
<https://kolding.de>. Sie dokumentiert alle gebrauten Biere seit 2018 und bietet drei
zusammenhängende Werkzeuge:

- **Sude (Braubuch):** Für jeden gebrauten Sud wird festgehalten, was hineinkam (Schüttung,
  Hopfen, Hefe), wie gebraut wurde (Maischplan, Kochzeit) und was herauskam (Stammwürze,
  Alkohol, Fotos). Ein eigener „Braugang-Assistent" begleitet das Brauen live, Schritt für
  Schritt, direkt am Handy.
- **Rezepte:** Wiederverwendbare Baupläne für einen Sud – entweder selbst geschrieben oder von
  der Rezeptdatenbank „maischemalzundmehr.de" importiert. Ein Rezept lässt sich auf jede
  gewünschte Menge und auf die eigene Braupfanne umrechnen.
- **Verkostungen & Liga:** Bei einem Verkostungsabend bewerten Gäste per QR-Code-Link am eigenen
  Handy mehrere Biere blind oder offen. Die Ergebnisse fließen in eine öffentliche Rangliste
  („Liga") aller je verkosteten Biere.

**Wer darf was:** Gäste (ohne Anmeldung) sehen die freigegebenen Inhalte. Angemeldete
„Braumeister" legen Sude/Rezepte/Verkostungen an und pflegen sie. Ein „Admin" darf zusätzlich
löschen, neue Braumeister einladen und nachträglich Bewertungen korrigieren. Es gibt keine
öffentliche Registrierung – neue Zugänge entstehen nur durch Einladung.

**Technisch in einem Satz:** Eine reine Browser-Website (kein Server-Code außer ein paar kleinen
Edge Functions) auf GitHub Pages, die direkt mit einer Datenbank bei Supabase spricht; die
Datenbank selbst setzt durch, wer was darf.

---

## Teil 2: Technischer Anhang

### 2.1 Das Wichtigste zuerst: Wie ein Deploy wirklich funktioniert

**Das steht sonst nirgends im Repo und hat den bisherigen Entwickler schon einmal getäuscht
(29.10.2026): zwei PRs nach `main` gemergt, in der Annahme die Änderung sei live – war sie nicht.**

- `main` ist nur der **Arbeitsstand**. Ein normaler Feature-PR geht nach `main` und verändert
  die Live-Seite **nicht**.
- GitHub Pages deployt ausschließlich bei Push auf den separaten Branch **`production`**
  (`.github/workflows/pages.yml`, `on: push: branches: [production]`). Damit etwas live geht,
  braucht es **zusätzlich einen eigenen zweiten PR `main` → `production`**, der gemergt wird.
- Faustregel: nach jedem Feature-PR nach `main` bewusst entscheiden/fragen, ob *jetzt* auch
  veröffentlicht werden soll – und wenn ja, den zweiten PR nicht vergessen.
- Um zu prüfen, ob etwas wirklich live ist: `gh api repos/Niclas-27/koldingbraeu/actions/runs?per_page=3`
  – nur ein erfolgreicher Lauf mit `head_branch: production` **nach** dem Merge-Zeitpunkt zählt.
  Ungefähr eine Minute nach dem Merge nach `production` ist die Änderung auf kolding.de sichtbar.

Der Workflow läuft außerdem **automatisch alle vier Stunden** (`schedule: cron: "17 */4 * * *"`),
auch ohne dass Code geändert wurde – dazu gleich mehr (2.2).

### 2.2 Unentdecktes Feature: Vorschaubilder für geteilte Links

`scripts/build-previews.mjs` wird bei jedem Deploy ausgeführt (`pages.yml`) und erzeugt
zusätzliche, winzige statische Seiten unter `/sud/<id>/`, `/rezept/<id>/`, `/verkostung/<id>/`
und `/bier/<id>/`. Grund: WhatsApp & Co. lesen beim Linkversand nur das rohe HTML einer Adresse,
ohne JavaScript auszuführen – die normale `index.html` füllt sich aber erst per Skript mit den
Supabase-Daten und kann daher kein Vorschaubild zu einem bestimmten Sud/Bier zeigen. Diese
generierten Seiten tragen die passenden `<meta property="og:...">`-Tags und leiten Menschen von
dort sofort zur eigentlichen Seite weiter.

- Nur **öffentliche** Sude/Rezepte bekommen eine solche Seite (abgefragt genau wie ein nicht
  angemeldeter Gast – was RLS freigibt). Verkostungen nur, wenn abgeschlossen. Biere aus der
  Liga immer, sofern ein Kronkorken-Bild hinterlegt ist.
- Läuft rein lesend mit dem öffentlichen Supabase-Schlüssel (demselben, der auch im Browser
  steht) und bricht den Gesamt-Build bei einem Fehler nicht ab.
- **Deshalb der Zeitplan alle 4 Stunden:** Ein neuer Sud bekommt ohne diesen automatischen Lauf
  erst dann eine Vorschauseite, wenn wieder jemand etwas veröffentlicht (`main`→`production`) –
  das kann tagelang nicht passieren. Der Zeitplan-Lauf checkt deshalb bewusst **fest `production`**
  aus (nicht den Default-Branch `main`), siehe Kommentar im Workflow.
- Das Skript selbst ist gut kommentiert (Kopf von `scripts/build-previews.mjs` lesen) – hier nur
  der Hinweis, dass es dieses Feature überhaupt gibt, da es in keiner `README.md` vorkommt.

### 2.3 `lib/` – gemeinsame Hilfsbausteine ohne eigene README

Anders als jeder `features/`-Bereich hat `lib/` keine eigene `README.md`. Die Dateien sind
inzwischen zu umfangreich, um sie nur in einem Satz in der Haupt-README abzuhandeln:

- **`brau.js`** – alle Brau-Berechnungen: Stammwürze aus Schüttung/Ausbeute, IBU nach Tinseth,
  Bierfarbe als Faustformel, Alkohol nach Balling-Näherung (aus Plato oder aus zwei echten
  Messwerten), Alkohol aus Refraktometer-Werten nach der „Sean-Terrill"-Näherung,
  Karbonisierung/Zuckermenge zum Abfüllen, MMuM-Import/Export-Format. Tests dazu in
  `tests/brau_test.js`.
- **`bilder.js`** – alles rund um Fotos: Auswahl/Zuschnitt/Verkleinern vor dem Hochladen,
  EXIF-Aufnahmedatum auslesen (eigener kleiner Parser ohne Bibliothek), HEIC/HEIF→JPEG-Wandlung
  (lädt dafür einmalig `heic2any` von einem CDN nach – die einzige externe Laufzeit-Abhängigkeit
  im sonst komplett lokal eingebundenen Code), gezeichnete Platzhalter-Kronkorken, die geteilte
  Großansicht-Galerie (`zeigen()`) mit Wischgeste, die alle Bereiche gemeinsam nutzen.
- **`qr.js`** – QR-Code-Erzeugung im Browser, ohne fremden Dienst.

Wenn an einer dieser Dateien grundlegend etwas geändert wird, lohnt sich eine eigene
`lib/README.md` nach demselben Muster wie bei den Bereichen.

### 2.4 Unklare Altlast: `sude.json`

Im Repo-Root liegt eine 24-KB-Datei `sude.json` mit Rohdaten zu allen Suden, die von keinem
Code referenziert wird (geprüft per Volltextsuche). Sieht nach einem Einmal-Export aus der Zeit
vor der Supabase-Migration aus. Nicht angefasst, da unklar ist, ob sie noch als Referenz/Backup
gebraucht wird – das sollte der jetzige Betreiber einmal klären und die Datei dann entweder
löschen oder hier kurz begründen, wozu sie dient.

### 2.5 Kleinere Lücken in bestehenden READMEs

- `supabase/README.md` nennt die Edge Function **`galerie-loeschen`** nicht (nur `einladen` und
  `galerie-hochladen`), obwohl sie existiert und in `features/tastings/README.md` korrekt
  beschrieben ist. Beim nächsten Anfassen dieser Datei ergänzen.
- `tests/README.md` erwähnt `tests/exif_test.js` und `tests/_wizard_check.py` nicht.

### 2.6 Bekannte Eigenheit dieser Cloud-Sandbox: flackernde Tests

`tests/run_tests.py` bricht in der Cloud-Sandbox-Umgebung (nicht auf dem Mac!) öfter mit einem
Playwright-`TimeoutError` mittendrin ab, auch auf unverändertem `main` – wirkt wie
Umgebungs-/Performance-Flakiness des headless Chromium in der Sandbox, nicht wie ein echter
Fehler im Code. Einzelne Bereiche lassen sich bei Bedarf in einem eigenen kleinen Skript isoliert
grün bekommen (Beispiele: `tests/_wizard_check.py`). Ein Fehlschlag beim Gesamtlauf in dieser
Umgebung ist also kein zuverlässiges Signal für einen echten Bug – auf dem Mac bzw. einer
normalen Entwicklungsumgebung lief es bisher zuverlässiger.

### 2.7 Wo was liegt – Kurzreferenz

| Was | Wo |
|---|---|
| Code-Repo | GitHub `Niclas-27/koldingbraeu`, Arbeitsstand `main`, live `production` |
| Arbeitskopie Mac | `~/Documents/koldingbraeu` |
| Datenbank | Supabase-Projekt `ysmnvtuxckiflvvfxxiy`, Region Frankfurt |
| Domain/DNS | Host Europe (siehe `README.md` Abschnitt „Domain") |
| Rechte | Row Level Security + Funktionen `private.ist_braumeister()`/`private.ist_admin()` in Supabase, nicht nur in der Oberfläche |
| Design-Referenz | Figma-Datei `ao2PizpzsRdRzcl9IEcMVM` (Team „alsterspree"), bisher nur Grundlagen/Bausteine übertragen, noch kein fertiger Screen-Katalog |

### 2.8 Offene Punkte (Stand dieser Übergabe)

Die laufend aktuelle Liste offener Punkte je Bereich steht in den jeweiligen
`features/<bereich>/README.md` unter „Offene Punkte". Zusätzlich, bereichsübergreifend:

- GitHub Pages: „Enforce HTTPS" einschalten.
- Supabase Site URL / Redirect URLs auf `https://kolding.de/` setzen.
- `sude.json` klären (siehe 2.4).
- `lib/README.md` ergänzen, wenn sich dort wieder größere Änderungen anbahnen.

---

*Diese Datei beschreibt den Stand zum Zeitpunkt ihrer Erstellung. Sie ersetzt nicht die
einzelnen `README.md`-Dateien, sondern ergänzt sie um das, was zwischen den Bereichen bzw. nur
im Betrieb wichtig ist. Bei größeren strukturellen Änderungen bitte hier mitpflegen.*
