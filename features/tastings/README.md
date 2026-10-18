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

Öffentlich (Ergebnisseite): Teilnehmernamen, Noten, Kommentare **ohne** Zuordnung. Wer welche Note gab, sehen nur Braumeister.

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

- **Titelbild** (optional) lädt ein Braumeister in der Verwaltung hoch (Abschnitt „Fotos“). Es erscheint auf der Karte in der Übersicht, beim Mitmachen und auf der Ergebnisseite.
- **Galerie**: Gäste laden während der Verkostung bis zu drei Fotos hoch (Knopf „+ Foto hinzufügen“). Das läuft über die Edge Function `galerie-hochladen`, die Code, persönlichen Schlüssel, Status und das Limit prüft – Gäste haben keinen direkten Speicherzugriff. Braumeister können ebenfalls Fotos ergänzen.
- **Bierbilder**: je Bier optional *Kronkorken* (rund zugeschnitten) und *Flasche* (hochkant). In Listen, Liga und Podest wird nur die Kronkorken-Form gezeigt: ein vorhandenes Kronkorken-Bild, sonst ersatzweise das Flaschenbild, in Kronkorken-Form zugeschnitten (gezackter Kreis); gibt es keins, zeichnet `lib/bilder.js` einen Platzhalter-Kronkorken in der typischen Farbe des Bierstils. In den aufgeklappten Bierdetails (Ergebnisseite, Liga, Admin-Probendetail) zeigt `Bilder.bierFotos` zusätzlich beide hochgeladenen Fotos größer nebeneinander, wenn vorhanden.
- **Löschen** dürfen nur Braumeister (Bildfeld „Entfernen“, ✕ in der Galerie). Beim Löschen einer Verkostung gehen Titelbild und Galerie mit.
- Speicher: Bucket `bilder` (öffentlich lesbar), Pfade `verkostungen/<id>/titel-…jpg`, `verkostungen/<id>/galerie/<uuid>-…jpg`, `biere/<id>/kronkorken-…jpg`; zu jedem Bild gibt es `…_t.jpg` als Vorschau. Schema: `schema/04_images.sql`.

## Datenbank in Kürze

Tabellen `verkostungen`, `proben`, `biere`, `bierstile`, `teilnehmer`, `bewertungen`, `vorschlaege`.
Gäste haben **keinen** Tabellenzugriff, sondern nur die Funktionen `vk_beitreten`, `vk_laden`, `vk_bewerten`,
`vk_vorschlagen` (mit Code + persönlichem Schlüssel). Öffentlich: `vk_archiv`, `vk_ergebnis`, `liga_daten`.
Nur Admin: `vk_admin_bewerten`, `vk_admin_teilnehmer`, `vk_admin_teilnehmer_loeschen`.

## Offene Punkte

- Verkostung 2 und 3: Datum und Ort nachtragen
