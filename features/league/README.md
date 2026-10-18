# Bereich: Liga

**Wozu:** Öffentliche Rangliste aller Biere aus abgeschlossenen Verkostungen.

**Seite:** `liga.html` – Sprung zu einem Bier: `liga.html#bier=<uuid>`

## Regeln

- Gewertet wird allein die Gesamtnote (0–10), Durchschnitt über alle Bewertungen.
- Ein Bier zählt ab **3** Bewertungen (`MIN` in `league.js`); weniger lässt sich einblenden.
- Gleichstand: mehr „würde nochmal trinken“ gewinnt.
- Filter: Bierstil, Koldingbräu/andere, Jahr. Jedes Bier klappt auf und verlinkt auf die Ergebnisseiten seiner Verkostungen.

## Dateien

| Datei | Inhalt |
|-------|--------|
| `league.js` | Laden über `liga_daten()`, Zusammenfassen und Filtern im Browser |
| `league.css` | Gestaltung nur dieses Bereichs |

Daten: Funktion `liga_daten()` aus `features/tastings/schema/` – eine Zeile je Bier und Verkostung.
