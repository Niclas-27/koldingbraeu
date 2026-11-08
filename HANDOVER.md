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

Der Workflow läuft außerdem **automatisch jede Stunde** (`schedule: cron: "17 * * * *"`) und per Hand (GitHub → Actions → „Veröffentlichen“ → „Run workflow“),
auch ohne dass Code geändert wurde – dazu gleich mehr (2.2).

### 2.2 Vorschaubilder für geteilte Links

`scripts/build-previews.mjs` wird bei jedem Deploy ausgeführt (`pages.yml`) und erzeugt
zusätzliche, winzige statische Seiten unter `/sud/<id>/`, `/rezept/<id>/`, `/verkostung/<id>/`
und `/bier/<id>/`. Grund: WhatsApp & Co. lesen beim Linkversand nur das rohe HTML einer Adresse,
ohne JavaScript auszuführen – die normale `index.html` füllt sich aber erst per Skript mit den
Supabase-Daten und kann daher kein Vorschaubild zu einem bestimmten Sud/Bier zeigen. Diese
generierten Seiten tragen die passenden `<meta property="og:...">`-Tags und leiten Menschen von
dort sofort zur eigentlichen Seite weiter.

- Nur **öffentliche** Sude/Rezepte bekommen eine solche Seite (abgefragt genau wie ein nicht
  angemeldeter Gast – was RLS freigibt). Verkostungen, wenn abgeschlossen (→ Ergebnis) oder geplant
  (→ Ankündigung zum Einladen, `verkostung.html?a=…`). Biere aus der
  Liga immer, sofern ein Kronkorken-Bild hinterlegt ist.
- Läuft rein lesend mit dem öffentlichen Supabase-Schlüssel (demselben, der auch im Browser
  steht) und bricht den Gesamt-Build bei einem Fehler nicht ab.
- **Deshalb der Zeitplan (stündlich):** Ein neuer Sud bekommt ohne diesen automatischen Lauf
  erst dann eine Vorschauseite, wenn wieder jemand etwas veröffentlicht (`main`→`production`) –
  das kann tagelang nicht passieren. Der Zeitplan-Lauf checkt deshalb bewusst **fest `production`**
  aus (nicht den Default-Branch `main`), siehe Kommentar im Workflow.
- `404.html` leitet Adressen wie `/sud/<id>/`, für die noch keine Vorschauseite gebaut wurde,
  trotzdem auf die richtige Seite weiter.
- Das Skript selbst ist gut kommentiert (Kopf von `scripts/build-previews.mjs` lesen). Kurzfassung
  auch in `README.md` → „Vorschaubilder für geteilte Links“.

### 2.3 `lib/` – gemeinsame Hilfsbausteine

Seit 07.11.2026 mit eigener `lib/README.md`: Brau-Rechnungen (`brau.js`), QR-Codes (`qr.js`) und vor allem
`bilder.js` – Zuschnitt mit gespeichertem Ausschnitt („Ausschnitt ändern“), sicheres Löschen geteilter Bilder,
das gemeinsame Galerie-Modul und die Speicher-Regeln. Wer an Fotos arbeitet, liest zuerst diese Datei.

### 2.4 Altlast `sude.json`

Die Datei im Repo-Root enthält die 22 Sude von 2018 bis 2025 als Rohdaten, aus denen die Datenbank einmalig
befüllt wurde. Die Seite liest sie nicht (steht so auch in `README.md` → Aufbau). Sie kann als Sicherung
bleiben oder gelöscht werden – Entscheidung des Betreibers.

### 2.5 Datenbank- und Funktionsänderungen: Reihenfolge

Die Oberfläche (GitHub Pages) und die Datenbank (Supabase) werden getrennt veröffentlicht. Regel:
- **Hinzufügen** (neue Spalte, Tabelle, Funktion, Policy) darf vorher laufen – die alte Seite merkt nichts.
- **Verhalten ändern oder Daten umschreiben** erst **nach** dem Release der Oberfläche, die damit umgehen kann.
- Jede SQL-Datei im `schema/`-Ordner eines Bereichs sagt im Kopf, welcher Teil wann läuft und ob er schon lief.
- Edge Functions (`supabase/functions/`) werden in Supabase bereitgestellt; eine Änderung im Repo allein ändert
  die laufende Function nicht. Sie sollten abwärtskompatibel bleiben (neue Felder optional).
- Supabase vergibt für neue Tabellen automatisch Rechte an `anon` – bei internen Tabellen bewusst entziehen.

### 2.6 Bekannte Eigenheit der Cloud-Sandbox: Tests

`tests/run_tests.py` brach in der Cloud-Sandbox-Umgebung (nicht auf dem Mac!) früher öfter mit einem
Playwright-`TimeoutError` mittendrin ab, auch auf unverändertem `main` (im November 2026 lief er dort durchweg grün) – wirkt wie
Umgebungs-/Performance-Flakiness des headless Chromium in der Sandbox, nicht wie ein echter
Fehler im Code. Einzelne Bereiche lassen sich bei Bedarf in einem eigenen kleinen Skript isoliert
grün bekommen (Beispiele: `tests/_wizard_check.py`). Ein Fehlschlag beim Gesamtlauf in dieser
Umgebung ist also kein zuverlässiges Signal für einen echten Bug – auf dem Mac bzw. einer
normalen Entwicklungsumgebung lief es bisher zuverlässiger.

### 2.7 Wo was liegt – Kurzreferenz

| Was | Wo |
|---|---|
| Code-Repo | GitHub `Niclas-27/koldingbraeu`, Arbeitsstand `main`, live `production` |
| Speicher | Supabase Free-Plan: 1 GB Dateien, 500 MB Datenbank; belegt am 07.11.2026 ca. 61 MB Dateien |
| Arbeitskopie Mac | `~/Documents/koldingbraeu` |
| Datenbank | Supabase-Projekt `ysmnvtuxckiflvvfxxiy`, Region Frankfurt |
| Domain/DNS | Host Europe (siehe `README.md` Abschnitt „Domain") |
| Rechte | Row Level Security + Funktionen `private.ist_braumeister()`/`private.ist_admin()` in Supabase, nicht nur in der Oberfläche |
| Design-Referenz | Figma-Datei `ao2PizpzsRdRzcl9IEcMVM` (Team „alsterspree"), bisher nur Grundlagen/Bausteine übertragen, noch kein fertiger Screen-Katalog |

### 2.8 Neu seit der ersten Fassung (November 2026)

- **Bedienung:** Bestätigungsdialog vor jedem Löschen (`KB.bestaetigen` in `core/core.js`), feste
  Speichern-Leiste im Sud-Editor, „Kopie anlegen“, Zwischenmessungen und eigene Angaben im Editor,
  Checkliste entfernt, einheitliche Fußzeile, Ergebnis-Podest mit Detailansicht.
- **Einladung zur Verkostung:** Uhrzeit, Einladungstext, Ankündigungsseite und Teilen-Knopf
  (`features/tastings/announce.js`, `schema/13_einladung.sql`).
- **Bilder:** einheitlicher Zuschnitt überall, „Ausschnitt ändern“, Kronkorken und Flasche statt Etikett
  (`features/brews/schema/11_…`).
- **Bierkeller:** eigene Seite für alle Biere mit Suche und Filtern (`features/cellar/`, `lib/bierform.js`).
- **Galerien:** ein gemeinsames Galerie-Modul für Brautag und Verkostung, mit Mehrfach-Upload,
  Bildunterschrift, Datum und Zuschnitt (`features/tastings/schema/14_galerie_beschriftung.sql`).

### 2.9 Offene Punkte (Stand dieser Übergabe)

Die laufend aktuelle Liste offener Punkte je Bereich steht in den jeweiligen
`features/<bereich>/README.md` unter „Offene Punkte". Zusätzlich, bereichsübergreifend:

- GitHub Pages: „Enforce HTTPS" einschalten.
- Supabase Site URL / Redirect URLs auf `https://kolding.de/` setzen.
- `sude.json` behalten oder löschen (siehe 2.4).
- Sud 23 hat zwei verknüpfte Biere „Hazy IPA“ – vermutlich doppelt angelegt, eins prüfen/löschen.

---

*Diese Datei beschreibt den Stand zum Zeitpunkt ihrer Erstellung. Sie ersetzt nicht die
einzelnen `README.md`-Dateien, sondern ergänzt sie um das, was zwischen den Bereichen bzw. nur
im Betrieb wichtig ist. Bei größeren strukturellen Änderungen bitte hier mitpflegen.*
