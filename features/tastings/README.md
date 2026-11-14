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

Ablauf: *In Vorbereitung* → *Läuft* → *Abgeschlossen*. Beim Abschließen prüft der Braumeister erst Texte und Titel („Abschluss vorbereiten“), danach sehen
alle die Siegerehrung und dann die Rangliste (siehe „Abschluss“ unten).

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

## Einfacher Bewertungsbogen (seit 13.11.2026)

Die Gäste sind keine Profis – der Bogen hat darum vier kurze Seiten statt 7 Schritte (`form.js`), jede passt ohne
Scrollen aufs Handy:
1. **Riechen** – Tags `TAGS_GERUCH` (fruchtig, zitronig, blumig, kräuterig, brotig, karamellig, röstig, bananig),
2. **Schmecken** – Tags `TAGS_GESCHMACK` (hopfig, malzig, spritzig, leicht, kräftig, süffig, ungewöhnlich, nicht meins),
3. **Geschmacksbild** – die Geschmackskarte (früher Geschmackskreis, siehe unten, optional),
4. **Dein Urteil** – Note 0–10 (einziges Pflichtfeld) und „Dein Satz zum Bier“ (optional, eine Zeile, max. 140 Zeichen;
   Spalte `kommentar`).

Beide Tag-Listen stehen in `common.js` als `[wort, emoji, erklärung]`. Gespeichert werden alle Tags zusammen in
`bewertungen.geruch` (nur das Wort, das Emoji kommt beim Anzeigen dazu, `eindruck()`) – deshalb darf kein Wort in beiden
Listen vorkommen. Ergebnisseite und Verwaltung trennen per `istGeschmack()` wieder in „Geruch“ und „Geschmack“; ältere
Bewertungen enthalten noch die früheren Geruchs-Tags (Zitrus, Banane …), die beim Geruch landen. Die Liga zeigt alles
gemeinsam als „Eindrücke“ (`liga.html` lädt `common.js` nicht).

**Blättern:** „Weiter“/„Zurück“ und zusätzlich Wischen. Gewischt wird nur bei einer überwiegend waagerechten Geste über
einem Viertel der Breite, nie im Textfeld und nie auf der Geschmackskarte, und Wischen speichert nie – gespeichert wird nur mit dem Knopf. Die Seiten
liegen nebeneinander auf einer Spur (`.bogen-spur`), damit alle Eingaben beim Hin- und Herblättern erhalten bleiben.

**Glossar:** Seit 14.11.2026 nur noch beim Geschmacksbild („?“ in der Überschrift, Begriffe aus `KREIS_BEGRIFFE`);
bei Riechen/Schmecken stehen die Beispiele auf den Kacheln. Escape schließt nur das Glossar, nicht den Bogen.

**Geschmackskreis:** ein Kreis mit vier Polen – 12 Uhr Bitter, 3 Uhr Süß, 6 Uhr Mild, 9 Uhr Trocken. Der Gast tippt
einen Punkt in den Kreis und kann ihn ziehen; Mitte = ausgewogen, Rand = sehr ausgeprägt. Während des Tippens steht
die Wahl in Worten in einer Blase über dem Daumen („Bitter und leicht süß“), zusätzlich als Text unter dem Kreis.
Pfeiltasten verschieben den Punkt, „Zurücksetzen“ nimmt ihn wieder weg. Gespeichert wird der Punkt in den beiden
früheren Reglern in `merkmale`: `bitter` (0 = mild … 10 = bitter) und `suesse` (0 = trocken … 10 = süß) – dadurch
passen neue und alte Bewertungen zusammen, und das Geschmacksprofil der Ergebnisseite zeigt sie ohne Änderung an. Eine
Variante mit 17 festen Feldern wurde ausprobiert, die stufenlose gefiel besser. Seit dem Kreis sind die Tags „herb“ und
„süß“ aus „Schmecken“ entfernt (`TAGS_GESCHMACK_FRUEHER` hält sie nur für schon gespeicherte Bewertungen).

**Geschmackskarte statt Kreis (seit 13.11.2026, PR „Geschmackskarte“):** Der Kreis saß nicht mittig (ungleich breite
Beschriftung links/rechts), ließ die Ecken ungenutzt und kappte sie sogar – „sehr bitter und sehr süß“ war nicht
wählbar. Jetzt ist es ein Quadrat über die volle Breite (`karteHtml` in `common.js`), Pole als Etiketten in der Karte
(dadurch exakt mittig), flach in den Seitenfarben (Fläche `--surface`, Linie `--line`, Punkt in `--amber`), in den Ecken Bierstil-Beispiele zur Orientierung
(`KARTE_ECKEN`: herb & trocken – Pils, IPA; bitter & süß – Imperial Stout; mild & trocken – Weizen, Kölsch; mild & süß –
Bock, Märzen). Jede Achse wird einzeln auf -1…1 begrenzt, damit bilden die Werte 0–10 genau das Quadrat ab. Die Größe
ist an die Bildschirmhöhe gekoppelt (mind. 220 px), damit die Seite auch auf einem iPhone SE ohne Scrollen passt. Die
Blase springt im oberen Bereich unter den Punkt. Im Code heißt es weiter „kreis“ (`f.kreis`, `kreisText`, `#kreisText`).

**Kompakter (14.11.2026):** Ohne Bierstil-Ecken und ohne Hinweistext; „Was heißt das?“ und „Zurücksetzen“ sind kleine
Symbol-Knöpfe (? und ↺) rechts in der Überschrift. Die Blase steht immer über dem Finger und ragt ganz oben über die
Überschrift (`#bogenInhalt` hat dafür oben 20 px Innenabstand bei −20 px Außenabstand). Der Fortschritt ist eine
3-px-Linie an der Oberkante der Fußleiste, „3 / 4“ nur noch für Screenreader. Karte bis `100svh − 305px` (iPhone volle
Breite, iPhone SE ~250 px), auf niedrigen Bildschirmen ist der Kopf des Bogens flacher.

**Riechen/Schmecken als Kacheln (14.11.2026):** Statt der Chips zwei Spalten mit je vier Kacheln (`.kachel`): Emoji,
Wort, darunter kurze Beispiele („Apfel, Beeren, Pfirsich“), Haken oben rechts zeigt die Auswahl. Die Beispiele sind das
dritte Feld in `TAGS_GERUCH`/`TAGS_GESCHMACK` und ersetzen auf diesen Seiten Hinweistext und Glossar; rechts in der
Überschrift steht klein „mehrere möglich“. Das Glossar („?“) gibt es nur noch beim Geschmacksbild.

**Punktwolke auf der Ergebnisseite (seit 13.11.2026):** Im aufgeklappten Bier zeigt „Geschmacksbild · n Stimmen“ die
Karte mit einem Punkt je Bewertung, einem Kreuz für den Schnitt und – nur auf dem Gerät des Gastes – seinem eigenen
Punkt in Röstmalz-Dunkel (`--ink`; nicht Grün, das steht auf der Seite für gute Noten) (`localStorage` `kb_meine_k_<id>`, `[suesse, bitter]` je Bier, legt `guest.js` beim Aufdecken mit ab).
Bittere/Süße erscheinen dann nicht noch einmal als Balken im Geschmacksprofil. Unter der Rangliste zeigt „Alle Biere
auf einer Karte“ jedes Bier als Kronkorken mit Probennummer (wie in der Rangliste) an seinem Schnittpunkt – bewusst ohne Notenfarbe, Grün sah nach Rangfolge aus; die Liste darunter ist nach Probennummer sortiert und nennt den Platz mit Namensliste darunter. Dafür
liefert `vk_ergebnis` je Probe zusätzlich `kreis` = Liste `[suesse, bitter]` der sichtbaren Bewertungen, ohne Namen,
zufällig sortiert (`schema/16_ergebnis_geschmackskarte.sql`, additiv). Ohne dieses Feld (Datenbank noch nicht
erweitert) zeigt die Seite nur den Schnitt aus `merkmale`.

Weggefallen sind die übrigen Regler (Aussehen, Geruch, Mundgefühl usw.) und die Frage „Würdest du dieses Bier
weiterempfehlen?“. Die Spalten `merkmale`, `nochmal` und `fehler` bleiben für die historischen Daten; neue Bewertungen
senden in `merkmale` nur noch den Kreis, sonst `null` / `[]`, beim erneuten Speichern einer alten Bewertung gehen deren Werte unverändert mit. Das
Geschmacksprofil wird weiter gezeigt, wo alte Werte vorliegen; „% empfehlen“ wird nicht mehr angezeigt (bleibt nur als
stiller Gleichstand-Brecher in der Sortierung). Keine Datenbank-Änderung nötig.

Nach dem Speichern bietet der Bogen „Weiter zu Probe X“ an (nächstes noch nicht bewertetes Bier). Wischen zwischen den
Bieren gibt es bewusst nicht: versehentliches Wischen beim Antippen der Tags, die Biere kommen ohnehin nacheinander.

## Abschluss: Zusammenfassung, Titel, Siegerehrung (seit 14.11.2026)

Ziel: ein lustigerer Abschluss. Drei Bausteine, bewusst klein gehalten – der Nutzer will das später ausbauen
(Titel pro Gast, wählbarer Tonfall, Tippspiel, Urkunde zum Teilen).

- **Zusammenfassung je Bier** – ein, zwei Sätze aus Noten und Kommentaren, in `proben.zusammenfassung`
  (max. 400 Zeichen im Formular). Öffentlich erst nach dem Aufdecken über `vk_ergebnis`
  (`schema/17_zusammenfassung.sql`, additiv); schreiben dürfen nur Braumeister (Policy „Braumeister ändern Proben“).
  Angezeigt in der Siegerehrung und oben in den aufgeklappten Bierdetails der Ergebnisseite (`.kurz`).
- **Titel pro Bier** – rein aus den Noten berechnet, nichts gespeichert (`VK_TITEL`, `vkTitel()` in `common.js`):
  „Streitfall des Abends“ (größte Spanne zwischen bester und schlechtester Note, mindestens 3 Punkte),
  „Konsensbier“ (kleinste Spanne, höchstens 1 Punkt), „Einstimmig empfohlen“ (alle empfehlen es). Jeder Titel
  höchstens einmal pro Verkostung, nur bei eindeutigem Ergebnis (Gleichstand der Spanne entscheidet die Streuung,
  sonst kein Titel) und nur für Biere ab drei Bewertungen. Bei zwei, drei Gästen gibt es deshalb oft keinen Titel.
- **Siegerehrung** (`siegerehrung()` in `results.js`) – bildschirmfüllend über der Ergebnisseite, eine Karte pro
  Bier vom letzten Platz bis zum Sieger: Platz, Kronkorken (blind: mit Probennummer), Note, Empfehlungen, „deine
  Note“, Titel, Zusammenfassung. „Weiter“/„Zurück“, Wischen, Pfeiltasten; „Überspringen“ bzw. Escape geht immer.
  Jeder blättert am eigenen Gerät (keine Synchronisierung). Startet von selbst nur direkt nach dem Aufdecken –
  Gästeseite und Verwaltung hängen dafür `&ehrung=1` an die Ergebnis-Adresse, der Zusatz wird sofort wieder entfernt –
  sonst über den Knopf „Siegerehrung ansehen“. Die Rangliste bleibt ohne Podest.

**Verwaltung:** „Abschließen und aufdecken“ öffnet den Zwischenschritt „Abschluss vorbereiten“ (`zusammenfassungen()`
in `admin.js`): Rangfolge mit Titeln und einem Textfeld je Bier, Hinweis auf fehlende Texte, „Texte neu laden“ (holt
neue Texte aus der Datenbank, ohne selbst Geändertes zu überschreiben), „Jetzt aufdecken“ (speichert und schließt
ab). Aufdecken geht auch ohne Texte. Bei abgeschlossenen Verkostungen öffnet „Zusammenfassungen“ dasselbe Blatt zum
nachträglichen Ändern.

**Woher die Texte kommen:** bewusst ohne API-Schlüssel – Claude schreibt sie im Chat (Projekt „Koldingbraeu“,
Supabase-Verbindung) direkt in `proben.zusammenfassung`. Der Braumeister schickt die im Blatt angezeigte Nachricht
(„Schreib die Zusammenfassungen für die Verkostung ‚…‘“), wartet kurz und tippt „Texte neu laden“. Eine
automatische Erzeugung per Edge Function kann später als zusätzlicher Knopf dazukommen (Stub
`verkostung-zusammenfassen` existiert in Supabase, wird nicht benutzt).

Regeln für die Texte: ein bis zwei Sätze, höchstens etwa 200 Zeichen; Noten, Empfehlungen und Kommentare mischen;
trocken-humorvoll, nicht verletzend; **keine Namen und keine Zuordnung, wer was gesagt hat** (wie auf der
Ergebnisseite); Zitate nur wörtlich aus den Kommentaren; ausgeblendete Bewertungen nicht verwenden; nichts
erfinden. Die Spalte `proben.zusammenfassung_test` enthält nur noch sechs alte Testtexte (mit Namen, veraltete
Noten) als Sicherung und wird nirgends angezeigt.
