#!/usr/bin/env python3
"""Klicktests für alle Bereiche – ohne echte Datenbank.

Startet einen kleinen Webserver im Projektordner, liefert statt vendor/supabase.js die Attrappe
tests/fake-supabase.js aus und klickt die wichtigsten Abläufe durch (Desktop und Handy).
Bildschirmfotos landen in tests/screenshots/.

Aufruf:  python3 tests/run_tests.py        (braucht: pip install playwright && playwright install chromium)
Ergebnis: Exit-Code 0 = alles grün.
"""
import asyncio, os, subprocess, sys, time
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
FAKE = (ROOT / "tests" / "fake-supabase.js").read_text(encoding="utf-8")
SHOTS = ROOT / "tests" / "screenshots"; SHOTS.mkdir(exist_ok=True)
PORT = 8765; BASE = f"http://localhost:{PORT}/"
fehler = []

def pruefe(name, bedingung):
    print(("  ok    " if bedingung else "  FEHLT ") + name)
    if not bedingung: fehler.append(name)

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        async def seite(rolle, url, name, aktion=None, w=1200, h=900):
            ctx = await br.new_context(viewport={"width": w, "height": h})
            await ctx.route("**/vendor/supabase.js", lambda r: r.fulfill(body=FAKE, content_type="text/javascript"))
            await ctx.route("**/fonts/*.woff2", lambda r: r.fulfill(status=204, body=""))
            pg = await ctx.new_page()
            pg.on("pageerror", lambda e: fehler.append(f"{name}: JS-Fehler {e}"))
            await pg.goto(BASE + "rezepte.html"); await pg.evaluate(f"localStorage.setItem('test_rolle','{rolle}')")
            await pg.goto(BASE + url); await pg.wait_for_timeout(600)
            if aktion: await aktion(pg)
            await pg.screenshot(path=str(SHOTS / f"{name}.png"), full_page=True)
            txt = await pg.inner_text("body"); await ctx.close(); return txt

        print("Sude")
        t = await seite("anon", "index.html", "sude_gast"); pruefe("Gast sieht öffentlichen Sud", "Kölsch" in t); pruefe("Gast sieht keinen internen Sud", "IPA" not in t)
        t = await seite("bm", "index.html", "sude_braumeister"); pruefe("Braumeister sieht „Neuer Sud“", "Neuer Sud" in t)

        print("Verkostungen")
        t = await seite("anon", "verkostung.html", "vk_uebersicht"); pruefe("Übersicht zeigt Karten mit Teilnehmern", "Frühjahrsrunde" in t and "mit Niels" in t)
        t = await seite("bm", "verkostung.html", "vk_uebersicht_bm"); pruefe("Braumeister sieht laufende Verkostung", "Herbstrunde" in t)
        async def ergebnis(pg):
            await pg.click(".rank.erg li >> nth=0 >> summary"); await pg.wait_for_timeout(200)
        t = await seite("anon", "verkostung.html?e=v9", "vk_ergebnis", ergebnis); pruefe("Ergebnisseite mit Kommentar und Namen", "Geheimtipp" in t and "Mit Niels" in t)
        await seite("anon", "verkostung.html?e=v9", "vk_ergebnis_handy", ergebnis, 390, 844)
        async def gast(pg):
            await pg.fill("#j_name", "Clara"); await pg.click("#joinBtn"); await pg.wait_for_timeout(400)
            await pg.click(".probe >> nth=2"); await pg.click("#bSave")
            pruefe("Bogen verlangt Gesamtnote", "Gesamtnote" in await pg.inner_text("#bErr"))
            await pg.click(".scale button[data-n='7']"); await pg.fill("#b_kom", "fruchtig"); await pg.click("#bSave"); await pg.wait_for_timeout(400)
            pruefe("Bewertung gesendet", '"p_note":7' in await pg.evaluate("JSON.stringify(window.__letzte)"))
        t = await seite("anon", "verkostung.html?v=abc234defg", "vk_gast", gast, 390, 844); pruefe("Gast ist beigetreten", "Clara" in t)
        t = await seite("anon", "verkostung.html?v=falsch", "vk_falscher_code"); pruefe("Falscher Code wird gemeldet", "gibt es nicht" in t)
        async def verwalten(pg):
            pruefe("QR-Code wird gezeichnet", await pg.locator(".qr svg").count() > 0)
            await pg.click(".rank li[data-id] >> nth=1"); await pg.wait_for_timeout(300)
            await pg.click("[data-ed] >> nth=0"); await pg.click(".scale button[data-n='4']"); await pg.click("#bSave"); await pg.wait_for_timeout(500)
            pruefe("Admin ändert Bewertung", '"p_note":4' in await pg.evaluate("JSON.stringify(window.__admin)"))
            await pg.click("#nachtragen"); await pg.select_option("#nt_wer", "neu"); await pg.fill("#nt_name", "Manu")
            await pg.click(".scale button[data-n='6']"); await pg.click("#bSave"); await pg.wait_for_timeout(500)
            pruefe("Admin trägt Bewertung nach", "vom Admin nachgetragen" in await pg.inner_text("#sheetBody"))
        await seite("admin", "verkostung.html?id=v1", "vk_verwalten_admin", verwalten)
        async def bm(pg):
            await pg.click(".rank li[data-id] >> nth=1"); await pg.wait_for_timeout(300)
            pruefe("Braumeister ohne Admin sieht keine Korrektur-Knöpfe", await pg.locator("[data-ed], #nachtragen").count() == 0)
        await seite("bm", "verkostung.html?id=v1", "vk_verwalten_braumeister", bm)
        await seite("bm", "verkostung.html?id=v1", "vk_verwalten_handy", None, 390, 844)

        print("Liga")
        t = await seite("anon", "liga.html", "liga"); pruefe("Liga zeigt Biere", "Augustiner Hell" in t)
        t = await seite("anon", "liga.html#bier=00000000-0000-0000-0000-0000000000b3", "liga_sprung"); pruefe("Sprung klappt Bier mit Verkostungen auf", "Hazy" in t and "Runde 2026-04-01" in t)
        await seite("anon", "liga.html", "liga_handy", None, 390, 844)

        print("Rezepte")
        t = await seite("anon", "rezepte.html", "rz_gast"); pruefe("Gast sieht nur öffentliche Rezepte", "Kolding Kölsch" in t and "Geheimes Rezept" not in t)
        async def importieren(pg):
            await pg.set_input_files("#importDatei", str(ROOT / "tests" / "data" / "drives-me-hazy.json")); await pg.wait_for_timeout(300)
            pruefe("Import-Vorschau zeigt Rezept und Hinweis", "Tomahawk" in await pg.inner_text("#sheetBody") and "EBC" in await pg.inner_text("#sheetBody"))
            await pg.screenshot(path=str(SHOTS / "rz_import_vorschau.png"))
            await pg.fill("#imp_name", "Drives Me Hazy (Kesselbrauer)"); await pg.click("#impSave"); await pg.wait_for_selector(".rz-blatt", timeout=5000)
            pruefe("Nach dem Import öffnet die Rezeptseite", "brauwasser" in (await pg.inner_text("#rz")).lower() and "drives me hazy" in (await pg.inner_text("#rz")).lower())
            await pg.fill("#zielMenge", "20"); await pg.dispatch_event("#zielMenge", "change"); await pg.wait_for_timeout(200)
            pruefe("Umrechnen auf 20 l (Pilsner 3,53 kg)", "3,53 kg" in await pg.inner_text("#rz"))
            await pg.check("#mitAnlage"); await pg.wait_for_timeout(200)
            pruefe("Anlagenprofil (Pilsner 2,98 kg)", "2,98 kg" in await pg.inner_text("#rz"))
            await pg.fill("input[data-alpha='0']", "12"); await pg.dispatch_event("input[data-alpha='0']", "change"); await pg.wait_for_timeout(200)
            pruefe("Alpha-Ausgleich zeigt „statt 15,8 %“", "statt 15,8 %" in await pg.inner_text("#rz"))
            await pg.screenshot(path=str(SHOTS / "rz_detail_umgerechnet.png"), full_page=True)
            await pg.click("#sudAnlegen"); await pg.wait_for_timeout(900)
            pruefe("Sud aus Rezept: Editor vorausgefüllt", "Neuer Sud nach" in await pg.inner_text("#sheetTitle") and await pg.input_value("#malz_g_0") == "2983")
            await pg.screenshot(path=str(SHOTS / "rz_sud_editor.png"))
        await seite("bm", "rezepte.html", "rz_liste_bm", importieren)
        async def bearbeiten(pg):
            await pg.click("#rzEdit"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=str(SHOTS / "rz_editor.png"))
            await pg.click("#berechnen"); await pg.wait_for_timeout(100)
            pruefe("Kennwerte berechnen trägt Stammwürze ein", (await pg.input_value("#r_stammwuerze")) != "")
            await pg.click("#rzAbbr"); await pg.click("#rzKlon"); await pg.wait_for_timeout(900)
            pruefe("Klon zeigt „Abgeleitet von“", "Abgeleitet von" in await pg.inner_text("#rz"))
        await seite("bm", "rezepte.html?id=r1", "rz_detail_bm", bearbeiten)
        await seite("anon", "rezepte.html?id=r1", "rz_detail_handy", None, 390, 844)
        async def neuer_sud(pg):
            await pg.click("#newBtn"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=str(SHOTS / "sud_neu_auswahl.png"))
            await pg.fill("#nr_menge", "40"); await pg.click("#ausRz button[type=submit]"); await pg.wait_for_timeout(300)
            pruefe("Neuer Sud aus Rezept, 40 l", "Neuer Sud nach" in await pg.inner_text("#sheetTitle") and await pg.input_value("#hop_g_0") == "20")
            await pg.click("#cancelEdit")
        await seite("bm", "index.html", "sud_neu", neuer_sud)
        async def rueckweg(pg):
            pruefe("Deep-Link öffnet Sud", not await pg.locator("#sheet").is_hidden())
            await pg.click("#rzBtn"); await pg.wait_for_timeout(900)
            pruefe("Rückweg: Sud → Rezept", "Entstanden aus" in await pg.inner_text("#rz"))
        await seite("bm", "index.html?sud=s1", "sud_rueckweg", rueckweg)
        await br.close()

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try: asyncio.run(main())
finally: srv.terminate()
print("\n" + ("Alles grün." if not fehler else f"{len(fehler)} Fehler:\n- " + "\n- ".join(fehler)))
sys.exit(1 if fehler else 0)
