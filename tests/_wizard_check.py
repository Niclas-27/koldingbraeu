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

import re

async def drucken(pg, datei, knopf="#wzDruck"):
    """Klickt „Drucken“ im Assistenten (window.print abgefangen) und erzeugt das PDF wie der Druckdialog (A4).
    Gibt (Anzahl Druckaufrufe, Seitenzahl, Text des Bogens) zurück."""
    await pg.evaluate("window.__druck = 0; window.print = () => { window.__druck++; }; 0")
    await pg.click(knopf)
    await pg.wait_for_timeout(150)
    aufrufe = await pg.evaluate("window.__druck")
    pdf = await pg.pdf(path=str(ROOT / "tests" / "screenshots" / datei), prefer_css_page_size=True, print_background=True)
    seiten = len(re.findall(rb"/Type\s*/Page[^s]", pdf))
    text = await pg.eval_on_selector("#brauProtokoll", "el => el.textContent")
    return aufrufe, seiten, " ".join(text.split())

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
        pruefe("Kopfzeile im Assistenten ausgeblendet", await pg.locator(".site-header").is_hidden())
        pruefe("Fußzeile im Assistenten ausgeblendet", await pg.locator(".foot").is_hidden())
        pruefe("Zähler zeigt 1 / 9", "1 / 9" in await pg.inner_text(".zahl"))
        pruefe("Erster Schritt aktiv (Rezept & Start)", "Rezept & Start" in await pg.inner_text("#wzStepTitel"))
        pruefe("Kopf zeigt klein den Braugang-Titel", await pg.locator(".wz-kopf .kicker").count() == 1)
        pruefe("Plan-Hinweis zum Rezept sichtbar", "Kolding Kölsch" in await pg.inner_text("#wzBody"))
        pruefe("Status Entwurf", "Entwurf" in await pg.inner_text("#wzBody"))
        pruefe("Kein großes Schritt-Menü mehr (nur die kleinen Punkte)", await pg.locator(".wz-steps").count() == 0)
        pruefe("Drucken-Knopf im Assistenten-Kopf", await pg.locator(".wz-kopf #wzDruck").is_visible())
        aufrufe, seiten, text = await drucken(pg, "brauprotokoll_leer.pdf")
        pruefe("Drucken öffnet den Druckdialog", aufrufe == 1)
        pruefe("Brauprotokoll passt auf einen A4-Bogen (2 Seiten)", seiten == 2)
        pruefe("Brauprotokoll nennt Rezept und Schüttung", "Kolding Kölsch" in text and "Schüttung" in text and "Abfüllung" in text)
        pruefe("Brauprotokoll ohne Karbonathärte mit Faustregel", "Faustregel Milchsäure" in text)
        pruefe("Erster Schritt hat ein Namensfeld, vorbefüllt mit dem Rezeptnamen", await pg.input_value("#f_stil") == "Kolding Kölsch")
        await pg.fill("#f_stil", "Weihnachtskölsch")
        await pg.wait_for_timeout(700)
        pruefe("Name ändern zieht die Kopfzeile sofort nach", (await pg.inner_text(".wz-kopf .kicker")).lower() == "weihnachtskölsch")
        upd = await pg.evaluate("window.__calls.filter(c => c[0] === 'sude' && c[1] === 'update').map(c => JSON.stringify(c[2]))")
        pruefe("Neuer Name wird gespeichert", any('"stil":"Weihnachtskölsch"' in u for u in upd))
        await pg.click('[data-wz-extra-add="uebersicht"]')
        await pg.wait_for_timeout(150)
        await pg.fill('[data-wz-extra-label="0"]', "Testfeld")
        await pg.fill('[data-wz-extra-wert="0"]', "42")
        await pg.wait_for_timeout(700)

        # Schritt 2: Wasser – Härte-Rechner
        await gehe_zu(pg, 1)
        pruefe("Schritttitel wechselt auf Wasser & Milchsäure", "Wasser" in await pg.inner_text("#wzStepTitel"))
        await pg.fill("#f_wasserhaerte", "14")
        await pg.fill("#f_hauptguss", "20")
        await pg.wait_for_timeout(150)
        empf = await pg.inner_text("#wzRecHg")
        pruefe("Härte-Rechner zeigt eine Empfehlung ungleich –", empf.strip() != "–")
        # 14 °dH KH auf Ziel 2 °dH, 20 l → (14-2) × 20 × 0,0347 ≈ 8,3 ml (alte Formel: 25,2 ml)
        pruefe("Milchsäure-Empfehlung rechnet mit KH und Ziel-KH (≈ 8,3 ml)", empf.strip() == "8,3 ml")
        await pg.fill("#f_ziel_kh", "0")
        await pg.wait_for_timeout(150)
        pruefe("Ziel-KH ändert die Empfehlung sofort (≈ 9,7 ml)", (await pg.inner_text("#wzRecHg")).strip() == "9,7 ml")
        await pg.wait_for_timeout(700)
        await gehe_zu(pg, 2)
        await gehe_zu(pg, 1)
        pruefe("Ziel-KH bleibt nach Weiter/Zurück erhalten (nicht wieder 2)", await pg.input_value("#f_ziel_kh") == "0")
        pruefe("Empfehlung nach Zurückblättern sofort mit gespeicherter Ziel-KH", (await pg.inner_text("#wzRecHg")).strip() == "9,7 ml")
        await pg.click("#wzUebernehmenHg")
        await pg.wait_for_timeout(150)
        hg_wert = await pg.input_value("#f_milchsaeure_hauptguss")
        pruefe("Übernehmen füllt das Milchsäure-Hauptguss-Feld sofort sichtbar (ohne Umweg über Zurück/Vor)", hg_wert.strip() != "")
        await pg.fill("#f_nachguss", "13")
        await pg.wait_for_timeout(150)
        await pg.click("#wzUebernehmenNg")
        await pg.wait_for_timeout(150)
        ng_wert = await pg.input_value("#f_milchsaeure_nachguss")
        pruefe("Übernehmen füllt das Milchsäure-Nachguss-Feld sofort sichtbar", ng_wert.strip() != "")
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
        pruefe("Hefemenge ist ein Zahlenfeld", await pg.get_attribute("#f_hefemenge", "type") == "number")
        pruefe("Ausschlagwürze steht jetzt bei Kühlen & Anstellen", await pg.locator("#f_ausschlag").count() == 1)
        await pg.fill("#f_hefemenge", "11.5")
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
        body = await pg.inner_text("#wzBody")
        pruefe("Abfüllung in drei Blöcken: Abfüllen → Karbonisieren → Ergebnis",
               body.index("Abfüllen") < body.index("Karbonisieren") < body.index("Ergebnis"))
        pruefe("Keine Ausschlagwürze mehr in der Abfüllung", await pg.locator("#f_ausschlag").count() == 0)
        pruefe("Sud abschließen sitzt in der Fußleiste", await pg.locator("#wzFuss #wzAbschliessen").count() == 1)
        pruefe("Karbonisierung kommt aus dem Rezept (5 g/l), Empfehlung wartet nur noch auf die Biermenge",
               await pg.input_value("#f_karbonisierung") == "5" and "Biermenge fehlt" in await pg.inner_text("#wzRecZucker"))
        await pg.fill("#f_karbonisierung", "")
        await pg.wait_for_timeout(150)
        pruefe("Zucker-Empfehlung leer ohne Karbonisierungsziel", "Karbonisierung fehlt" in await pg.inner_text("#wzRecZucker"))
        await pg.fill("#f_karbonisierung", "5.5")
        await pg.wait_for_timeout(150)
        pruefe("Ohne Biermenge Hinweis statt Gesamtmenge", "Biermenge fehlt" in await pg.inner_text("#wzRecZucker"))
        pruefe("Speise/Zucker sind drei Knöpfe statt Dropdown", await pg.locator("[data-speise-art]").count() == 3 and await pg.locator("select#f_speise_art").count() == 0)
        pruefe("Kein Freitextfeld Speise/Zucker bei neuem Sud", await pg.locator("#f_zucker").count() == 0)
        await pg.fill("#f_biermenge", "20")
        await pg.wait_for_timeout(150)
        pruefe("Gesamtmenge für 20 l Haushaltszucker ≈ 144 g", (await pg.inner_text("#wzRecZucker")).startswith("144 g"))
        pruefe("Restkohlensäure-Hinweis mit Standardwert", "1,7 g/l" in await pg.inner_text("#wzRestCo2"))
        await pg.fill("#f_gaertemperatur", "10")
        await pg.wait_for_timeout(150)
        pruefe("Kalte Gärung (10 °C) braucht weniger Zucker (≈ 120 statt 144 g)", (await pg.inner_text("#wzRecZucker")).startswith("120 g"))
        pruefe("Restkohlensäure-Hinweis nennt 10 °C", "bei 10 °C" in await pg.inner_text("#wzRestCo2"))
        await pg.fill("#f_gaertemperatur", "")
        await pg.wait_for_timeout(150)
        await pg.click("#wzZuckerUebernehmen")
        await pg.wait_for_timeout(200)
        pruefe("Übernehmen wählt Haushaltszucker und trägt 144 g ein",
               await pg.get_attribute('[data-speise-art="zucker"]', "aria-pressed") == "true" and await pg.input_value("#f_speise_menge") == "144")
        await pg.click('[data-speise-art="traubenzucker"]')
        await pg.wait_for_timeout(200)
        pruefe("Traubenzucker rechnet mehr (≈ 167 g)", (await pg.inner_text("#wzRecZucker")).startswith("167 g"))
        pruefe("Mengenfeld beschriftet mit Traubenzucker in g", "Traubenzucker in g" in await pg.inner_text("#wzBody"))
        await pg.click('[data-speise-art="speise"]')
        await pg.wait_for_timeout(200)
        pruefe("Bei Speise kein Rechner, Menge in Litern", await pg.locator("#wzRecZucker").count() == 0 and "Speise in Litern" in await pg.inner_text("#wzBody"))
        await pg.fill("#f_speise_menge", "2.5")
        await pg.fill("#f_flaschen", "40")
        await pg.fill("#f_abgefuellt", "2026-11-05")
        await pg.wait_for_timeout(700)
        await gehe_zu(pg, 3)  # Drucken geht auf jedem Schritt und druckt immer den ganzen Sud
        aufrufe, seiten, text = await drucken(pg, "brauprotokoll.pdf")
        pruefe("Brauprotokoll mit Werten bleibt bei 2 Seiten", seiten == 2)
        pruefe("Brauprotokoll zeigt Milchsäure-Empfehlung", "Empfehlung Milchsäure 80 %" in text)
        pruefe("Brauprotokoll zeigt Zwischenmessung und Werte", "Tag 4" in text and "8,2 °P" in text and "11,5" in text)
        pruefe("Brauprotokoll zeigt eigene Angabe", "Testfeld" in text)
        await gehe_zu(pg, 8)
        await pg.click("#wzAbschliessen")
        await pg.wait_for_selector(".sud-blatt:not(.wz)", timeout=5000)
        pruefe("Nach Abschluss zurück auf der normalen Sud-Seite", await pg.locator(".wz").count() == 0)
        pruefe("Kopfzeile nach Abschluss wieder sichtbar", await pg.locator(".site-header").is_visible())
        pruefe("Fußzeile nach Abschluss wieder sichtbar", await pg.locator(".foot").is_visible())
        html2 = await pg.content()
        pruefe("Eigene Angabe (Testfeld/42) erscheint auf der fertigen Sudseite", "Testfeld" in html2 and ">42<" in html2)
        t = await pg.inner_text("body")
        pruefe("Kein 'Entwurf'/'Gärung läuft'-Badge mehr auf der Detailseite", "Gärung läuft" not in t and "Entwurf" not in t)
        pruefe("Sudseite zeigt Speise mit Litern", "Speise, 2,5 l" in t)
        pruefe("Sudseite zeigt Hefemenge mit g", "11,5 g" in t)
        pruefe("Sudseite zeigt die Ziel-KH", "ziel-kh" in t.lower())
        list_html = await pg.eval_on_selector("#list", "el => el.innerHTML")
        pruefe("Abschnitt-Reihenfolge auf der Sudseite wie im Assistenten (Brauwasser vor Schüttung)", list_html.index("Brauwasser") < list_html.index("Schüttung"))

        # Sud-Seite: derselbe Bogen über „Drucken“ bei den Braumeister-Aktionen
        pruefe("Drucken-Knopf auf der Sud-Seite", await pg.locator(".sud-aktionen #druckBtn").is_visible())
        aufrufe, seiten, text = await drucken(pg, "brauprotokoll_sudseite.pdf", "#druckBtn")
        pruefe("Sud-Seite: Drucken öffnet den Druckdialog", aufrufe == 1)
        pruefe("Sud-Seite: Brauprotokoll auf 2 Seiten", seiten == 2)
        pruefe("Sud-Seite: Bogen mit Rezept, Werten und Zwischenmessung", "Kolding Kölsch" in text and "11,5" in text and "Tag 4" in text)
        pruefe("Sud-Seite: Druckmodus bleibt, bis die Seite wieder bedient wird (iPad: afterprint unzuverlässig)", "bp-druck" in await pg.evaluate("document.body.className"))
        await pg.mouse.click(5, 5)
        pruefe("Sud-Seite: Druckmodus endet beim nächsten Tippen", "bp-druck" not in await pg.evaluate("document.body.className"))

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
