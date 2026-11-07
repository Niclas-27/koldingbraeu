# Tests

Klicktests für alle Bereiche – sie laufen gegen eine Attrappe statt gegen die echte Datenbank, verändern also nichts.

```bash
pip install playwright && playwright install chromium   # einmalig
python3 tests/run_tests.py
```

- `fake-supabase.js` – nachgebauter Supabase-Client mit Beispieldaten; Rolle per `localStorage.test_rolle` (`anon`, `bm`, `admin`)
- `brau_test.js` – Rechentests für `lib/brau.js` (`node tests/brau_test.js`)
- `exif_test.js` – reiner Node-Unit-Test für `Bilder.exifDatum` in `lib/bilder.js` (`node tests/exif_test.js`), baut sich dafür selbst einen minimalen JPEG+Exif-Puffer, da das Playwright-Testfoto in `data/` kein EXIF enthält
- `_wizard_check.py` – isolierter Playwright-Klicktest nur für den Braugang-Assistenten (`features/brews`, `python3 tests/_wizard_check.py`), bewusst getrennt von `run_tests.py` gehalten (siehe Hinweis unten)
- `data/` – Beispieldateien (MMuM-Export „Drives Me Hazy“)
- `run_tests.py` – öffnet die Seiten am Computer und in Handygröße, klickt die Abläufe durch, prüft die Ergebnisse
- `screenshots/` – Bildschirmfotos des letzten Laufs (nicht im Repo)

Die Rechte selbst (wer darf was) prüft die Datenbank; diese Tests decken die Oberfläche ab. Neue Bereiche ergänzen
hier ihre Abläufe und bei Bedarf Beispieldaten in der Attrappe.

**Hinweis für Cloud-Sandbox-Umgebungen (z. B. Claude-Sitzungen ohne verbundenen Mac):** `run_tests.py` konnte dort
früher mit einem Playwright-`TimeoutError` mittendrin abbrechen (seit November 2026 läuft er dort meist durch), auch auf unverändertem Code – das ist bisher
Umgebungs-/Performance-Flakiness des headless Chromium in solchen Sandboxes, kein verlässliches Signal für einen
echten Fehler. Siehe `HANDOVER.md` im Projekt-Root für Details; bei Bedarf den betroffenen Bereich stattdessen
isoliert in einem eigenen kleinen Skript prüfen (Beispiel: `_wizard_check.py`).

**Vor dem Veröffentlichen** testet der Betreiber neue Funktionen zusätzlich lokal auf dem Mac gegen die echte
Datenbank (`python3 -m http.server 8000`), siehe `README.md` → Arbeitsweise.
