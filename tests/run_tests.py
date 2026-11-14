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

FOTO_B64 = __import__("base64").b64encode(FOTO_BYTES).decode("ascii")

async def foto_dragdrop(pg, selector, dateiname="gezogen.jpg"):
    """Simuliert das Ziehen von tests/data/foto.jpg (z. B. aus der Mac-Fotos-Mediathek) auf `selector`:
    dragenter (Hervorhebung prüfbar) → drop. Playwright kann kein echtes OS-Drag, daher per DataTransfer
    im Browser selbst gebaut."""
    await pg.evaluate("""([sel, b64, name]) => {
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const datei = new File([bytes], name, {type: "image/jpeg"});
        const dt = new DataTransfer(); dt.items.add(datei);
        const el = document.querySelector(sel);
        const feuern = (typ) => el.dispatchEvent(new DragEvent(typ, {bubbles: true, cancelable: true, dataTransfer: dt}));
        feuern("dragenter"); feuern("dragover");
    }""", [selector, FOTO_B64, dateiname])
    await pg.wait_for_timeout(100)
    hover = await pg.evaluate("sel => document.querySelector(sel).classList.contains('sg-dragover')", selector)
    await pg.evaluate("""([sel, b64, name]) => {
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const datei = new File([bytes], name, {type: "image/jpeg"});
        const dt = new DataTransfer(); dt.items.add(datei);
        document.querySelector(sel).dispatchEvent(new DragEvent("drop", {bubbles: true, cancelable: true, dataTransfer: dt}));
    }""", [selector, FOTO_B64, dateiname])
    return hover

async def wische(pg, selector, dx):
    """Simuliert eine Wischgeste mit dem Finger (touchstart→touchend) um dx Pixel auf `selector` –
    negativ = nach links (nächstes Foto), positiv = nach rechts (voriges Foto)."""
    await pg.evaluate("""([sel, dx]) => {
        const el = document.querySelector(sel), r = el.getBoundingClientRect();
        const y = r.top + r.height / 2, x1 = r.left + r.width / 2, x2 = x1 + dx;
        const touch = (typ, x) => el.dispatchEvent(new TouchEvent(typ, {bubbles: true, cancelable: true,
            touches: typ === "touchend" ? [] : [new Touch({identifier: 1, target: el, clientX: x, clientY: y})],
            changedTouches: [new Touch({identifier: 1, target: el, clientX: x, clientY: y})]}));
        touch("touchstart", x1); touch("touchend", x2);
    }""", [selector, dx])

async def bild_waehlen(pg, ausloeser, zuschneiden=False):
    """Öffnet den Bild-Dialog, wählt tests/data/foto.jpg und übernimmt den Ausschnitt. Seit 07.11.2026 schneidet
    jedes Bildfeld zu: rund/hoch in einem Schritt, frei in zwei (Ausschnitt, dann Vorschau-Quadrat) – bis der
    Dialog zu ist, wird einfach „Weiter“/„Übernehmen“ gedrückt. (zuschneiden bleibt aus Kompatibilität.)"""
    await pg.click(ausloeser); await pg.wait_for_selector(".bilddialog")
    await pg.set_input_files(".bilddialog input[type=file] >> nth=1", FOTO)
    for _ in range(3):
        if await pg.locator(".bilddialog").count() == 0: break
        await pg.wait_for_selector(".bilddialog [data-a=ok]:not([hidden]):not([disabled])", timeout=5000)
        await pg.click(".bilddialog [data-a=ok]"); await pg.wait_for_timeout(250)
    await pg.wait_for_selector(".bilddialog", state="detached", timeout=5000); await pg.wait_for_timeout(200)

def pruefe(name, bedingung):
    print(("  ok    " if bedingung else "  FEHLT ") + name)
    if not bedingung: fehler.append(name)

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        async def seite(rolle, url, name, aktion=None, w=1200, h=900):
            ctx = await br.new_context(viewport={"width": w, "height": h}, has_touch=True)
            await ctx.route("**/vendor/supabase.js", lambda r: r.fulfill(body=FAKE, content_type="text/javascript"))
            await ctx.route("**/fonts/*.woff2", lambda r: r.fulfill(status=204, body=""))
            await ctx.route("**/storage/v1/object/public/**", lambda r: r.fulfill(body=FOTO_BYTES, content_type="image/jpeg", headers={"Access-Control-Allow-Origin": "*"}))
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
            # Seit 10.11.2026 kein Podest: alle Biere in einer einheitlichen Rangliste, ohne Medaillen/Hervorhebung
            pruefe("Kein Podest mehr", await pg.locator(".podium, .stufe, .medaille").count() == 0)
            pruefe("Rangliste enthält alle sieben Biere ab Platz 1", await pg.locator(".rank.erg > li").count() == 7 and (await pg.inner_text(".rank.erg > li >> nth=0 >> .pl")).strip() == "1.")
            pruefe("Kein Platz ist hervorgehoben", await pg.locator(".rank.erg li.top").count() == 0)
            pruefe("Kein „% empfehlen“ mehr in der Rangliste", "empfehlen" not in await pg.inner_text(".rank.erg") and "% nochmal" not in await pg.inner_text(".rank.erg"))
            pruefe("Offene Verkostung zeigt keine Probennummer in der Rangliste", await pg.locator(".rank.erg .probe-nr").count() == 0)
            pruefe("Ohne Teilnahme keine Fotos vom Abend", "Fotos vom Abend" not in await pg.inner_text("main"))
            await pg.click(".rank.erg > li >> nth=0 >> summary"); await pg.wait_for_timeout(300)
        t = await seite("anon", "verkostung.html?e=v9", "vk_ergebnis", ergebnis); pruefe("Ergebnisseite mit Kommentar und Namen", "Geheimtipp" in t and "Mit Niels" in t)
        async def ergebnis_blind(pg):
            await pg.evaluate("localStorage.setItem('test_blind','1')"); await pg.reload(); await pg.wait_for_timeout(600)
            pruefe("Blind: Probennummer als Kreis am Kronkorken", await pg.locator(".rank.erg .probe-nr").count() == 7)
            pruefe("Blind: Platz 1 (Einbecker) war Probe 2", (await pg.inner_text(".rank.erg > li >> nth=0 >> .probe-nr")).strip() == "2")
        await seite("anon", "verkostung.html?e=v9", "vk_ergebnis_blind", ergebnis_blind, 390, 844)
        async def ergebnis_galerie(pg):
            # Teilnehmer (Schlüssel im Browser) sehen die Fotos vom Abend auch nach dem Abschluss
            await pg.evaluate("localStorage.setItem('kb_gast_pils9code', JSON.stringify({token:'00000000-0000-4000-8000-000000000009'}))"); await pg.reload(); await pg.wait_for_timeout(700)
            pruefe("Teilnehmer sieht die Fotos vom Abend auf der Ergebnisseite", await pg.locator("#gastGalerie .gg-raster button").count() == 2)
            pruefe("Fotograf steht dabei („von Niels“, eigenes „von dir“)", "von Niels" in await pg.inner_text("#gastGalerie") and "von dir" in await pg.inner_text("#gastGalerie"))
            pruefe("Schlüssel für diese Verkostung gemerkt", await pg.evaluate("localStorage.getItem('kb_gast_e_v9')") == "00000000-0000-4000-8000-000000000009")
            await pg.click("#gastGalerie [data-gg='0']"); await pg.wait_for_timeout(200)
            pruefe("Foto öffnet Vollbild mit Durchblättern", await pg.locator(".lightbox .lb-pfeil").count() == 2)
            await wische(pg, ".lightbox", -120); await pg.wait_for_timeout(150)
            pruefe("Wischen blättert zum nächsten Foto", "2 / 2" in await pg.inner_text(".lightbox .lb-zahl"))
            await pg.keyboard.press("Escape")
        await seite("anon", "verkostung.html?e=v9", "vk_ergebnis_galerie", ergebnis_galerie, 390, 844)
        async def ergebnis_meine(pg):
            await pg.evaluate("localStorage.setItem('kb_meine_v9', JSON.stringify({b2: 7})); localStorage.setItem('kb_meine_k_v9', JSON.stringify({b2: [3, 9]}))"); await pg.reload(); await pg.wait_for_timeout(600)
            pruefe("Ergebnis zeigt dem Gast seine eigene Note", "deine Note 7" in await pg.inner_text("main"))
            pruefe("Punktwolke: je Gast ein Punkt, Schnitt und eigene Wahl", await pg.locator("details:has-text('Einbecker') .k-gast:not(.du)").count() == 3
                   and await pg.locator("details:has-text('Einbecker') .k-gast.du").count() == 1 and await pg.locator("details:has-text('Einbecker') .k-schnitt").count() == 1)
            pruefe("Alte Regler Bittere/Süße nicht doppelt im Profil", "Bittere" not in await pg.inner_text("details:has-text('Einbecker') .erg-detail"))
            pruefe("Alle Biere auf einer Karte (nur Biere mit Werten)", await pg.locator(".karte.alle .k-bier").count() == 3 and "Einbecker" in await pg.inner_text(".alle-liste"))
        await seite("anon", "verkostung.html?e=v9", "vk_ergebnis_meine", ergebnis_meine)
        async def abschliessen(pg):
            await pg.click("#stEnde"); await pg.click(".frage [data-f=ja]"); await pg.wait_for_timeout(800)
            pruefe("Braumeister landet nach dem Abschließen direkt auf dem Ergebnis", "e=v1" in pg.url)
        await seite("bm", "verkostung.html?id=v1", "vk_abschliessen", abschliessen)
        async def ergebnis_bilder(pg):
            # Teilnehmer-Galerie ist seit 27.10.2026 nur für Braumeister/Admin sichtbar (privater Bucket)
            pruefe("Ergebnis zeigt Titelbild, aber keine Galerie für Besucher", await pg.locator("#titelbild").count() == 1 and await pg.locator(".galerie, .gg-raster").count() == 0)
            pruefe("Platzhalter für Biere ohne Bild", await pg.locator(".rank.erg .bb svg").count() >= 1)
            await pg.click("#titelbild"); await pg.wait_for_timeout(200)
            pruefe("Titelbild öffnet Großansicht", await pg.locator(".lightbox").count() == 1)
        await seite("anon", "verkostung.html?e=v9", "vk_ergebnis_bilder", ergebnis_bilder)
        await seite("anon", "verkostung.html?e=v9", "vk_ergebnis_handy", ergebnis, 390, 844)
        async def gast(pg):
            await pg.fill("#j_name", "Clara"); await pg.click("#joinBtn"); await pg.wait_for_timeout(400)
            await pg.click(".probe >> nth=2")
            # Seit 13.11.2026 vier Seiten: Riechen, Schmecken (Tags), Geschmacksbild (Kreis), Urteil (Note + Satz) – keine Regler
            pruefe("Bogen hat vier Seiten ohne Regler", await pg.locator(".bogen-seite").count() == 4 and await pg.locator("#bogenInhalt input[type=range]").count() == 0)
            await pg.click(".bogen-seite[data-i='0'] .chip[data-t='fruchtig']")
            await pg.click(".bogen-seite[data-i='0'] [data-glossar]"); await pg.wait_for_selector(".glossar")
            pruefe("Glossar erklärt die Begriffe", "Kaffee" in await pg.inner_text(".glossar"))
            await pg.keyboard.press("Escape"); await pg.wait_for_timeout(150)
            pruefe("Escape schließt nur das Glossar, nicht den Bogen", await pg.locator(".glossar").count() == 0 and await pg.locator("#bogenInhalt").count() == 1)
            await wische(pg, "#bogenInhalt", -200); await pg.wait_for_timeout(350)
            pruefe("Wischen blättert zur Seite „Schmecken“", "2 / 4" in await pg.inner_text(".fortschritt .zahl"))
            await pg.click(".bogen-seite[data-i='1'] .chip[data-t='hopfig']"); await pg.click("#bWeiter"); await pg.wait_for_timeout(350)
            # Geschmackskarte: Tippen oben rechts = bitter + süß; Wischen auf der Karte blättert nicht; Karte mittig
            box = await pg.locator("#karteFeld").bounding_box()
            vb = await pg.evaluate("(() => { const r = document.querySelector(`.bogen-seite[data-i='2'] fieldset`).getBoundingClientRect(); return {x: r.x, width: r.width}; })()")
            pruefe("Geschmackskarte steht waagerecht mittig", abs((box["x"] + box["width"]/2) - (vb["x"] + vb["width"]/2)) < 2)
            await pg.mouse.click(box["x"] + box["width"]*0.75, box["y"] + box["height"]*0.2)
            pruefe("Kreis beschreibt die Wahl in Worten", "bitter" in (await pg.inner_text("#kreisText")).lower())
            await pg.mouse.click(box["x"] + box["width"]*0.98, box["y"] + box["height"]*0.02)
            lage = await pg.evaluate("[document.querySelector('.kreis-blase').getBoundingClientRect().bottom, document.querySelector('.k-punkt').getBoundingClientRect().top]")
            pruefe("Blase steht auch ganz oben über dem Punkt (nicht unter dem Daumen)", lage[0] <= lage[1])
            pruefe("Kein Hinweistext und keine Links unter der Karte mehr", await pg.locator(".bogen-seite[data-i='2'] .hint, .kreis-links").count() == 0
                   and await pg.locator("#kreisWeg.ikon-knopf").count() == 1)
            pruefe("Ecke der Karte erreichbar (sehr bitter und sehr süß)", "sehr bitter und sehr süß" in (await pg.inner_text("#kreisText")).lower())
            await wische(pg, "#karteFeld", -200); await pg.wait_for_timeout(350)
            pruefe("Wischen auf der Karte blättert nicht", "3 / 4" in await pg.inner_text(".fortschritt .zahl"))
            await pg.click("#bWeiter"); await pg.wait_for_timeout(350)
            await wische(pg, "#bogenInhalt", -200); await pg.wait_for_timeout(350)
            pruefe("Wischen auf der letzten Seite speichert nicht", "4 / 4" in await pg.inner_text(".fortschritt .zahl") and await pg.evaluate("!window.__letzte"))
            await pg.click("#bWeiter")
            pruefe("Bogen verlangt eine Note", "Note" in await pg.inner_text("#bErr"))
            await pg.click(".scale button[data-n='7']")
            await pg.fill("#b_kom", "Schmeckt nach Sommer"); await pg.click("#bWeiter"); await pg.wait_for_timeout(400)
            letzte = await pg.evaluate("JSON.stringify(window.__letzte)")
            pruefe("Bewertung gesendet (Note, Tags, Kreis, Satz)", '"p_note":7' in letzte and '"bitter":' in letzte and '"p_geruch":["fruchtig","hopfig"]' in letzte and "Sommer" in letzte)
            pruefe("Nach dem Speichern: Weiter zum nächsten offenen Bier", "Weiter zu" in await pg.inner_text("#bNaechste"))
            await pg.click("#bFertig"); await pg.wait_for_timeout(400)
            pruefe("Gast sieht Foto-Knopf (0 von 9)", "0 von 9" in await pg.inner_text("#fotoBtn"))
            await pg.wait_for_timeout(300)
            pruefe("Gast sieht die Fotos vom Abend (mit Fotograf)", await pg.locator("#gastGalerie .gg-raster button").count() == 1 and "von Anna" in await pg.inner_text("#gastGalerie"))
            pruefe("Gast kann seinen persönlichen Zugangslink teilen", await pg.locator("#gastGalerie [data-zugang]").count() == 1)
            await pg.click("#fotoBtn"); await pg.wait_for_selector(".bilddialog")
            pruefe("Knopf heißt „Bild auswählen“", await pg.locator(".bilddialog label:has-text('Bild auswählen')").count() == 1)
            await pg.set_input_files(".bilddialog input[type=file] >> nth=1", FOTO)
            await pg.wait_for_selector(".bd-crop:not([hidden])")
            pruefe("Gast-Zuschnitt hat nur einen Schritt („Übernehmen“ statt „Weiter“)", (await pg.inner_text(".bilddialog [data-a=ok]")).strip() == "Übernehmen" and (await pg.inner_text(".bd-schritt")).strip() == "")
            await pg.click(".bilddialog [data-a=ok]"); await pg.wait_for_selector(".bilddialog", state="detached", timeout=5000); await pg.wait_for_timeout(600)
            pruefe("Gast-Foto geht an die Edge Function", "galerie-hochladen" in await pg.evaluate("JSON.stringify(window.__calls.filter(c=>c[0]==='fn').map(c=>c[1]))"))
            pruefe("Zähler steht auf 1 von 9", "1 von 9" in await pg.inner_text("#fotoBtn"))
            pruefe("Neues Foto erscheint sofort in der Galerie", await pg.locator("#gastGalerie .gg-raster button").count() == 2 and "von dir" in await pg.inner_text("#gastGalerie"))
            pruefe("Kein Live-Zwischenstand für Gäste, solange die Verkostung läuft", await pg.locator(".rank").count() == 0)
        t = await seite("anon", "verkostung.html?v=abc234defg", "vk_gast", gast, 390, 844); pruefe("Gast ist beigetreten", "Clara" in t)
        t = await seite("anon", "verkostung.html?v=falsch", "vk_falscher_code"); pruefe("Falscher Code wird gemeldet", "gibt es nicht" in t)
        async def verwalten(pg):
            pruefe("QR-Code wird gezeichnet", await pg.locator(".qr svg").count() > 0)
            pruefe("Beitritts-Code steht einzeln im Kasten „Mitmachen“", (await pg.inner_text("#vkCode")).strip() != "" and await pg.locator("#copyCode").count() == 1)
            await pg.click("#copyCode"); await pg.wait_for_timeout(200)
            pruefe("Hinweis-Meldung ist eine Leiste, keine Pille", await pg.evaluate("parseFloat(getComputedStyle(document.querySelector('.toast')).borderTopLeftRadius) < 20"))
            await pg.click(".rank li[data-id] >> nth=1"); await pg.wait_for_timeout(300)
            await pg.click("[data-ed] >> nth=0")
            await pg.click("#bWeiter"); await pg.click("#bWeiter"); await pg.click("#bWeiter")  # Riechen, Schmecken, Kreis überspringen
            await pg.click(".scale button[data-n='4']"); await pg.click("#bWeiter"); await pg.wait_for_timeout(500)
            pruefe("Admin ändert Bewertung", '"p_note":4' in await pg.evaluate("JSON.stringify(window.__admin)"))
            await pg.click("#nachtragen"); await pg.select_option("#nt_wer", "neu"); await pg.fill("#nt_name", "Manu")
            await pg.click("#bWeiter"); await pg.click("#bWeiter"); await pg.click("#bWeiter")
            await pg.click(".scale button[data-n='6']"); await pg.click("#bWeiter"); await pg.wait_for_timeout(500)
            pruefe("Admin trägt Bewertung nach", "vom Admin nachgetragen" in await pg.inner_text("#sheetBody"))
            await pg.click("#bAbbr") if await pg.locator("#bAbbr").count() else None
            await pg.goto(BASE + "verkostung.html?id=v1"); await pg.wait_for_timeout(600)
            pruefe("Bierliste zeigt Kronkorken-Foto", await pg.locator(".plist img.bb-kronkorken").count() == 1 and await pg.locator(".plist .bb svg").count() == 2)
            await bild_waehlen(pg, "#titelFeld [data-bf=neu]"); await pg.wait_for_timeout(300)
            upd = await pg.evaluate("JSON.stringify(window.__calls.filter(c=>c[0]==='verkostungen'&&c[1]==='update'))")
            pruefe("Titelbild hochgeladen und gespeichert", "verkostungen/v1/titel-" in upd)
            n0 = await pg.locator("#galerieBox .g-item").count()
            await pg.set_input_files("#galerieBox .gm-datei", [FOTO, FOTO]); await pg.wait_for_selector("#galerieBox .sg-tray")
            pruefe("Verkostungs-Galerie: mehrere Fotos auf einmal in der Ablage", await pg.locator("#galerieBox .sg-pend-row").count() == 2)
            await pg.fill('#galerieBox .sg-pend-row input[data-pend="0"]', "Anstoßen")
            await pg.click("#galerieBox [data-ab=hoch]"); await pg.wait_for_timeout(600)
            pruefe("Verkostungs-Galerie: beide hochgeladen", await pg.locator("#galerieBox .g-item").count() == n0 + 2)
            ins = await pg.evaluate("JSON.stringify(window.__calls.filter(c=>c[0]==='verkostung_bilder'&&c[1]==='insert'))")
            pruefe("Verkostungs-Galerie: Bildunterschrift gespeichert", "Anstoßen" in ins)
            pruefe("Verkostungs-Galerie: Upload in den privaten Bucket", any("verkostungen/v1/galerie/" in u for u in await pg.evaluate("window.__uploads||[]")))
            pruefe("Verkostungs-Galerie: Bearbeiten-Knopf je Foto", await pg.locator("#galerieBox .g-bearb").count() == n0 + 2)
            await pg.click(".galerie .g-weg >> nth=0"); await pg.click(".frage [data-f=ja]"); await pg.wait_for_timeout(400)
            pruefe("Galerie-Foto gelöscht (Datei und Vorschau)", "verkostungen/v1/galerie/a_t.jpg" in await pg.evaluate("JSON.stringify(window.__removed)"))
            await pg.click("#addBier"); await pg.wait_for_selector("#bFilter .search")
            n_alle = await pg.locator("#pickList .pick").count()
            await pg.click("#bFilter [data-h=eigen]"); await pg.wait_for_timeout(100)
            n_eigen = await pg.locator("#pickList .pick").count()
            pruefe("Bier hinzufügen: Filter „Selbst gebraut“ schränkt ein", n_alle > 0 and n_eigen < n_alle)
            await pg.click("#bFilter [data-h=eigen]"); await pg.fill("#bFilter .search", "zzzz"); await pg.wait_for_timeout(100)
            pruefe("Bier hinzufügen: Suche ohne Treffer zeigt Hinweis", await pg.locator("#pickList .pick").count() == 0 and "Kein Bier passt" in await pg.inner_text("#pickList"))
            await pg.fill("#bFilter .search", "")
            await pg.click("#neuesBier"); await pg.wait_for_selector("#bi_kk")
            await bild_waehlen(pg, "#bi_kk [data-bf=neu]", True)
            await pg.fill("#bi_name", "Testbier"); await pg.click("#biSave"); await pg.wait_for_timeout(500)
            ins = await pg.evaluate("JSON.stringify(window.__calls.filter(c=>c[0]==='biere'&&c[1]==='insert'))")
            pruefe("Neues Bier mit Kronkorken-Bild", "/kronkorken-" in ins)
        await seite("admin", "verkostung.html?id=v1", "vk_verwalten_admin", verwalten)
        async def bm(pg):
            await pg.click(".rank li[data-id] >> nth=1"); await pg.wait_for_timeout(300)
            pruefe("Braumeister ohne Admin sieht keine Korrektur-Knöpfe", await pg.locator("[data-ed], #nachtragen").count() == 0)
            pruefe("Braumeister sieht den Zwischenstand", await pg.locator(".rank li").count() >= 1)
            pruefe("Umsortieren gesperrt, solange die Verkostung läuft", await pg.locator("[data-up],[data-down]").count() == 0)
            pruefe("Platz und Probennummer nicht mehr direkt hintereinander", "1. 2." not in await pg.inner_text(".rank"))
        await seite("bm", "verkostung.html?id=v1", "vk_verwalten_braumeister", bm)
        async def einladung(pg):
            await pg.click("#vkEdit"); await pg.wait_for_timeout(300)
            await pg.fill("#v_uhrzeit", "19:30"); await pg.fill("#v_text", "Bringt Hunger mit.")
            await pg.click("#vSave"); await pg.wait_for_timeout(600)
            vorschau = await pg.inner_text(".einladung-vorschau")
            pruefe("Einladung zeigt Uhrzeit und Text", "19:30 Uhr" in vorschau and "Bringt Hunger mit." in vorschau)
            pruefe("Einladung enthält Ankündigungslink, nicht den Mitmach-Code", "?a=v1" in vorschau and "abc234defg" not in vorschau)
            await pg.evaluate("navigator.share = undefined; navigator.clipboard.writeText = t => { window.__kopiert = t; return Promise.resolve(); }")
            await pg.click("#einladungTeilen"); await pg.wait_for_timeout(200)
            pruefe("Teilen ohne Teilen-Menü kopiert die Nachricht", "Bringt Hunger mit." in (await pg.evaluate("window.__kopiert") or ""))
            pruefe("Mitmach-Box heißt jetzt „Mitmachen am Abend“", "Mitmachen am Abend" in await pg.inner_text(".qrbox"))
            await pg.goto(BASE + "verkostung.html?a=v1"); await pg.wait_for_timeout(600)
            t = await pg.inner_text("#vk")
            pruefe("Ankündigungsseite zeigt Text, Uhrzeit und Biere ohne Code", "Bringt Hunger mit." in t and "19:30 Uhr" in t and "Augustiner Hell" in t and "abc234defg" not in t)
            pruefe("Ankündigungsseite hat Code-Feld für den Abend", await pg.locator("#ank_c").count() == 1)
        await seite("bm", "verkostung.html?id=v1", "vk_einladung", einladung, 390, 844)
        await seite("bm", "verkostung.html?id=v1", "vk_verwalten_handy", None, 390, 844)

        print("Liga")
        t = await seite("anon", "liga.html", "liga"); pruefe("Liga zeigt Biere", "Augustiner Hell" in t)
        print("Bierkeller")
        async def keller_gast(pg):
            pruefe("Menüpunkt Bierkeller für Gäste versteckt", await pg.locator(".menu a[data-seite=bierkeller]").is_hidden())
        t = await seite("anon", "bierkeller.html", "keller_gast", keller_gast); pruefe("Bierkeller zeigt Gästen nur Hinweis", "nur für Braumeister" in t)
        async def keller_bm(pg):
            pruefe("Menüpunkt Bierkeller für Braumeister sichtbar", await pg.locator(".menu a[data-seite=bierkeller]").is_visible())
            pruefe("Bierkeller listet Biere", await pg.locator(".kz").count() >= 2)
            pruefe("Braumeister ohne Admin sieht kein Löschen", await pg.locator("[data-del]").count() == 0)
            await pg.click("#kFilter [data-nie]"); await pg.wait_for_timeout(100)
            pruefe("Filter „Noch nie verkostet“ zeigt nur unverkostete", all("noch nie verkostet" in x for x in await pg.locator(".kz small").all_inner_texts() if "verkostet" in x))
            await pg.click("#kFilter [data-nie]")
            await pg.click("#neuBier"); await pg.wait_for_selector("#bi_name")
            await pg.fill("#bi_name", "Kellerbier"); await pg.click("#biSave"); await pg.wait_for_timeout(500)
            ins = await pg.evaluate("JSON.stringify(window.__calls.filter(c=>c[0]==='biere'&&c[1]==='insert'))")
            pruefe("Bier im Bierkeller ohne Verkostung angelegt", "Kellerbier" in ins)
        await seite("bm", "bierkeller.html", "keller_bm", keller_bm)
        async def keller_admin(pg):
            pruefe("Admin sieht Löschen nur bei unverkosteten Bieren", await pg.locator("[data-del]").count() < await pg.locator(".kz").count())
        await seite("admin", "bierkeller.html", "keller_admin", keller_admin)
        async def liga_bilder(pg): pruefe("Liga zeigt Platzhalter-Kronkorken", await pg.locator(".rank .bb svg").count() >= 3)
        await seite("anon", "liga.html", "liga_bilder", liga_bilder)
        async def liga_detail(pg):
            pruefe("Bier-Detailseite zeigt eigenes Blatt", await pg.locator(".bier-blatt").count() == 1)
        t = await seite("anon", "liga.html?bier=00000000-0000-0000-0000-0000000000b3", "liga_detail", liga_detail); pruefe("Deep-Link öffnet Bier-Detailseite", "hazy" in t.lower() and "Runde 2026-04-01" in t)
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
            # Seit dem Braugang-Assistenten: Sud-Entwurf wird gleich gespeichert, dann öffnet der Assistent
            sud = await pg.evaluate("JSON.stringify(window.__calls.filter(c=>c[0]==='sude'&&c[1]==='insert'))")
            pruefe("Sud aus Rezept: Entwurf mit umgerechneter Schüttung, Assistent offen", '"gramm":2983' in sud and '"status":"entwurf"' in sud and await pg.locator(".wz-card, .wizard, [class*=wz]").count() > 0)
            await pg.screenshot(path=str(SHOTS / "rz_sud_editor.png"))
        await seite("bm", "rezepte.html", "rz_liste_bm", importieren)
        async def bearbeiten(pg):
            await pg.click("#rzEdit"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=str(SHOTS / "rz_editor.png"))
            await pg.click("#berechnen"); await pg.wait_for_timeout(100)
            pruefe("Kennwerte berechnen trägt Stammwürze ein", (await pg.input_value("#r_stammwuerze")) != "")
            await bild_waehlen(pg, "#rf_kk [data-bf=neu]")
            await bild_waehlen(pg, "#rf_fl [data-bf=neu]")
            await pg.click("#rzSave"); await pg.wait_for_timeout(700)
            pruefe("Rezept mit Kronkorken und Flasche gespeichert und gezeigt", await pg.locator(".sud-kk-fl img").count() == 2)
            await pg.click("#rzKlon"); await pg.wait_for_timeout(900)
            pruefe("Klon zeigt „Abgeleitet von“", "Abgeleitet von" in await pg.inner_text("#rz"))
        await seite("bm", "rezepte.html?id=r1", "rz_detail_bm", bearbeiten)
        await seite("anon", "rezepte.html?id=r1", "rz_detail_handy", None, 390, 844)
        async def neuer_sud(pg):
            await pg.click("#newBtn"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=str(SHOTS / "sud_neu_auswahl.png"))
            await pg.fill("#nr_menge", "40"); await pg.click("#ausRz button[type=submit]"); await pg.wait_for_timeout(300)
            sud = await pg.evaluate("JSON.stringify(window.__calls.filter(c=>c[0]==='sude'&&c[1]==='insert'))")
            pruefe("Neuer Sud aus Rezept, 40 l (Entwurf, Hopfen 20 g)", '"gramm":20' in sud and "auf 40 l" in sud)
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
        async def zuschnitt(pg):
            await pg.click("#editBtn"); await pg.wait_for_selector("#bf_foto")
            await pg.click("#bf_foto [data-bf=neu]"); await pg.wait_for_selector(".bilddialog")
            await pg.set_input_files(".bilddialog input[type=file] >> nth=1", FOTO)
            await pg.wait_for_selector(".bd-crop:not([hidden])")
            pruefe("Freier Zuschnitt zeigt Schnellknöpfe", await pg.locator(".bd-schnell button").count() == 5)
            cv = pg.locator(".bd-stage canvas"); bb = await cv.bounding_box()
            # rechte untere Ecke nach innen ziehen → Rahmen wird kleiner
            await pg.mouse.move(bb["x"] + bb["width"] - 2, bb["y"] + bb["height"] - 2); await pg.mouse.down()
            await pg.mouse.move(bb["x"] + bb["width"] * 0.6, bb["y"] + bb["height"] * 0.6, steps=5); await pg.mouse.up()
            await pg.click(".bd-schnell button:has-text('1:1')"); await pg.wait_for_timeout(100)
            await pg.click(".bilddialog [data-a=ok]"); await pg.wait_for_timeout(200)
            pruefe("Zweiter Schritt: Quadrat für die Vorschau", "Schritt 2 von 2" in await pg.inner_text(".bd-schritt"))
            await pg.click(".bilddialog [data-a=ok]"); await pg.wait_for_selector(".bilddialog", state="detached")
            await pg.wait_for_timeout(300)
            up = await pg.evaluate("JSON.stringify(window.__uploads||[])")
            pruefe("Großbild, Vorschau und unbeschnittenes Basisbild hochgeladen", "_t.jpg" in up and "_b.jpg" in up)
            aus = await pg.evaluate("JSON.stringify(window.__calls.filter(c=>c[0]==='bild_ausschnitte'))")
            pruefe("Ausschnitt gespeichert (Rahmen + Quadrat)", '"rahmen"' in aus and '"quadrat"' in aus)
            pruefe("Bildfeld bietet „Ausschnitt ändern“", await pg.locator("#bf_foto [data-bf=schnitt]").count() == 1)
            await pg.click("#bf_foto [data-bf=schnitt]"); await pg.wait_for_selector(".bd-crop:not([hidden])", timeout=5000)
            pruefe("„Ausschnitt ändern“ öffnet den Zuschnitt direkt, ohne Dateiauswahl", await pg.locator(".bd-start").is_hidden())
            await pg.click(".bilddialog [data-a=ok]"); await pg.click(".bilddialog [data-a=ok]"); await pg.wait_for_selector(".bilddialog", state="detached")
            await pg.wait_for_timeout(300)
            pruefe("Neuer Ausschnitt bekommt einen neuen Dateinamen", len(set(await pg.evaluate("(window.__uploads||[]).filter(p=>/foto-[^_]*\\.jpg$/.test(p))"))) >= 2)
            pruefe("Sud-Editor hat Kronkorken und Flasche statt Etikett", await pg.locator("#bf_kk").count() == 1 and await pg.locator("#bf_fl").count() == 1 and await pg.locator("#bf_etikett").count() == 0)
            await bild_waehlen(pg, "#bf_kk [data-bf=neu]")
            await pg.click("#saveBtn"); await pg.wait_for_timeout(600)
            pruefe("Kronkorken oben auf der Sudseite", await pg.locator(".sud-kk-fl img.kb-zack").count() == 1)
            biere = await pg.evaluate("JSON.stringify(window.__calls.filter(c=>c[0]==='biere'&&c[1]==='update'))")
            pruefe("Verknüpfte Biere bekommen dieselben Bilder", "bild_kronkorken" in biere)
        await seite("bm", "index.html?sud=s1", "sud_zuschnitt", zuschnitt, 390, 844)
        async def sud_galerie_gast(pg):
            pruefe("Gast sieht Anmelde-Hinweis statt Fotos", "an, um die Fotos" in await pg.inner_text("#sudGalerieSec"))
            pruefe("Gast sieht kein Foto", await pg.locator("#sudGalerie .g-item").count() == 0)
            pruefe("Gast sieht keine „Hinzufügen“-Kachel", await pg.locator("#sudGalerie .g-add").count() == 0)
            hover=await foto_dragdrop(pg, "#sudGalerie"); await pg.wait_for_timeout(200)
            pruefe("Gast: keine Hervorhebung beim Drüberziehen", hover is False)
            pruefe("Gast: Drag & Drop auf die Galerie lädt nichts hoch", await pg.locator(".sg-tray").count() == 0)
        await seite("anon", "index.html?sud=s1", "sud_galerie_gast", sud_galerie_gast)
        async def sud_galerie(pg):
            pruefe("Braumeister sieht bestehendes Foto mit Bildunterschrift", "Einmaischen" in await pg.inner_text("#sudGalerieSec"))
            pruefe("Foto ohne Aufnahmedatum zeigt Hochlade-Datum", await pg.inner_text("#sudGalerie .g-item .g-datum") == "01.03.26")
            await pg.click(".galerie .g-zeig >> nth=0"); await pg.wait_for_timeout(200)
            pruefe("Datum erscheint nicht in der Großansicht", await pg.locator(".lightbox .g-datum").count() == 0)
            await pg.keyboard.press("Escape"); await pg.wait_for_timeout(100)
            await pg.set_input_files(".gm-datei", [FOTO, FOTO])
            await pg.wait_for_selector(".sg-tray")
            pruefe("Beide ausgewählten Fotos in der Ablage", await pg.locator(".sg-pend-row").count() == 2)
            await pg.fill('.sg-pend-row input[data-pend="0"]', "Hopfengabe nach 45 Minuten")
            await pg.click('.sg-pend-row [data-zuschnitt="1"]'); await pg.wait_for_selector(".bilddialog .bd-crop:not([hidden])")
            pruefe("Zuschneiden in der Ablage öffnet direkt den Zuschnitt", await pg.locator(".bilddialog .bd-start").is_hidden())
            await pg.click(".bilddialog [data-schnell='2']"); await pg.click(".bilddialog [data-a=ok]"); await pg.click(".bilddialog [data-a=ok]")
            await pg.wait_for_selector(".bilddialog", state="detached")
            pruefe("Bildunterschrift bleibt nach dem Zuschneiden", await pg.input_value('.sg-pend-row input[data-pend="0"]') == "Hopfengabe nach 45 Minuten")
            pruefe("Ablage zeigt „Zuschnitt ändern“", "Zuschnitt ändern" in await pg.inner_text(".sg-tray"))
            vorher = await pg.evaluate("(window.__uploads||[]).length")
            await pg.click(".sg-tray [data-ab=hoch]"); await pg.wait_for_timeout(500)
            pruefe("Ablage nach Hochladen leer", await pg.locator(".sg-tray").count() == 0)
            neu = await pg.evaluate(f"(window.__uploads||[]).slice({vorher})")
            pruefe("Ganzes Foto: kein zusätzliches Basisbild, zugeschnittenes: mit Basisbild", len([p for p in neu if p.endswith("_b.jpg")]) == 1)
            aus = await pg.evaluate("JSON.stringify(window.__calls.filter(c=>c[0]==='bild_ausschnitte'&&c[1]==='insert'))")
            pruefe("Beide Galeriefotos merken sich ihren Ausschnitt", aus.count("basis_pfad") >= 2)
            pruefe("Drei Fotos in der Galerie", await pg.locator("#sudGalerie .g-item").count() == 3)
            pruefe("Neue Bildunterschrift wird gezeigt", "Hopfengabe nach 45 Minuten" in await pg.inner_text("#sudGalerie"))
            await pg.click('#sudGalerie .g-item:nth-child(1) .g-bearb')
            await pg.fill('#sudGalerie .g-item:nth-child(1) .g-edit-row input[type=text]', "Einmaischen um 7 Uhr")
            await pg.fill('#sudGalerie .g-item:nth-child(1) .g-edit-row input[type=date]', "2026-02-14")
            await pg.click('#sudGalerie .g-item:nth-child(1) [data-save]'); await pg.wait_for_timeout(300)
            pruefe("Bildunterschrift bearbeitet", "Einmaischen um 7 Uhr" in await pg.inner_text("#sudGalerie"))
            pruefe("Datum von Hand nachgetragen", await pg.inner_text('#sudGalerie .g-item:nth-child(1) .g-datum') == "14.02.26")
            await pg.click('#sudGalerie .g-item:nth-child(1) .g-bearb')
            await pg.fill('#sudGalerie .g-item:nth-child(1) .g-edit-row input[type=date]', "")
            await pg.click('#sudGalerie .g-item:nth-child(1) [data-save]'); await pg.wait_for_timeout(300)
            await pg.click('#sudGalerie .g-item:nth-child(2) .g-bearb')
            await pg.click('#sudGalerie .g-item:nth-child(2) [data-schnitt]'); await pg.wait_for_selector(".bilddialog .bd-crop:not([hidden])")
            await pg.click(".bilddialog [data-schnell='2']"); await pg.click(".bilddialog [data-a=ok]"); await pg.click(".bilddialog [data-a=ok]")
            await pg.wait_for_selector(".bilddialog", state="detached"); await pg.wait_for_timeout(400)
            upd = await pg.evaluate("JSON.stringify(window.__calls.filter(c=>c[0]==='sud_bilder'&&c[1]==='update'))")
            pruefe("Galerie: „Ausschnitt ändern“ speichert neuen Pfad", '"pfad"' in upd)
            pruefe("Leeres Datum fällt zurück auf Hochlade-Datum", await pg.inner_text('#sudGalerie .g-item:nth-child(1) .g-datum') == "01.03.26")
            await pg.click('#sudGalerie .g-item:nth-child(3) .g-weg'); await pg.wait_for_selector(".frage [data-f=ja]")
            await pg.click(".frage [data-f=ja]"); await pg.wait_for_timeout(300)
            pruefe("Foto gelöscht, zwei übrig", await pg.locator("#sudGalerie .g-item").count() == 2)
            hover=await foto_dragdrop(pg, "#sudGalerie")
            pruefe("Hervorhebung beim Drüberziehen", hover is True)
            await pg.wait_for_selector(".sg-tray")
            pruefe("Gezogenes Foto in der Ablage", await pg.locator(".sg-pend-row").count() == 1)
            await pg.click(".sg-tray [data-ab=hoch]"); await pg.wait_for_timeout(500)
            pruefe("Per Drag & Drop hochgeladen, drei Fotos", await pg.locator("#sudGalerie .g-item").count() == 3)
            await pg.click(".galerie .g-zeig >> nth=0"); await pg.wait_for_timeout(200)
            await wische(pg, ".lightbox", -80); await pg.wait_for_timeout(150)
            pruefe("Wisch nach links zeigt nächstes Foto", "2 / 3" in await pg.inner_text(".lightbox"))
            await wische(pg, ".lightbox", 80); await pg.wait_for_timeout(150)
            pruefe("Wisch nach rechts zeigt voriges Foto", "1 / 3" in await pg.inner_text(".lightbox"))
            await wische(pg, ".lightbox", -20); await pg.wait_for_timeout(150)
            pruefe("Zu kurzer Wisch wechselt das Foto nicht", "1 / 3" in await pg.inner_text(".lightbox"))
            await pg.keyboard.press("Escape")
        await seite("bm", "index.html?sud=s1", "sud_galerie", sud_galerie)
        async def sud_editor(pg):
            await pg.click("#editBtn"); await pg.wait_for_timeout(600)
            for k in ["wasserhaerte","milchsaeure_hauptguss","ph_vorher","refraktometer_anstellen","refraktometer_restextrakt","karbonisierung"]:
                pruefe(f"Editor hat Feld {k}", await pg.locator(f"#f_{k}").count() == 1)
            pruefe("Leerer Alt-Freitext „Hopfensorten“ ausgeblendet", await pg.locator("#f_hopfensorten").count() == 0)
            pruefe("Zwischenmessungen im Editor", await pg.locator("#btnEmNeu").count() == 1)
            await pg.click("#btnEmNeu"); await pg.fill("[data-em-bez='0']", "Tag 4"); await pg.fill("[data-em-plato='0']", "5.2")
            await pg.click("#btnNotizNeu"); await pg.fill("[data-nz-label='0']", "Testangabe"); await pg.fill("[data-nz-wert='0']", "42")
            pruefe("Speichern-Leiste fest am unteren Rand", await pg.evaluate("getComputedStyle(document.querySelector('.edit-fuss')).position") == "fixed")
            await pg.click("#saveBtn"); await pg.wait_for_timeout(600)
            pruefe("Eigene Angabe nach dem Speichern auf der Sudseite", "testangabe" in (await pg.inner_text("#list")).lower())
            pruefe("Keine Checkliste mehr", await pg.locator("#checklisteBtn").count() == 0)
        await seite("bm", "index.html?sud=s1", "sud_editor", sud_editor, 390, 844)
        await br.close()

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try: asyncio.run(main())
finally: srv.terminate()
print("\n" + ("Alles grün." if not fehler else f"{len(fehler)} Fehler:\n- " + "\n- ".join(fehler)))
sys.exit(1 if fehler else 0)
