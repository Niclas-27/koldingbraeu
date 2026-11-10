# Bereich: Verkostungen

**Wozu:** Verkostungsabende mit Freunden – etwa sechs Biere nebeneinander probieren, am Handy bewerten,
am Ende das Ranking aufdecken. Die Ergebnisse fließen in die Liga.

**Seite:** `verkostung.html` mit vier Ansichten

| Adresse | Ansicht | Für |
|---------|---------|-----|
| `verkostung.html` | Übersicht: bisherige Verkostungen als Karten | alle; Braumeister sehen zusätzlich laufende/geplante |
| `?v=<code>` | Mitmachen: Name eingeben, Bewertungsbogen, Live-Zwischenstand, Biere vorschlagen | Gäste (Link im QR-Code) |
| `?id=<uuid>` | Verwalten: QR-Code, Biere, Status, Live-Auswertung, Ausblenden, Korrekturen | Braumeister / Admin |
| `?e=<uuid>` | Ergebnisseite: Rangliste (blind: mit Probennummer), Einzelnoten, Profil, Kommentare; für Teilnehmer die Fotos vom Abend | alle (nur abgeschlossene) |

Ablauf: *In Vorbereitung* → *Läuft* → *Abgeschlossen*.

## Wer darf was

| Rolle | Darf |
|-------|------|
| Gast | per Code beitreten (nur Name), bewerten solange „Läuft“, eigene Bewertung ändern, vor Beginn Biere vorschlagen; Ergebnisse lesen |
| Braumeister | Verkostungen und Biere anlegen/bearbeiten, Status setzen, Vorschläge übernehmen, Bewertungen ausblenden; alle Namen und Kommentare sehen |
| Admin | zusätzlich löschen (auch einzelne Teilnehmer samt ihrer Bewertungen), Bewertungen ändern und nachtragen (mit Vermerk und ursprünglicher Note), Bierstile ergänzen |

Öffentlich (Ergebnisseite): Teilnehmernamen, Noten, Kommentare **ohne** Zuordnung. Wer welche Note gab, sehen nur Braumeister. Die Galerie-Fotos sind nicht öffentlich – sehen dürfen sie nur Braumeister und die Teilnehmer dieser Verkostung (siehe „Bilder“ unten).

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
- **Fotos vom Abend für Teilnehmer** (seit 10.11.2026): Wer eingecheckt ist (Code + Name, persönlicher Schlüssel im Browser), sieht die ganze Galerie – während des Abends in der Gästeansicht, nach dem Abschluss unbegrenzt auf der Ergebnisseite; als Raster mit „von <Name>“ und Vollbild zum Durchwischen (`Bilder.zeigenRoh`). Neue Fotos sind sofort sichtbar; unpassende löscht ein Braumeister. Die Edge Function `galerie-ansehen` prüft den Schlüssel und liefert signierte Links (1 Stunde); Besucher ohne Teilnahme sehen auf der Ergebnisseite keinen Hinweis auf die Galerie. Die Ergebnisseite kennt den Code nicht: sie schickt alle im Browser gespeicherten Gast-Schlüssel (`kb_gast_<code>`, `kb_gast_e_<id>`, max. 20) mit der Verkostungs-ID. Für ein neues Gerät gibt es den persönlichen Link `?v=<code>&t=<schlüssel>` („Meinen Link teilen“); die Gästeseite übernimmt den Schlüssel und entfernt ihn aus der Adresszeile. Gemeinsamer Code: `gastGalerie*` in `common.js`. Kein Schutz gegen Screenshots oder Weitergabe des persönlichen Links.
- **Galerie** (27.10.–10.11.2026 nur für Braumeister/Admin sichtbar): Teilnehmer laden während der Verkostung bis zu neun Fotos hoch (bis 10.11.2026: drei; Knopf „+ Foto hinzufügen“). Ihr Zuschnitt hat seit 10.11.2026 nur einen Schritt (`Bilder.waehlen({ohneVorschau: true})`, Vorschau-Quadrat mittig). Das läuft über die Edge Function `galerie-hochladen`, die Code, persönlichen Schlüssel, Status und das Limit prüft – Teilnehmer haben keinen direkten Speicherzugriff. Die öffentliche Ergebnisseite zeigt die Galerie nicht mehr. Braumeister sehen die Galerie in der Verwaltung über kurzlebige Signed URLs (`Bilder.galerieSignierteUrls`) und können ebenfalls Fotos ergänzen/löschen. Seit 07.11.2026 nutzt die Verwaltung dasselbe Galerie-Modul wie „Fotos vom Brautag“ (`Bilder.galerieModul`): mehrere Fotos auf einmal (Auswahl oder Drag & Drop), je Foto Bildunterschrift und Zuschnitt vor dem Hochladen, nachträglich Bildunterschrift, Aufnahmedatum und „Ausschnitt ändern“ (auch für Gäste-Fotos; unter Gäste-Fotos steht „von <Name>“). Spalten `bildunterschrift`/`aufgenommen` und die Update-Policy: `schema/14_galerie_beschriftung.sql`. Während Ablage oder Bearbeiten offen sind, setzt das Live-Neuladen der Verwaltung aus. Gäste schneiden ihr Foto ebenfalls zu; `galerie-hochladen` nimmt dafür optional `ausschnitt` (JSON) und `basis` (unbeschnittenes Foto, nur wenn wirklich beschnitten) an und legt einen Eintrag in `bild_ausschnitte` an; `galerie-loeschen` räumt Basisbild und Eintrag mit weg.
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
- **Ergebnisseite ohne Podest** (seit 10.11.2026, Wunsch der Tester): alle Biere in einer einheitlichen Rangliste
  von Platz 1 bis zum letzten, ohne Medaillen oder Hervorhebung; Gleichstand (gleiche Note und gleiche
  Empfehlungs-Zahl) teilt sich den Platz. Bei Blindverkostungen steht die ehemalige Probennummer als Kreis am
  Kronkorken (`.probe-nr`), damit man beim Aufdecken seinen Favoriten wiedererkennt.
- **Bogen-Texte** (seit 10.11.2026): „Klarheit“ heißt „Trübung“ (Schlüssel bleibt `klarheit`, Skala klar–trüb), die
  Ja/Nein-Frage heißt „Würdest du dieses Bier weiterempfehlen?“ statt „nochmal trinken?“. Gespeichert wird weiter in
  `bewertungen.nochmal`; alte Antworten zählen als Empfehlung, Anzeige überall „% empfehlen“.
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
Ergebnisseite (`?e=<id>`) mit Rangliste und antippbaren Bieren. Dabei merkt sie sich den Gast-Schlüssel für diese Verkostung (`kb_gast_e_<id>`, für die Fotos vom Abend). Vorher legt sie die eigenen Noten je Bier im Browser ab
(`localStorage` `kb_meine_<id>`); die Ergebnisseite zeigt sie als „deine Note“ – nur auf diesem Gerät. Braumeister
landen nach „Abschließen“ ebenfalls direkt dort. Dafür liefert `vk_laden` nach dem Abschluss zusätzlich `id` und je
Probe `bier_id` (`schema/15_ergebnis_wechsel.sql`, angewendet).
