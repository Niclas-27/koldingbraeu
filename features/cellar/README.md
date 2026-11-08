# Bierkeller (`bierkeller.html`)

Seit 08.11.2026. Alle Biere an einem Ort – auch ohne anstehende Verkostung.

- **Nur für Braumeister.** Der Menüpunkt hat `class="nur-bm"` und wird von `core/core.js` nur für Braumeister
  eingeblendet; Gäste sehen auf der Seite nur einen Hinweis. Die Seite hat `noindex` (nicht für Suchmaschinen).
- **Suchen und filtern:** Suche über Name, Brauerei und Stil; Chips „Selbst gebraut“, „Gekauft“, „Noch nie
  verkostet“, Auswahl nach Bierstil, Sortierung „Zuletzt verkostet“ oder „Name A–Z“.
- **Anlegen und bearbeiten:** dasselbe Formular wie in der Verkostung (Kronkorken, Flasche, Verknüpfung zum Sud).
- **Löschen:** nur Admin, nur Biere, die in keiner Verkostung stehen – sonst stimmten Liga und Ergebnisse nicht mehr.
  Vorher kommt eine Rückfrage.

Formular, Datenladen und Filter stecken in `lib/bierform.js` (`BierForm`) und werden genauso vom Fenster „Bier
hinzufügen“ einer Verkostung genutzt (`features/tastings/admin.js`). Der frühere „Biere“-Dialog in der
Verkostungsübersicht ist durch einen Link auf den Bierkeller ersetzt.

Keine Datenbank-Änderung: genutzt werden die bestehenden Tabellen `biere`, `proben`, `bierstile` mit ihren RLS-Regeln.
