# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Drei Gruppen, gleich gewichtet; welche eine Seite vorrangig bedient, entscheidet die Seite selbst:

- **Gäste am Verkostungsabend:** Freunde und Bekannte, die per QR-Code oder Link mitmachen, nur ihren Namen eingeben und am eigenen Handy bewerten. Kein Konto, keine Einweisung, oft mitten im geselligen Abend.
- **Braumeister:** die kleine, per Einladung aufgenommene Gruppe, die Sude, Rezepte, Bierkeller und Verkostungen im Browser pflegt. Admin darf zusätzlich löschen, einladen und Rollen vergeben.
- **Öffentliche Besucher:** wer kolding.de über einen geteilten Link (Ankündigung, Ergebnisseite) oder über Suche findet und das Braubuch, Verkostungsergebnisse und die Liga ansieht.

## Product Purpose

Koldingbräu ist das Braubuch einer Hobbybrauerei: alle Sude seit 2018 mit Schüttung, Maischplan, Hopfengaben, Hefe, Messwerten und Abfüllung, dazu Rezepte, Verkostungen und die Bierliga. Die Seite organisiert die Verkostungsabende von der Einladung über das Bewerten bis zum aufgedeckten Ergebnis und bewahrt alles als gemeinsame Chronik.

## Positioning

Das Herz ist das Verkostungs-Ritual: Einladung teilen, am Abend per QR-Code mitbewerten, Live-Zwischenstand, Ergebnis aufdecken, und jede abgeschlossene Verkostung zählt für die Bierliga. Braubuch und Rezepte sind das Fundament, auf dem dieses Ritual steht.

## Operating Context

- Verkostungsablauf: *In Vorbereitung* (Gäste schlagen mitgebrachte Biere vor) → *Läuft* (bewerten, Live-Zwischenstand) → *Abgeschlossen* (Ergebnis aufgedeckt, zählt für die Liga).
- Gäste bewerten am Handy: Gesamtnote 0–10 ist Pflicht, alles andere freiwillig. Ihr persönlicher Schlüssel liegt nur auf ihrem Handy.
- Einladungen gehen als fertige Nachricht per WhatsApp & Co. raus (`verkostung.html?a=…`); geteilte Links bekommen eigene Vorschauseiten (`scripts/build-previews.mjs`).
- Fotos gehören dazu: Titelbild und Galerie je Verkostung, Kronkorken- und Flaschenbild je Bier, Foto je Sud und Rezept; ohne Foto ein gezeichneter Platzhalter.

## Capabilities and Constraints

- Statische Seiten auf GitHub Pages (kolding.de), Daten und Rechte in Supabase; Rechte setzt die Datenbank durch, nicht die Oberfläche.
- Gegliedert in Bereiche unter `features/` (brews, tastings, league, recipes, cellar); ein Bereich nutzt nur `core/` und `lib/`.
- Gäste sehen nur freigegebene Sude ohne Notizen und Bewertung; wer welche Note gab, sehen nur Braumeister.
- Seitenadressen bleiben stabil.
- Sprache: Deutsch.

## Brand Commitments

- Name: Koldingbräu. Logo: `assets/kolding-logo.svg`.
- Tonfall: locker, unter Freunden. Duzen, kurz, gern mit etwas Augenzwinkern, so wie man am Braukessel redet.
- Begriffe der Seite: Sud, Braubuch, Braumeister, Verkostung, Bierkeller, Bierliga.

## Evidence on Hand

- Echte Sude seit 2018 (22 Altbestands-Sude in `sude.json`, laufende in der Datenbank), echte Verkostungsergebnisse, Liga-Tabelle, Fotos aus Verkostungen.
- Keine Testimonials, Pressestimmen oder Verkaufsangebote. Koldingbräu verkauft nichts; so etwas nicht erfinden.

## Product Principles

1. **Das Ritual zuerst.** Was den Verkostungsabend leichter, spannender oder geselliger macht, hat Vorrang.
2. **Mitmachen ohne Hürde.** Gäste kommen ohne Konto und Erklärung durch, am Handy, mitten im Abend.
3. **Jede Seite kennt ihr Publikum.** Gäste, Braumeister und öffentliche Besucher sind gleich wichtig; jede Seite entscheidet, wen sie vorrangig bedient, statt allen halb zu dienen.
4. **Die Chronik ist echt.** Braubuch, Ergebnisse und Liga zeigen nur, was wirklich gebraut, getrunken und bewertet wurde.
5. **Klingt wie wir.** Locker und kurz, nie behördlich.
