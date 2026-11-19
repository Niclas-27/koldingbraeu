---
name: Koldingbräu
description: Braubuch, Verkostungen und Bierliga einer Hobbybrauerei – nüchternes Kellerbuch mit geselligem Stammtisch.
colors:
  roestmalz: "#1f1a14"
  kellerputz: "#f3f4ef"
  papier: "#fbfbf8"
  treber: "#6c675c"
  fuge: "#dcdcd2"
  wuerze: "#b8690f"
  wuerze-hell: "#f4e3c7"
  wuerze-text: "#97550a"
  dolde: "#4e7a34"
  dolde-hell: "#e1ecd5"
  sudrot: "#a3402a"
  sudrot-hell: "#f5ddd5"
  dunkel-kellerputz: "#16120e"
  dunkel-papier: "#201a14"
  dunkel-schrift: "#efe8dc"
  dunkel-treber: "#a59c8c"
  dunkel-fuge: "#382f25"
  dunkel-wuerze: "#e59a3a"
  dunkel-wuerze-hell: "#3a2a15"
  dunkel-wuerze-text: "#e59a3a"
  dunkel-dolde: "#94c26f"
  dunkel-dolde-hell: "#22301a"
  dunkel-sudrot: "#e2826b"
  dunkel-sudrot-hell: "#3a1d16"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(2rem, 6vw, 3rem)"
    fontWeight: 800
    lineHeight: 1.05
    fontVariation: "'wdth' 80"
  headline:
    fontFamily: "Bricolage Grotesque, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(1.7rem, 5vw, 2.4rem)"
    fontWeight: 800
    lineHeight: 1.05
    fontVariation: "'wdth' 80"
  title:
    fontFamily: "Bricolage Grotesque, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 700
  body:
    fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 600
    letterSpacing: "0.09em"
  data:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.92rem"
    fontWeight: 400
    fontFeature: "'tnum'"
rounded:
  balken: "2px"
  feld: "8px"
  karte: "10px"
  panel: "16px"
  pille: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "22px"
  xl: "28px"
components:
  button:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.roestmalz}"
    rounded: "{rounded.pille}"
    padding: "9px 16px"
  button-primary:
    backgroundColor: "{colors.roestmalz}"
    textColor: "{colors.kellerputz}"
    rounded: "{rounded.pille}"
    padding: "9px 16px"
  button-danger:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.sudrot}"
    rounded: "{rounded.pille}"
    padding: "9px 16px"
  chip:
    textColor: "{colors.roestmalz}"
    rounded: "{rounded.pille}"
    padding: "5px 12px"
  chip-selected:
    backgroundColor: "{colors.wuerze-hell}"
    textColor: "{colors.roestmalz}"
    rounded: "{rounded.pille}"
    padding: "5px 12px"
  input:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.roestmalz}"
    rounded: "{rounded.feld}"
    padding: "8px 10px"
  card:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.roestmalz}"
    rounded: "{rounded.karte}"
    padding: "16px 18px"
  menu-item-active:
    backgroundColor: "{colors.wuerze-hell}"
    textColor: "{colors.roestmalz}"
    rounded: "{rounded.pille}"
    padding: "8px 18px"
  status-laeuft:
    backgroundColor: "{colors.dolde-hell}"
    textColor: "{colors.dolde}"
    rounded: "{rounded.pille}"
    padding: "3px 10px"
---

# Design System: Koldingbräu

## Overview

**Creative North Star: "Kellerbuch mit Stammtisch"**

Der Grundton ist ein sauber geführtes Kellerbuch. Kennzahlen stehen in Monospace, Abschnitte trennen Haarlinien statt Kästen, Ranglisten beginnen mit einer kräftigen Röstmalz-Linie. Farbe kommt aus der Brauerei selbst: Würze-Bernstein als einziger Akzent, Dolden-Grün und Sudrot nur dort, wo sie eine Bewertung oder einen Zustand tragen. Die Fläche ist Kellerputz, ein warmes, leicht hopfengrünes Off-White, und im Dunkelmodus ein tiefes Röstmalzbraun.

Der Stammtisch zeigt sich in den Gegenständen, nicht in der Bedienung. Kronkorken (gezackter Clip), Flaschen, Bierdeckel auf Holztisch, die Logo-Flasche, deren Korken beim Laden herausschießt, und das Konfetti bei der Siegerehrung dürfen verspielt sein. Knöpfe, Felder und Karten bleiben handfest und knapp, wie Werkzeug am Braukessel. Am meisten Verspieltes trägt das Verkostungs-Ritual. Braubuch, Rezepte und Verwaltung bleiben ruhig.

Die Dichte ist mittel bis hoch. Der Text ist deutsch, oft lang zusammengesetzt (Ausschlagwürze, Hauptguss), und die Seiten werden überwiegend am Handy benutzt, am Verkostungsabend mit einer Hand.

**Key Characteristics:**
- Warmes Off-White bzw. Röstmalzbraun als Grund, ein einziger Bernstein-Akzent
- Schmal gesetzte, schwere Grotesk-Überschriften (Bricolage Grotesque, 80 % Breite)
- Messwerte und Zahlen immer in IBM Plex Mono mit Tabellenziffern
- Linien und Tonflächen statt Schatten; Schatten nur für schwebende Ebenen
- Pillenförmige Bedienelemente, 10px-Karten, gezackte Kronkorken als Bildform
- Spiel und Animation in den Bier-Objekten, nie in der Bedienlogik

## Colors

Eine Brauerei-Palette: Röstmalz, Kellerputz, Würze und Dolde. Jede Farbe hat ein helles Begleit-Tonfeld und eine eigene Dunkelmodus-Fassung.

### Primary
- **Würze** (`wuerze`): der einzige Akzent. Links, Fokusring, Abschnittsüberschriften (Labels in Großbuchstaben), Kronkorken im Logo, Bierpegel der Ladeflasche, mittlere Note (g2). Im Dunkelmodus `dunkel-wuerze`.
- **Helle Würze** (`wuerze-hell`): Hintergrund für Auswahlzustände (aktiver Menüpunkt, gewählter Chip, Avatar, Hinweise).
- **Würze als Schrift** (`wuerze-text`, CSS `--amber-text`): jede Schrift in Würze (Links, Labels, Abschnittsüberschriften, „bewerten“, mittlere Note) und Würze-Flächen mit Schrift darauf (gewählte Note). Im Hellmodus dunkler als Würze (5,6:1 auf Papier statt 4:1), im Dunkelmodus gleich Würze.

### Secondary
- **Dolde** (`dolde`): gute Note (g1), „läuft“, „öffentlich“, Erfolgsmeldungen, Häkchen. `dolde-hell` als Tonfläche dazu.

### Tertiary
- **Sudrot** (`sudrot`): schwache Note (g3), Fehler, Löschen, „intern“. `sudrot-hell` als Tonfläche dazu.

### Neutral
- **Röstmalz** (`roestmalz`): Schrift, Primärknopf, kräftige Trennlinie über Ranglisten und Kennzahlen.
- **Kellerputz** (`kellerputz`): Seitenhintergrund, Seitenblätter, Dialoge.
- **Papier** (`papier`): Karten, Felder, Menüleiste, Kopfzeile (mit 86 % Deckkraft und Unschärfe dahinter).
- **Treber** (`treber`): Nebentext, Beschriftungen, inaktive Menüpunkte.
- **Fuge** (`fuge`): Haarlinien, Rahmen, leere Balken.

### Named Rules
**Die Eine-Würze-Regel.** Bernstein ist der einzige Akzent. Neue Bedeutungen bekommen keine neue Farbe, sondern Würze, Dolde oder Sudrot in ihrer festen Rolle.

**Die Notenampel-Regel.** Grün heißt auf dieser Seite immer „gute Note“, Bernstein „mittel“, Sudrot „schwach“ (g1/g2/g3, `gradeCls` in core.js). Wer eine Auswahl oder eigene Wahl hervorheben will, nimmt Röstmalz, nicht Grün.

**Die Würze-Schrift-Regel.** Würze als Textfarbe heißt immer `--amber-text`, nie `--amber`. `--amber` bleibt für Flächen, Linien, Fokusringe und Bier-Objekte.

**Die Zwei-Modi-Regel.** Jede Farbe kommt als Token aus `:root` und hat eine Dunkelfassung. Feste Hexwerte im Feature-CSS gibt es nur auf Fotos, Lightbox und Holztisch.

## Typography

**Display Font:** Bricolage Grotesque (mit Arial Narrow, system-ui)
**Body Font:** Figtree (mit system-ui, -apple-system, Segoe UI)
**Label/Mono Font:** IBM Plex Mono (mit ui-monospace, Menlo)

**Character:** Eine schmale, schwere Grotesk mit Eigensinn für Überschriften, eine freundliche, gut lesbare Grotesk für alles andere, und eine Schreibmaschinen-Mono für alles, was gemessen wurde. Die Schriften liegen lokal in `fonts/`, ohne Verbindung zu Google.

### Hierarchy
- **Display** (800, clamp(2rem, 6vw, 3rem), 80 % Breite): Seitentitel der Textseiten.
- **Headline** (800, clamp(1.7rem, 5vw, 2.4rem), 1.05, 80 % Breite): Kopf einer Verkostung, eines Suds, eines Rezepts. Seitenblatt-Titel 1.5rem bei 82 %.
- **Title** (700, 1.1–1.25rem): Kartentitel und Zwischentitel.
- **Body** (400, 16px, 1.5): Fließtext; Textseiten max. 720px breit mit 1.6 Zeilenhöhe.
- **Label** (600, 0.75–0.8rem, 0.07–0.09em, Großbuchstaben): Abschnittsüberschriften und Legenden in Würze; Kennzahl-Beschriftungen in Treber.
- **Data** (Plex Mono 400/500, Tabellenziffern): Messwerte, Kennzahlen, Avatar-Initialen, Fotodaten.
- **Großzahl** (Bricolage 700, 2.2rem, 85 % Breite, Zeilenhöhe 1): Kennzahlen-Leiste.

### Named Rules
**Die Messwert-Regel.** Alles, was gemessen, gewogen oder gezählt wurde (°P, EBC, IBU, g, Noten), steht in Plex Mono mit Tabellenziffern (`.num`).

**Die Schmale-Überschrift-Regel.** Bricolage wird für Überschriften immer schmal (80–85 %) und schwer (700–800) gesetzt, nie in voller Breite oder dünn.

## Layout

Eine Spalte, max. 1040px breit, mittig, mit 28px Abstand zwischen Abschnitten und mindestens 16px Seitenrand (plus Safe-Area). Am Handy (bis 760px) wird das Menü zum Hamburger, Zweispalten-Raster (`.vk-grid`) fallen auf eine Spalte, Formularpaare (`.grid2`) ab 480px. Kennzahlen-Leisten mit vier Werten gehen am Handy auf 2 × 2.

Details öffnen sich als Seitenblatt von rechts (max. 640px, Kopf und Fuß mit Haarlinie, Körper scrollt). Bearbeiten-Ansichten und der Bewertungsbogen haben eine feste Knopfleiste unten; Meldungen (Toast) rücken dann darüber. Abstände folgen grob 6 / 10 / 16 / 22 / 28px.

**Die Kein-Seitwärts-Regel.** Nichts darf am Handy seitlich scrollen. `html` und `body` schneiden horizontal ab, schwebende Panels verankern sich an der Kopfzeile, Eingabefelder haben mindestens 16px Schrift gegen den iOS-Zoom.

## Elevation & Depth

Im Ruhezustand ist alles flach. Tiefe entsteht durch Tonflächen (Kellerputz → Papier) und Haarlinien in Fuge. Schatten gibt es nur für Ebenen, die über der Seite schweben: Konto-Panel, Seitenblatt, Rückfrage, Mehr-Menü, Toast. Dazu kommt die Kopfzeile mit 86 % Deckkraft und 10px Unschärfe.

### Shadow Vocabulary
- **Panel** (`box-shadow: 0 14px 34px rgba(0,0,0,.2)`): Konto-Panel oben rechts.
- **Blatt** (`box-shadow: -8px 0 30px rgba(0,0,0,.2)`): Seitenblatt von rechts.
- **Rückfrage** (`box-shadow: 0 12px 40px rgba(0,0,0,.25)`): Bestätigungsdialog.
- **Menü** (`box-shadow: 0 8px 24px rgba(0,0,0,.15)`): Mehr-Menü.
- **Toast** (`box-shadow: 0 6px 20px rgba(0,0,0,.35)`): Meldung unten.
- **Deckel** (`filter: drop-shadow(0 4px 5px rgba(0,0,0,.55))`): Bierdeckel auf dem Holztisch, das einzige Objekt mit Schatten im Inhalt.

**Die Flach-bis-es-schwebt-Regel.** Karten, Knöpfe und Listen haben keinen Schatten. Ein Schatten heißt immer: Diese Ebene liegt über der Seite.

## Shapes

Zwei Formfamilien. Die Bedienung ist rund: Knöpfe, Chips, Suche, Menü und Status sind Pillen (999px), Kreisknöpfe fürs Schließen. Die Inhalte sind weich-eckig: Karten, Hinweise und Dialoge 10px, Felder und Fotos 8px, das Konto-Panel 16px. Dazu kommen die Bier-Formen: der gezackte Kronkorken als Clip-Pfad für Fotos (`.kb-zack`), die Flasche im Hochformat 3:4, die eckigen Bierdeckel und die Logo-Flasche.

## Components

### Buttons
Handfest, knapp, pillenförmig.
- **Shape:** Pille (999px), 600er Gewicht, 0.9rem, Abstand 9px 16px.
- **Standard:** Papier mit Fuge-Rahmen; Hover zieht den Rahmen auf Treber.
- **Primary:** Röstmalz-Fläche mit Kellerputz-Schrift; Hover 90 % Deckkraft. Eine pro Ansicht.
- **Danger:** Sudrot-Schrift und -Rahmen; als Ghost ohne Rahmen.
- **Ghost:** ohne Rahmen und Fläche, für Nebenaktionen.
- **Fokus:** 2px Würze-Ring mit 2px Abstand (global).
- **Disabled:** 50 % Deckkraft.

### Chips
- **Style:** Pille, transparenter Grund, Fuge-Rahmen, 0.84rem.
- **State:** gewählt (`aria-pressed`) = helle Würze mit Würze-Rahmen.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** Papier auf Kellerputz.
- **Shadow Strategy:** keiner (siehe Elevation).
- **Border:** 1px Fuge.
- **Internal Padding:** 16px 18px, 12px Abstand innen.

### Inputs / Fields
- **Style:** Papier, 1px Fuge, 8px Ecken, 8px 10px, mindestens 16px Schrift. Beschriftung darüber in Treber, 0.8rem, bleibt sichtbar.
- **Focus:** globaler Würze-Ring.
- **Error:** Sudrot-Text darunter (`.err`).

### Navigation
- **Desktop:** Pillen-Leiste auf Papier mit Fuge-Rahmen; Punkte in Treber, 600, 0.88rem; aktiv = helle Würze mit Röstmalz-Schrift.
- **Handy (bis 760px):** Hamburger mit drei Strichen, die zum X werden; Menü klappt als Spalte auf. Logo links, Theme- und Konto-Knopf rechts.

### Rangliste
Das Herz der Ergebnisse. Beginnt mit 2px Röstmalz-Linie, Zeilen mit Fuge-Haarlinie. Platz in Treber links, Name fett, Note rechts in Mono, darunter ein 4px-Balken in der Notenfarbe. Die Zeilen klappen auf zu Geschmacksprofil, Zitaten (kursiv, Würze-Linie links) und Einzelnoten.

### Kronkorken, Flasche, Bierdeckel
Bierbilder werden nie rechteckig gezeigt. Kronkorken-Fotos laufen durch den gezackten Clip, Flaschen im Hochformat; ohne Foto gibt es einen gezeichneten Platzhalter. Die Vorschau einer Verkostung ist eine Reihe eckiger Bierdeckel auf Holztisch, leicht gedreht.

### Logo- und Ladeflasche
Die Flasche aus dem Logo staucht sich, der Korken schießt heraus, das Bier läuft aus und wird nachgefüllt. Beim Laden der Seite und beim Hover einmal, als Ladeanzeige in Schleife (erst nach 0,3 s). Bei reduzierter Bewegung steht alles still.

## Do's and Don'ts

### Do:
- **Do** Farben nur über die `:root`-Tokens aus `core/base.css` setzen, damit der Dunkelmodus mitzieht.
- **Do** Messwerte und Noten in IBM Plex Mono mit Tabellenziffern setzen.
- **Do** Noten immer mit der Notenampel färben: Dolde gut, Würze mittel, Sudrot schwach.
- **Do** Abschnitte mit Haarlinien (1px Fuge) und Ranglisten/Kennzahlen mit 2px Röstmalz-Linie oben gliedern.
- **Do** Verspieltes in Bier-Objekte legen: Kronkorken, Flasche, Bierdeckel, Konfetti bei der Siegerehrung.
- **Do** jede Animation unter `prefers-reduced-motion: reduce` abschalten.
- **Do** Tippflächen am Handy mindestens 40px groß und Eingabefelder mit mindestens 16px Schrift bauen.

### Don't:
- **Don't** einen zweiten Akzent neben Würze einführen oder Grün für etwas anderes als „gut“ verwenden.
- **Don't** Karten, Knöpfe oder Listen mit Schatten versehen; Schatten gehören nur schwebenden Ebenen.
- **Don't** Bedienelemente verspielt machen (wackelnde Knöpfe, bunte Verläufe); das Spiel gehört den Objekten.
- **Don't** Bricolage Grotesque in voller Breite oder dünn setzen.
- **Don't** Bierfotos als nackte Rechtecke zeigen, wenn es Kronkorken- oder Flaschenform gibt.
- **Don't** etwas bauen, das am Handy seitlich scrollt.
