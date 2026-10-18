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
| Admin | zusätzlich löschen, Bewertungen ändern und nachtragen (mit Vermerk und ursprünglicher Note), Bierstile ergänzen |

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

## Datenbank in Kürze

Tabellen `verkostungen`, `proben`, `biere`, `bierstile`, `teilnehmer`, `bewertungen`, `vorschlaege`.
Gäste haben **keinen** Tabellenzugriff, sondern nur die Funktionen `vk_beitreten`, `vk_laden`, `vk_bewerten`,
`vk_vorschlagen` (mit Code + persönlichem Schlüssel). Öffentlich: `vk_archiv`, `vk_ergebnis`, `liga_daten`.
Nur Admin: `vk_admin_bewerten`, `vk_admin_teilnehmer`.

## Offene Punkte

- Verkostung 2 und 3: Datum und Ort nachtragen
