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

FOTO = str(ROOT / "tests" / "data" / "foto.jpg"); FOTO_BYTES = Path(FOTO).read_bytes()

async def bild_waehlen(pg, ausloeser, zuschneiden=False):
    """Öffnet den Bild-Dialog, wählt tests/data/foto.jpg und übernimmt (bei rund/hoch nach dem Zuschneiden)."""
    await pg.click(ausloeser); await pg.wait_for_selector(".bilddialog")
    await pg.set_input_files(".bilddialog input[type=file] >> nth=1", FOTO)
    if zuschneiden:
        await pg.wait_for_selector(".bilddialog [data-a=ok]:not([hidden])"); await pg.click(".bilddialog [data-a=ok]")
    await pg.wait_for_selector(".bilddialog", state="detached", timeout=5000); await pg.wait_for_timeout(200)

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
            await ctx.route("**/storage/v1/object/public/**", lambda r: r.fulfill(body=FOTO_BYTES, content_type="image/jpeg"))
            pg = await ctx.new_page()
            pg.on("pageerror", lambda e: fehler.append(f"{name}: JS-Fehler {e}"))
            await pg.goto(BASE + "rezepte.html"); await pg.evaluate(f"localStorage.setItem('test_rolle','{rolle}')")
            await pg.goto(BASE + url); await pg.wait_for_timeout(600)
            if aktion: await aktion(pg)
            await pg.screenshot(path=str(SHOTS / f"{name}.png"), full_page=True)
            txt = await pg.inner_text("body"); await ctx.close(); return txt

        print("Sude")
        t = await seite("anon", "index.html", "sude_gast"); pruefe("Gast sieht öffentlichen Sud", "Kölsch" in t); pruefe("Gast sieht keinen internen Sud", "IPA" not in t)
        async def sud_liste(pg):
            pruefe("Sud-Liste zeigt Platzhalter-Flaschen", await pg.locator(".brew .sud-bild svg").count() == 2)
        t = await seite("bm", "index.html", "sude_braumeister", sud_liste); pruefe("Braumeister sieht „Neuer Sud“", "Neuer Sud" in t)

        print("Verkostungen")
        t = await seite("anon", "verkostung.html", "vk_uebersicht"); pruefe("Übersicht zeigt Karten mit Teilnehmern", "Frühjahrsrunde" in t and "mit Niels" in t)
        t = await seite("bm", "verkostung.html", "vk_uebersicht_bm"); pruefe("Braumeister sieht laufende Verkostung", "Herbstrunde" in t)
        async def ergebnis(pg):
            await pg.click(".rank.erg li >> nth=0 >> summary"); await pg.wait_for_timeout(200)
        t = await seite("anon", "verkostung.html?e=v9", "vk_ergebnis", ergebnis); pruefe("Ergebnisseite mit Kommentar und Namen", "Geheimtipp" in t and "Mit Niels" in t)
        async def ergebnis_bilder(pg):
            pruefe("Ergebnis zeigt Titelbild und Galerie", await pg.locator("#titelbild").count() == 1 and await pg.locator(".galerie .g-item").count() == 2)
            pruefe("Platzhalter für Biere ohne Bild", await pg.locator(".podium .bb svg").count() >= 1)
            await pg.click(".galerie .g-zeig >> nth=1"); await pg.wait_for_timeout(200)
            pruefe("Galerie öffnet Großansicht", "2 / 2" in await pg.inner_text(".lightbox"))
        await seite("anon", "verkostung.html?e=v9", "vk_ergebnis_bilder", ergebnis_bilder)
        await seite("anon", "verkostung.html?e=v9", "vk_ergebnis_handy", ergebnis, 390, 844)
        async def gast(pg):
            await pg.fill("#j_name", "Clara"); await pg.click("#joinBtn"); await pg.wait_for_timeout(400)
            await pg.click(".probe >> nth=2")
            for _ in range(5): await pg.click("#bWeiter")  # Aussehen…Fehlaromen überspringen, bis „Was fällt dir auf?“
            await pg.fill("#b_kom", "fruchtig"); await pg.click("#bWeiter")  # -> Nochmal trinken?
            await pg.click("#bWeiter")  # überspringen -> Benotung
            await pg.click("#bWeiter")
            pruefe("Bogen verlangt Gesamtnote", "Gesamtnote" in await pg.inner_text("#bErr"))
            await pg.click(".scale button[data-n='7']"); await pg.click("#bWeiter"); await pg.wait_for_timeout(400)
            pruefe("Bewertung gesendet", '"p_note":7' in await pg.evaluate("JSON.stringify(window.__letzte)"))
            pruefe("Gast sieht Galerie und Foto-Knopf (0 von 3)", await pg.locator(".galerie .g-item").count() == 1 and "0 von 3" in await pg.inner_text("#fotoBtn"))
            await bild_waehlen(pg, "#fotoBtn"); await pg.wait_for_timeout(500)
            pruefe("Gast-Foto geht an die Edge Function", await pg.evaluate("window.__invoke") == "galerie-hochladen")
            pruefe("Zähler steht auf 1 von 3", "1 von 3" in await pg.inner_text("#fotoBtn"))
        t = await seite("anon", "verkostung.html?v=abc234defg", "vk_gast", gast, 390, 844); pruefe("Gast ist beigetreten", "Clara" in t)
        t = await seite("anon", "verkostung.html?v=falsch", "vk_falscher_code"); pruefe("Falscher Code wird gemeldet", "gibt es nicht" in t)
        async def verwalten(pg):
            pruefe("QR-Code wird gezeichnet", await pg.locator(".qr svg").count() > 0)
            await pg.click(".rank li[data-id] >> nth=1"); await pg.wait_for_timeout(300)
            await pg.click("[data-ed] >> nth=0")
            for _ in range(7): await pg.click("#bWeiter")  # alle Schritte bis Benotung überspringen
            await pg.click(".scale button[data-n='4']"); await pg.click("#bWeiter"); await pg.wait_for_timeout(500)
            pruefe("Admin ändert Bewertung", '"p_note":4' in await pg.evaluate("JSON.stringify(window.__admin)"))
            await pg.click("#nachtragen"); await pg.select_option("#nt_wer", "neu"); await pg.fill("#nt_name", "Manu")
            for _ in range(7): await pg.click("#bWeiter")
            await pg.click(".scale button[data-n='6']"); await pg.click("#bWeiter"); await pg.wait_for_timeout(500)
            pruefe("Admin trägt Bewertung nach", "vom Admin nachgetragen" in await pg.inner_text("#sheetBody"))
            await pg.click("#bAbbr") if await pg.locator("#bAbbr").count() else None
            await pg.goto(BASE + "verkostung.html?id=v1"); await pg.wait_for_timeout(600)
            pruefe("Bierliste zeigt Kronkorken-Foto", await pg.locator(".plist img.bb-kronkorken").count() == 1 and await pg.locator(".plist .bb svg").count() == 2)
            await bild_waehlen(pg, "#titelFeld [data-bf=neu]"); await pg.wait_for_timeout(300)
            upd = await pg.evaluate("JSON.stringify(window.__calls.filter(c=>c[0]==='verkostungen'&&c[1]==='update'))")
            pruefe("Titelbild hochgeladen und gespeichert", "verkostungen/v1/titel-" in upd)
            await pg.click(".galerie .g-weg"); await pg.click("#bJa"); await pg.wait_for_timeout(400)
            pruefe("Galerie-Foto gelöscht (Datei und Vorschau)", "verkostungen/v1/galerie/a_t.jpg" in await pg.evaluate("JSON.stringify(window.__removed)"))
            await pg.click("#addBier"); await pg.click("#neuesBier"); await pg.wait_for_selector("#bi_kk")
            await bild_waehlen(pg, "#bi_kk [data-bf=neu]", True)
            await pg.fill("#bi_name", "Testbier"); await pg.click("#biSave"); await pg.wait_for_timeout(500)
            ins = await pg.evaluate("JSON.stringify(window.__calls.filter(c=>c[0]==='biere'&&c[1]==='insert'))")
            pruefe("Neues Bier mit Kronkorken-Bild", "/kronkorken-" in ins)
        await seite("admin", "verkostung.html?id=v1", "vk_verwalten_admin", verwalten)
        async def bm(pg):
            await pg.click(".rank li[data-id] >> nth=1"); await pg.wait_for_timeout(300)
            pruefe("Braumeister ohne Admin sieht keine Korrektur-Knöpfe", await pg.locator("[data-ed], #nachtragen").count() == 0)
        await seite("bm", "verkostung.html?id=v1", "vk_verwalten_braumeister", bm)
        await seite("bm", "verkostung.html?id=v1", "vk_verwalten_handy", None, 390, 844)

        print("Liga")
        t = await seite("anon", "liga.html", "liga"); pruefe("Liga zeigt Biere", "Augustiner Hell" in t)
        async def liga_bilder(pg): pruefe("Liga zeigt Platzhalter-Kronkorken", await pg.locator(".rank .bb svg").count() >= 3)
        await seite("anon", "liga.html", "liga_bilder", liga_bilder)
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
            await bild_waehlen(pg, "#rf_etikett [data-bf=neu]")
            await pg.click("#rzSave"); await pg.wait_for_timeout(700)
            pruefe("Rezept mit Etikett gespeichert und gezeigt", await pg.locator("#rzEtikett img").count() == 1)
            await pg.click("#rzKlon"); await pg.wait_for_timeout(900)
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
            pruefe("Deep-Link öffnet Sud als eigene Seite", await pg.locator(".sud-blatt").count() == 1)
            await pg.click("#rzBtn"); await pg.wait_for_timeout(900)
            pruefe("Rückweg: Sud → Rezept", "Entstanden aus" in await pg.inner_text("#rz"))
        await seite("bm", "index.html?sud=s1", "sud_rueckweg", rueckweg)
        async def sud_foto(pg):
            await pg.click("#editBtn"); await pg.wait_for_selector("#bf_foto")
            await bild_waehlen(pg, "#bf_foto [data-bf=neu]")
            await pg.click("[data-add=malz]")
            pruefe("Foto bleibt beim Neuzeichnen des Formulars", await pg.locator("#bf_foto img").count() == 1)
            await pg.click("#saveBtn"); await pg.wait_for_timeout(500)
            pruefe("Sud mit Foto gespeichert und oben gezeigt", await pg.locator("#sudFoto").count() == 1)
        await seite("bm", "index.html?sud=s1", "sud_foto", sud_foto)
        await br.close()

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try: asyncio.run(main())
finally: srv.terminate()
print("\n" + ("Alles grün." if not fehler else f"{len(fehler)} Fehler:\n- " + "\n- ".join(fehler)))
sys.exit(1 if fehler else 0)
