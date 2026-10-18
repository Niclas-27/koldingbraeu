# Tests

Klicktests für alle Bereiche – sie laufen gegen eine Attrappe statt gegen die echte Datenbank, verändern also nichts.

```bash
pip install playwright && playwright install chromium   # einmalig
python3 tests/run_tests.py
```

- `fake-supabase.js` – nachgebauter Supabase-Client mit Beispieldaten; Rolle per `localStorage.test_rolle` (`anon`, `bm`, `admin`)
- `brau_test.js` – Rechentests für `lib/brau.js` (`node tests/brau_test.js`)
- `data/` – Beispieldateien (MMuM-Export „Drives Me Hazy“)
- `run_tests.py` – öffnet die Seiten am Computer und in Handygröße, klickt die Abläufe durch, prüft die Ergebnisse
- `screenshots/` – Bildschirmfotos des letzten Laufs (nicht im Repo)

Die Rechte selbst (wer darf was) prüft die Datenbank; diese Tests decken die Oberfläche ab. Neue Bereiche ergänzen
hier ihre Abläufe und bei Bedarf Beispieldaten in der Attrappe.
