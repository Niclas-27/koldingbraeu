# core – gemeinsamer Kern

Wird von jeder Seite geladen, vor dem Code des jeweiligen Bereichs.

| Datei | Inhalt |
|-------|--------|
| `core.js`  | Supabase-Client, Anmeldung, Passwort vergessen/festlegen, Mein Konto, Verwaltung (Einladen, Rollen), Menü, Seitenblatt, Hilfsfunktionen. Stellt alles unter `window.KB` bereit. |
| `base.css` | Farben (hell/dunkel), Schriften, Kopf, Menü, Knöpfe, Formulare, Seitenblatt, Ranglisten, aufklappbare Details, Fußzeile, Textseiten, Logo-Animation |

## Logo-Animation

Das Logo im Seitenkopf (`.brand-mini`) steht als SVG direkt in den vier Hauptseiten (nicht in Impressum und Datenschutz), damit seine Teile animiert werden können
(`.kb-bottle`, `.kb-cap`, `.kb-liquid-rect`). Die Flasche staucht sich, schnellt hoch, der Kronkorken schießt heraus,
und die Flasche läuft leer und füllt sich wieder. Das spielt einmal beim Laden der Seite und erneut bei jedem
Maus-Hover über das Logo. Auf Touch-Geräten, die kein echtes Hover haben, spielt es nur beim Laden.
Ablauf in `base.css` (Keyframes), Auslösen in `core.js` (`kbPlayLogoAnim`, setzt die Klasse `.kb-run`).
Wer das Logo austauscht, muss diese Klassen im SVG beibehalten.

## So hängt sich ein Bereich ein

```js
KB.seite = {
  start()  { /* einmalig: Knöpfe verdrahten */ },
  chrome() { /* Kopfzeile je nach Rolle anpassen (optional) */ },
  async laden() { /* Daten laden und anzeigen – läuft nach jeder An-/Abmeldung erneut */ },
};
```

Wichtige Helfer: `KB.sb` (Supabase), `KB.state` (session, profile), `KB.isBM()`, `KB.isAdmin()`, `KB.sheet()`,
`KB.toast()`, `KB.notice()`, `KB.fehlertext()`, `KB.esc()`.

## Gemeinsame Bausteine (seit 07.11.2026)

- `KB.bestaetigen(titel, text, knopf, ok, gefahr = true)` – die eine Rückfrage vor dem Löschen/Entfernen für
  alle Seiten. Eigenes kleines Fenster (`.frage`), funktioniert also auch über einem offenen Seitenblatt.
- `.nur-maus` – blendet Hinweise aus, die nur mit Maus/Trackpad Sinn ergeben (Dateien hierher ziehen), auf
  Touch-Geräten aus.
- `.toast` rückt automatisch über feste untere Knopfleisten (Sud bearbeiten, Assistent, Seitenblatt).
- `details.mehr` – „Mehr …“-Menü für seltene Aktionen (zuerst im Rezept-Detail).
- Fußzeile auf allen Seiten: „Koldingbräu · JFNLNF · Eimsbüttel · Sereetz“. Abschnittsüberschriften überall
  in `--amber`.

## Regeln

- Bereiche greifen nur auf `core/` und `lib/` zu, nie direkt auf einen anderen Bereich. Verbindungen laufen über Links
  und die Datenbank.
- Rechte immer in der Datenbank absichern; die Oberfläche blendet nur aus.
