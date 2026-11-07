# Bereich: Verkostungen

**Wozu:** Verkostungsabende mit Freunden – etwa sechs Biere nebeneinander probieren, am Handy bewerten,
am Ende das Ranking aufdecken. Die Ergebnisse fließen in die Liga.

**Seite:** `verkostung.html` mit vier Ansichten

| Adresse | Ansicht | Für |
|---------|---------|-----|
| `verkostung.html` | Übersicht: bisherige Verkostungen als Karten | alle; Braumeister sehen zusätzlich laufende/geplante |
| `?v=<code>` | Mitmachen: Name eingeben, Bewertungsbogen, Live-Zwischenstand, Biere vorschlagen | Gäste (Link im QR-Code) |
| `?id=<uuid>` | Verwalten: QR-Code, Biere, Status, Live-Auswertung, Ausblenden, Korrekturen | Braumeister / Admin |
| `?e=<uuid>` | Ergebnisseite: Podest, Rangliste, Einzelnoten, Profil, Kommentare | alle (nur abgeschlossene) |

Ablauf: *In Vorbereitung* → *Läuft* → *Abgeschlossen*.

## Wer darf was

| Rolle | Darf |
|-------|------|
| Gast | per Code beitreten (nur Name), bewerten solange „Läuft“, eigene Bewertung ändern, vor Beginn Biere vorschlagen; Ergebnisse lesen |
| Braumeister | Verkostungen und Biere anlegen/bearbeiten, Status setzen, Vorschläge übernehmen, Bewertungen ausblenden; alle Namen und Kommentare sehen |
| Admin | zusätzlich löschen (auch einzelne Teilnehmer samt ihrer Bewertungen), Bewertungen ändern und nachtragen (mit Vermerk und ursprünglicher Note), Bierstile ergänzen |

Öffentlich (Ergebnisseite): Teilnehmernamen, Noten, Kommentare **ohne** Zuordnung. Wer welche Note gab, sehen nur Braumeister. Die von Teilnehmern hochgeladenen Galerie-Fotos sind nicht öffentlich (siehe „Bilder“ unten).

## Dateien

Die Skripte teilen sich den globalen Gültigkeitsbereich der Seite und werden in dieser Reihenfolge geladen:

| Datei | Inhalt |
|-------|--------|
| `common.js` | Konstanten (Merkmale, Schlagworte), Adress-Parameter, Helfer, Rangliste |
| `form.js` | Bewertungsbogen (`bogenZeigen`) – von Gästen und vom Admin genutzt |
| `guest.js` | Gäste-Ansicht `?v=` |
| `overview.js` | Übersicht ohne Parameter |
| `results.js` | Ergebnisseite `?e=` |
| `admin.js` | Braumeister-Ansicht `?id=`, Bierliste, Bier-Formular, Korrekturen |
| `main.js` | wählt die Ansicht |
| `tastings.css` | Gestaltung nur dieses Bereichs |
| `schema/` | Datenbank in der Reihenfolge der Migrationen (Tabellen und Gast-Funktionen → Ergebnisseiten → Admin-Korrekturen) |

QR-Codes erzeugt `lib/qr.js` im Browser – ohne fremden Dienst.

## Bilder

- **Titelbild** (optional) lädt ein Braumeister in der Verwaltung hoch (Abschnitt „Fotos“). Es erscheint auf der Karte in der Übersicht, beim Mitmachen und auf der Ergebnisseite. Öffentlich sichtbar.
- **Galerie** (seit 27.10.2026 **nur für Braumeister/Admin sichtbar**): Teilnehmer laden während der Verkostung bis zu drei Fotos hoch (Knopf „+ Foto hinzufügen“), bekommen aber keine Fotos – weder eigene noch fremde – zurückgezeigt, nur die Anzahl ihrer bereits hochgeladenen Fotos. Das läuft über die Edge Function `galerie-hochladen`, die Code, persönlichen Schlüssel, Status und das Limit prüft – Teilnehmer haben keinen direkten Speicherzugriff. Die öffentliche Ergebnisseite zeigt die Galerie nicht mehr. Braumeister sehen die Galerie in der Verwaltung über kurzlebige Signed URLs (`Bilder.galerieSignierteUrls`) und können ebenfalls Fotos ergänzen/löschen. Seit 07.11.2026 nutzt die Verwaltung dasselbe Galerie-Modul wie „Fotos vom Brautag“ (`Bilder.galerieModul`): mehrere Fotos auf einmal (Auswahl oder Drag & Drop), je Foto Bildunterschrift und Zuschnitt vor dem Hochladen, nachträglich Bildunterschrift, Aufnahmedatum und „Ausschnitt ändern“ (auch für Gäste-Fotos; unter Gäste-Fotos steht „von <Name>“). Spalten `bildunterschrift`/`aufgenommen` und die Update-Policy: `schema/14_galerie_beschriftung.sql`. Während Ablage oder Bearbeiten offen sind, setzt das Live-Neuladen der Verwaltung aus. Gäste schneiden ihr Foto ebenfalls zu; `galerie-hochladen` nimmt dafür optional `ausschnitt` (JSON) und `basis` (unbeschnittenes Foto, nur wenn wirklich beschnitten) an und legt einen Eintrag in `bild_ausschnitte` an; `galerie-loeschen` räumt Basisbild und Eintrag mit weg.
- **Bierbilder**: je Bier optional *Kronkorken* (rund zugeschnitten) und *Flasche* (hochkant). Seit 07.11.2026 teilt ein eigenes Bier mit seinem verknüpften Sud dieselben Kronkorken-/Flaschen-Dateien (Auswahl des Suds übernimmt fehlende Bilder; Speichern zieht den Sud mit). In Listen, Liga und Podest wird nur die Kronkorken-Form gezeigt: ein vorhandenes Kronkorken-Bild, sonst ersatzweise das Flaschenbild, in Kronkorken-Form zugeschnitten (gezackter Kreis); gibt es keins, zeichnet `lib/bilder.js` einen Platzhalter-Kronkorken in der typischen Farbe des Bierstils. In den aufgeklappten Bierdetails (Ergebnisseite, Liga, Admin-Probendetail) zeigt `Bilder.bierFotos` zusätzlich beide hochgeladenen Fotos größer nebeneinander, wenn vorhanden. Öffentlich sichtbar.
- **Löschen**: Braumeister können jedes Galerie-Foto löschen (✕ in der Galerie). Teilnehmer können, solange die Verkostung nicht abgeschlossen ist, ihr zuletzt hochgeladenes Foto selbst wieder entfernen (Link „Zuletzt hochgeladenes Foto entfernen“) – über die Edge Function `galerie-loeschen` (gleiche Code/Schlüssel-Prüfung wie beim Hochladen, kein Foto-Picker, immer nur das jüngste eigene Foto). Beim Löschen einer Verkostung gehen Titelbild und Galerie mit.
- Speicher: Titelbild/Bierbilder im öffentlich lesbaren Bucket `bilder` (Pfade `verkostungen/<id>/titel-…jpg`, `biere/<id>/kronkorken-…jpg`); Teilnehmer-Galerie im **privaten** Bucket `verkostung-galerie` (Pfade `verkostungen/<id>/galerie/<uuid>-…jpg`), lesbar nur für Braumeister/Admin per RLS-Policy. Zu jedem Bild gibt es `…_t.jpg` als Vorschau. Schema: `schema/04_images.sql` (öffentlicher Bucket), `schema/09_galerie_privater_bucket.sql` (privater Bucket + `vk_laden`/`vk_ergebnis` ohne Galerie-Pfade).

## Datenbank in Kürze

Tabellen `verkostungen`, `proben`, `biere`, `bierstile`, `teilnehmer`, `bewertungen`, `vorschlaege`.
Gäste haben **keinen** Tabellenzugriff, sondern nur die Funktionen `vk_beitreten`, `vk_laden`, `vk_bewerten`,
`vk_vorschlagen` (mit Code + persönlichem Schlüssel). Öffentlich: `vk_archiv`, `vk_ergebnis`, `vk_angekuendigt`, `liga_daten`.
Nur Admin: `vk_admin_bewerten`, `vk_admin_teilnehmer`, `vk_admin_teilnehmer_loeschen`.

`vk_angekuendigt()` zeigt nicht angemeldeten Besuchern auf der Übersichtsseite anstehende Verkostungen
(„In Vorbereitung“ und „Läuft“) als Ankündigung – Titel, Datum, Ort und, wenn nicht blind, die Biere. Keinen
Code und keine Teilnehmernamen; bei blinden Verkostungen bleiben auch die Biernamen verborgen (nur die Anzahl).

## Farbcodierung der Noten (seit 31.10.2026)

Jede angezeigte Note/Schnitt (0–10) – in der Übersicht, der Gäste-Ansicht, der Verwaltung, der Ergebnisseite und
in der Liga – ist farbcodiert: Grün ab 7,0, Gelb 4,0–6,9, Rot darunter. Gemeinsame Funktion `gradeCls()` in
`core/core.js`, Farben in `core/base.css` (`.grade`, `.kw b`, generische `.g1`/`.g2`/`.g3`); dieselben Grenzen
wie bei den Suden.

## Wirkung auf die Sud-Bewertung (seit 31.10.2026)

Ist ein Bier über `biere.sud_id` mit einem Sud verknüpft, übernimmt dessen Sud-Bewertung automatisch den Schnitt
aus den Bewertungen dieses Biers in abgeschlossenen Verkostungen (ersetzt die bisherige Bewertung, sobald
mindestens eine vorliegt; keine Markierung auf der Sud-Seite). Das übernehmen Datenbank-Trigger –
`schema/10_sud_bewertung_aus_verkostung.sql` – bei jeder Änderung an Bewertungen (neu, geändert, ausgeblendet,
gelöscht), beim Abschließen/Wiedereröffnen einer Verkostung und beim (Neu-)Verknüpfen eines Biers mit einem Sud.
Siehe auch `features/brews/README.md`.

Der Beitritts-Code (Spalte `code`) wird beim Anlegen per Trigger `vk_code_setzen` aus einem Titel-Kürzel und
einem kurzen Zufallsteil gebildet (z. B. `craftbier-q7x2pmz4`), damit der Mitmach-Link lesbarer ist, ohne
erratbar zu werden. Ein späteres Umbenennen ändert den Code nicht mehr.

## Zwischenstand, Reihenfolge, Ergebnisseite (seit 07.11.2026)

- **Kein Live-Zwischenstand für Gäste:** Gäste sehen Noten und Rangliste erst nach dem Aufdecken
  (`guest.js` zeigt den Abschnitt nur bei `status = abgeschlossen`). Zusätzlich liefert `vk_laden()` ab
  `schema/12_zwischenstand_nur_braumeister.sql` die Durchschnittsnoten vorher gar nicht mehr aus – diese
  Migration erst nach dem Veröffentlichen des Frontends ausführen (SECURITY DEFINER, ggf. SQL Editor).
  Braumeister/Admin sehen den Zwischenstand weiter auf der Verwaltungsseite.
- **Reihenfolge nur in der Vorbereitung änderbar:** die ↑↓-Knöpfe verschwinden, sobald die Verkostung läuft,
  damit sich die Nummern vor den Gästen nicht ändern. Im Zwischenstand steht die Probennummer als „Nr. 2 · …“
  in der Unterzeile statt vor dem Namen.
- **Ergebnisseite ohne Dopplung:** Platz 1–3 stehen nur auf dem Podest; ein Tipp auf eine Podest-Karte öffnet
  deren Details im Seitenblatt. Die Liste darunter heißt „Weitere Plätze“ und beginnt bei Platz 4.
- Rückfragen vor dem Löschen laufen über das gemeinsame `bestaetigen()` aus `core/core.js`.

## Einladung (seit 07.11.2026)

- **Felder:** `verkostungen.uhrzeit` und `verkostungen.einladungstext` (max. 1000 Zeichen), beide freiwillig, im
  Formular „Bearbeiten“. Beides ist öffentlich lesbar (Ankündigungsseite).
- **Verwaltung:** Box „Gäste einladen“ mit Vorschau der Nachricht und „Einladung teilen“ (`einladungTeilen()` in
  `common.js`: `navigator.share`, sonst Zwischenablage). Die bisherige QR-Box heißt „Mitmachen am Abend“.
- **Link in der Einladung** = Ankündigung, nicht Mitmachen: auf kolding.de `/verkostung/<id>/` (Vorschauseite
  mit WhatsApp-Bild aus `scripts/build-previews.mjs`, Ziel `verkostung.html?a=<id>`), lokal direkt `?a=<id>`
  (`ankuendigungLink()`). Neue Verkostungen haben bis zum nächsten Build (spätestens 4 h) noch keine
  Vorschauseite – `404.html` leitet `/verkostung/<id>/` (auch `/sud/`, `/rezept/`, `/bier/`) dann trotzdem
  zum richtigen Ziel weiter.
- **Ankündigungsseite** (`announce.js`, RPC `vk_ankuendigung(id)`): Titel, Wochentag/Datum/Uhrzeit, Ort, Text,
  Titelbild, Biere (bei blind nur die Anzahl), Code-Feld für den Abend. Abgeschlossen → Weiterleitung aufs
  Ergebnis. Der Einladungstext steht bewusst nur hier, nicht in der Liste „Demnächst“.
- **Mitmachen erst ab „Läuft“:** Gästeseite zeigt das Beitrittsformular nur noch bei laufender Verkostung;
  serverseitig über `vk_beitreten` in `schema/13_einladung.sql` Teil B (erst nach dem Veröffentlichen ausführen).
- Nebenbei behoben: Das Code-Feld der Übersicht entfernte Bindestriche – lesbare Codes wie
  `helles-im-dunkeln-…` funktionierten dort nicht.

## Offene Punkte

- Verkostung 2 und 3: Datum und Ort nachtragen

## Nach dem Aufdecken: automatisch aufs Ergebnis (seit 07.11.2026)
Sobald eine Verkostung abgeschlossen ist, springt die Gästeseite (`?v=<code>`, fragt alle 15 s nach) von selbst auf die
Ergebnisseite (`?e=<id>`) mit Podest und antippbaren Bieren. Vorher legt sie die eigenen Noten je Bier im Browser ab
(`localStorage` `kb_meine_<id>`); die Ergebnisseite zeigt sie als „deine Note“ – nur auf diesem Gerät. Braumeister
landen nach „Abschließen“ ebenfalls direkt dort. Dafür liefert `vk_laden` nach dem Abschluss zusätzlich `id` und je
Probe `bier_id` (`schema/15_ergebnis_wechsel.sql`, angewendet).
