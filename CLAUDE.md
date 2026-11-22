# Koldingbräu – Hinweise für Claude

Braubuch, Verkostungen und Bierliga einer Hobbybrauerei (kolding.de). Statische Seiten auf GitHub Pages, Daten und Rechte in Supabase. Sprache: Deutsch, Tonfall locker, duzen.

Erst lesen: `README.md` (Aufbau, Regeln), `HANDOVER.md` (Deploy, Datenbank-Reihenfolge), `PRODUCT.md`, `DESIGN.md`, dazu die `README.md` des Bereichs, an dem du arbeitest.

## Regeln

- Ein Bereich unter `features/` nutzt nur `core/` und `lib/`, nie einen anderen Bereich.
- Rechte setzt die Datenbank durch (RLS), nicht die Oberfläche.
- Seitenadressen bleiben stabil.
- Neue Funktion: eigener Branch (`feature/…`, `fix/…`), PR nach `main`.
- `main` IST live: Ein Merge nach `main` steht etwa eine Minute später auf kolding.de. Nie von dir aus mergen – der Merge ist die Entscheidung zu veröffentlichen.
- Datenbank: Hinzufügen darf vor dem Release laufen, Verhalten ändern oder Daten umschreiben erst danach. SQL-Dateien liegen in `features/*/schema/`. Edge Functions werden in Supabase bereitgestellt, nicht über GitHub.
- `docs/` ist nur lokal (nicht im Repo) – nichts Wichtiges nur dort ablegen.

## Prüfen

- `python3 tests/run_tests.py` (Klicktests gegen Attrappe), `node tests/brau_test.js`
- Lokal ansehen: `python3 -m http.server`, dann http://localhost:8000 (echte Datenbank!)
- `./scripts/assets.sh` einmal ausführen, wenn `vendor/` oder `fonts/` fehlen.

## Nicht erfinden

Koldingbräu verkauft nichts: keine Testimonials, Preise oder Angebote erfinden.
