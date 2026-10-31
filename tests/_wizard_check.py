#!/usr/bin/env python3
"""Isolierter Klicktest für den Braugang-Assistenten (siehe Hinweis in docs/arbeitsstand zur Sandbox-
Test-Flakiness von tests/run_tests.py) – eigener kleiner Kontext, nur die relevanten Schritte, gegen
dieselbe Test-Attrappe tests/fake-supabase.js wie der Gesamtlauf. Kein Teil von run_tests.py.

Aufruf: python3 tests/_wizard_check.py
"""
import asyncio, subprocess, sys, time
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
FAKE = (ROOT / "tests" / "fake-supabase.js").read_text(encoding="utf-8")
PORT = 8766
BASE = f"http://localhost:{PORT}/"
fehler = []

def pruefe(name, bedingung):
    print(("  ok    " if bedingung else "  FEHLT ") + name)
    if not bedingung:
        fehler.append(name)

async def gehe_zu(pg, index):
    """Per Punkt in der Fußleiste zu Schritt `index` (0-basiert) springen."""
    await pg.click(f'[data-wz-goto="{index}"]')
    await pg.wait_for_timeout(150)

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        ctx = await br.new_context(viewport={"width": 420, "height": 900})  # Handy-Breite, wie beim Brauen genutzt
        await ctx.route("**/vendor/supabase.js", lambda r: r.fulfill(body=FAKE, content_type="text/javascript"))
        await ctx.route("**/fonts/*.woff2", lambda r: r.fulfill(status=204, body=""))
        pg = await ctx.new_page()
        pg.on("pageerror", lambda e: fehler.append(f"JS-Fehler: {e}"))
        await pg.goto(BASE + "index.html")
        await pg.evaluate("localStorage.setItem('test_rolle','bm')")
        await pg.goto(BASE + "index.html")
        await pg.wait_for_timeout(500)

        await pg.click("#newBtn")
        await pg.wait_for_selector("#ausRz")
        await pg.select_option("#nr_rz", "r1")
        await pg.click("#ausRz button[type=submit]")
        await pg.wait_for_selector(".fortschritt", timeout=5000)
        pruefe("Neun Schritte in der Fußleiste", await pg.locator(".punkte .punkt").count() == 9)
        pruefe("Zähler zeigt 1 / 9", "1 / 9" in await pg.inner_text(".zahl"))
        pruefe("Erster Schritt aktiv (Rezept & Start)", "Rezept & Start" in await pg.inner_text("#wzStepTitel"))
        pruefe("Kopf zeigt klein den Braugang-Titel", await pg.locator(".wz-kopf .kicker").count() == 1)
        pruefe("Plan-Hinweis zum Rezept sichtbar", "Kolding Kölsch" in await pg.inner_text("#wzBody"))
        pruefe("Status Entwurf", "Entwurf" in await pg.inner_text("#wzBody"))
        pruefe("Kein großes Schritt-Menü mehr (nur die kleinen Punkte)", await pg.locator(".wz-steps").count() == 0)

        # Schritt 2: Wasser – Härte-Rechner
        await gehe_zu(pg, 1)
        pruefe("Schritttitel wechselt auf Wasser & Milchsäure", "Wasser" in await pg.inner_text("#wzStepTitel"))
        await pg.fill("#f_wasserhaerte", "14")
        await pg.fill("#f_hauptguss", "20")
        await pg.wait_for_timeout(150)
        empf = await pg.inner_text("#wzRecHg")
        pruefe("Härte-Rechner zeigt eine Empfehlung ungleich –", empf.strip() != "–")
        await pg.wait_for_timeout(700)  # Autosave-Debounce
        pruefe("Gespeichert-Anzeige aktualisiert", "gespeichert" in (await pg.inner_text("#wzStatus")).lower())

        # Schritt 3: Schüttung – weitere Zutat
        await gehe_zu(pg, 2)
        vor = await pg.locator("#rl_malz .r").count()
        await pg.click('[data-wz-add="malz"]')
        await pg.wait_for_timeout(200)
        pruefe("Neue Malz-Zeile erscheint und bleibt stehen", await pg.locator("#rl_malz .r").count() == vor + 1)

        # Schritt 7: Anstellen – Stammwürze eintragen (für die Alkohol-Berechnung)
        await gehe_zu(pg, 6)
        pruefe("Schritt heißt Kühlen & Anstellen", "Anstellen" in await pg.inner_text("#wzStepTitel"))
        await pg.fill("#f_stammwuerze", "12")
        await pg.wait_for_timeout(700)

        # Schritt 8: Gärung – Zwischenmessung + Restextrakt (löst die Alkohol-Berechnung aus)
        await gehe_zu(pg, 7)
        pruefe("Schritt heißt nur noch Gärung (ohne Abfüllen)", await pg.inner_text("#wzStepTitel") == "Gärung")
        pruefe("Kein Abschließen-Knopf mehr im Gärung-Schritt", await pg.locator("#wzAbschliessen").count() == 0)
        await pg.click("#btnMessungHinzufuegen")
        await pg.fill('#rl_messungen [data-mz-bez]', "Tag 4")
        await pg.fill('#rl_messungen [data-mz-plato]', "8.2")
        await pg.wait_for_timeout(700)
        calls = await pg.evaluate("window.__calls.filter(c => c[0] === 'sud_messungen' && c[1] === 'insert')")
        pruefe("Zwischenmessung als Insert in sud_messungen gespeichert", len(calls) == 1 and calls[0][2]["bezeichnung"] == "Tag 4")
        await pg.fill("#f_restextrakt", "3")
        await pg.wait_for_timeout(700)

        # Schritt 9: Abfüllung – Alkohol sollte automatisch berechnet sein, Abschließen beendet den Braugang
        await gehe_zu(pg, 8)
        pruefe("Schritt heißt Abfüllung", "Abfüllung" in await pg.inner_text("#wzStepTitel"))
        alkohol = await pg.input_value("#f_alkohol")
        pruefe("Alkohol automatisch aus Stammwürze/Restextrakt berechnet (≈4,8)", alkohol.replace(",", ".").startswith("4.8"))
        pruefe("Hinweis zur Automatik sichtbar", "automatisch" in await pg.inner_text("#wzBody"))
        await pg.fill("#f_alkohol", "3")
        await pg.locator("#f_alkohol").blur()
        await pg.wait_for_timeout(150)
        pruefe("Abweichungs-Hinweis nach manueller Änderung", "Von Hand geändert" in await pg.inner_text("#wzBody"))
        pruefe("Zurücksetzen-Knopf sichtbar", await pg.locator("#wzAlkoholZuruecksetzen").count() == 1)
        await pg.click("#wzAlkoholZuruecksetzen")
        await pg.wait_for_timeout(150)
        pruefe("Feld wieder auf berechneten Wert zurückgesetzt", (await pg.input_value("#f_alkohol")).replace(",", ".").startswith("4.8"))
        pruefe("Abweichungs-Hinweis verschwindet nach Zurücksetzen", "Von Hand geändert" not in await pg.inner_text("#wzBody"))
        await pg.fill("#f_biermenge", "18")
        await pg.wait_for_timeout(150)
        pruefe("Zucker-Empfehlung noch leer ohne Karbonisierungsziel", await pg.inner_text("#wzRecZucker") == "–")
        await pg.fill("#f_karbonisierung", "5.5")
        await pg.wait_for_timeout(150)
        pruefe("Zucker-Empfehlung reagiert auf Karbonisierung", "g" in await pg.inner_text("#wzRecZucker"))
        await pg.click("#wzZuckerUebernehmen")
        await pg.wait_for_timeout(150)
        pruefe("Übernommen ins Speise/Zucker-Feld", "Haushaltszucker" in await pg.input_value("#f_zucker"))
        await pg.fill("#f_flaschen", "40")
        await pg.fill("#f_abgefuellt", "2026-11-05")
        await pg.wait_for_timeout(700)
        await pg.click("#wzAbschliessen")
        await pg.wait_for_selector(".sud-blatt:not(.wz)", timeout=5000)
        pruefe("Nach Abschluss zurück auf der normalen Sud-Seite", await pg.locator(".wz").count() == 0)
        t = await pg.inner_text("body")
        pruefe("Kein 'Entwurf'/'Gärung läuft'-Badge mehr auf der Detailseite", "Gärung läuft" not in t and "Entwurf" not in t)

        await pg.screenshot(path=str(ROOT / "tests" / "screenshots" / "wizard_check.png"), full_page=True)
        await ctx.close()
        await br.close()

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try:
    asyncio.run(main())
finally:
    srv.terminate()
print("\n" + ("Alles grün." if not fehler else f"{len(fehler)} Fehler:\n- " + "\n- ".join(fehler)))
sys.exit(1 if fehler else 0)
