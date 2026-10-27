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
- **Galerie** (seit 27.10.2026 **nur für Braumeister/Admin sichtbar**): Teilnehmer laden während der Verkostung bis zu drei Fotos hoch (Knopf „+ Foto hinzufügen“), bekommen aber keine Fotos – weder eigene noch fremde – zurückgezeigt, nur die Anzahl ihrer bereits hochgeladenen Fotos. Das läuft über die Edge Function `galerie-hochladen`, die Code, persönlichen Schlüssel, Status und das Limit prüft – Teilnehmer haben keinen direkten Speicherzugriff. Die öffentliche Ergebnisseite zeigt die Galerie nicht mehr. Braumeister sehen die Galerie in der Verwaltung über kurzlebige Signed URLs (`Bilder.galerieSignierteUrls`) und können ebenfalls Fotos ergänzen/löschen.
- **Bierbilder**: je Bier optional *Kronkorken* (rund zugeschnitten) und *Flasche* (hochkant). In Listen, Liga und Podest wird nur die Kronkorken-Form gezeigt: ein vorhandenes Kronkorken-Bild, sonst ersatzweise das Flaschenbild, in Kronkorken-Form zugeschnitten (gezackter Kreis); gibt es keins, zeichnet `lib/bilder.js` einen Platzhalter-Kronkorken in der typischen Farbe des Bierstils. In den aufgeklappten Bierdetails (Ergebnisseite, Liga, Admin-Probendetail) zeigt `Bilder.bierFotos` zusätzlich beide hochgeladenen Fotos größer nebeneinander, wenn vorhanden. Öffentlich sichtbar.
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

Der Beitritts-Code (Spalte `code`) wird beim Anlegen per Trigger `vk_code_setzen` aus einem Titel-Kürzel und
einem kurzen Zufallsteil gebildet (z. B. `craftbier-q7x2pmz4`), damit der Mitmach-Link lesbarer ist, ohne
erratbar zu werden. Ein späteres Umbenennen ändert den Code nicht mehr.

## Offene Punkte

- Verkostung 2 und 3: Datum und Ort nachtragen
