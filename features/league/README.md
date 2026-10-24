# Bereich: Liga

**Wozu:** Öffentliche Rangliste aller Biere aus abgeschlossenen Verkostungen.

**Seite:** `liga.html` – Rangliste. Jedes Bier hat eine eigene Detailseite: `liga.html?bier=<uuid>`.

## Regeln

- Gewertet wird allein die Gesamtnote (0–10), Durchschnitt über alle Bewertungen.
- Ein Bier zählt ab **3** Bewertungen (`MIN` in `league.js`); weniger lässt sich einblenden.
- Gleichstand: mehr „würde nochmal trinken“ gewinnt.
- Filter: Bierstil, Koldingbräu/andere, Jahr. Jedes Bier verlinkt auf seine eigene Detailseite.

## Bier-Detailseite (`liga.html?bier=<uuid>`)

Eigene Seite statt Sheet (wie bei Suden und Rezepten), Kopf im gleichen Stil (Kronkorken/Flaschenbild,
Name, 4-spaltige Kennzahlen: Schnitt, Bewertungen, Nochmal-Quote, Alkohol). Darunter, zusammengefasst
über **alle** abgeschlossenen Verkostungen, bei denen das Bier dabei war:

- Bilder (Kronkorken- und Flaschenfoto, falls hochgeladen)
- Geschmacksprofil (Durchschnitt je Merkmal, wie im Bewertungsbogen)
- Geruch- und Fehlaromen-Tags
- Kommentare (ohne Namen, wie auf den Ergebnisseiten)
- Liste der Verkostungen, bei denen es dabei war, mit Link zur jeweiligen Ergebnisseite

## Dateien

| Datei | Inhalt |
|-------|--------|
| `league.js` | Liste über `liga_daten()`, Detailseite über `bier_detail(p_id)` |
| `league.css` | Gestaltung nur dieses Bereichs |

Daten: Funktion `liga_daten()` (Liste, eine Zeile je Bier und Verkostung) und `bier_detail(p_id)`
(Detailseite, über alle Verkostungen zusammengefasst) aus `features/tastings/schema/`.
