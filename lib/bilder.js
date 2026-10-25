/* Koldingbräu – Bilder: auswählen (auch Kamera), zuschneiden (rund / hochkant / frei), verkleinern, hochladen,
   anzeigen, gezeichnete Platzhalter (Kronkorken in Bierfarbe). Fotos (Etiketten) werden per CSS-Clip (.kb-zack)
   in Kronkorken-Form (gezackter Kreis) dargestellt.
   Speicherort: Supabase-Storage-Bucket „bilder“ (öffentlich lesbar). Zu jedem Bild „…/x.jpg“ gibt es „…/x_t.jpg“ (Vorschau).
   Beim Neuzeichnen im Browser gehen Metadaten wie der Aufnahmeort verloren – gewollt.
   Nutzung: window.Bilder; braucht window.KB (core.js) nur für Hochladen/Löschen. */
(function (global) {
"use strict";
const BUCKET = "bilder";
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* ---------- Adressen ---------- */
const kleinPfad = p => p ? p.replace(/\.jpg$/, "_t.jpg") : p;
function url(pfad, klein) {
  if (!pfad) return null;
  const basis = (global.KB && KB.CONFIG && KB.CONFIG.url) || "";
  return `${basis}/storage/v1/object/public/${BUCKET}/${encodeURI(klein ? kleinPfad(pfad) : pfad)}`;
}

/* ---------- Bierfarbe ---------- */
// typische Farbe je Bierstil (EBC), wenn nichts Genaueres bekannt ist
const STIL_EBC = [[/stout|porter|schwarz|imperial/i, 90], [/dunkel|bock|brown|braun/i, 45], [/rot|red|amber|alt|märzen|maerzen|vienna|wiener/i, 24],
  [/ipa|pale|ale|export|lager/i, 14], [/weizen|hefe|wit/i, 9], [/kölsch|koelsch|helles|pils|alkoholfrei/i, 6]];
const stilEbc = stil => { for (const [re, e] of STIL_EBC) if (re.test(stil || "")) return e; return 12; };
// EBC → sRGB (Näherung über die SRM-Farbtabelle)
const SRM = [[1,"#FFE699"],[2,"#FFD878"],[3,"#FFCA5A"],[4,"#FFBF42"],[5,"#FBB123"],[6,"#F8A600"],[7,"#F39C00"],[8,"#EA8F00"],[9,"#E58500"],[10,"#DE7C00"],
  [12,"#CF6900"],[14,"#C35900"],[16,"#B54C00"],[18,"#A63E00"],[20,"#9B3200"],[24,"#8D2900"],[28,"#7E1F00"],[33,"#6A1300"],[40,"#4A0A00"],[50,"#2E0600"]];
function ebcFarbe(ebc) {
  const srm = (ebc ?? 12) / 1.97;
  let f = SRM[SRM.length - 1][1];
  for (const [s, c] of SRM) if (srm <= s) { f = c; break; }
  return f;
}
const kuerzel = n => String(n || "?").replace(/\(.*?\)/g, "").trim().split(/[\s\-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
const hell = hex => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150; };

/* ---------- Kronkorken-Zacken: gemeinsame Geometrie für das gezeichnete Platzhalter-SVG
   und den CSS-Clip-Path, mit dem Fotos (Etiketten) in Kronkorken-Form gezeigt werden. ---------- */
const ZACKEN = 21, RA = 48, RI = 43; // Außen-/Innenradius auf einem 100×100-Raster
function zackenPunkte(skala) {
  let d = "";
  for (let i = 0; i < ZACKEN * 2; i++) {
    const r = (i % 2 ? RI : RA) * skala, w = Math.PI * i / ZACKEN;
    d += (i ? "L" : "M") + (skala * 50 + r * Math.cos(w)).toFixed(skala === 1 ? 2 : 5) + " " + (skala * 50 + r * Math.sin(w)).toFixed(skala === 1 ? 2 : 5);
  }
  return d + "Z";
}
// Clip-Path (0…1, objectBoundingBox) einmalig ins Dokument einfügen, damit <img>s per CSS in Kronkorken-Form zugeschnitten werden können (Klasse .kb-zack)
let clipEingefuegt = false;
function clipEinfuegen() {
  if (clipEingefuegt || typeof document === "undefined") return;
  clipEingefuegt = true;
  const einfuegen = () => {
    if (document.getElementById("kb-zack-clip")) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.style.cssText = "position:absolute;overflow:hidden";
    svg.innerHTML = `<defs><clipPath id="kb-zack-clip" clipPathUnits="objectBoundingBox"><path d="${zackenPunkte(1 / 100)}"/></clipPath></defs>`;
    document.body.appendChild(svg);
  };
  if (document.body) einfuegen(); else document.addEventListener("DOMContentLoaded", einfuegen);
}
clipEinfuegen();

/* ---------- Platzhalter (SVG): gezeichneter Kronkorken in Bier- bzw. Kronkorken-Farbe ---------- */
function platzhalter(bier) {
  const farbe = bier?.farbe || ebcFarbe(bier?.ebc ?? stilEbc(bier?.stil));
  const text = esc(kuerzel(bier?.name)), schrift = hell(farbe) ? "#3a2a10" : "#fff4dc";
  return `<svg class="ph ph-kronkorken" viewBox="0 0 100 100" role="img" aria-label="${esc(bier?.name || "Bier")}">
    <path d="${zackenPunkte(1)}" fill="${farbe}" stroke="rgba(0,0,0,.3)" stroke-width="1.5"/>
    <circle cx="50" cy="50" r="35" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/>
    <text x="50" y="58" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="24" fill="${schrift}">${text}</text></svg>`;
}
/* Platzhalter-Titelbild für eine Verkostung ohne eigenes Foto: drei Flaschen mit Fragezeichen –
   gedacht für blinde Verkostungen, bei denen bewusst kein (verratendes) Foto hochgeladen wird. */
function titelPlatzhalter() {
  const flasche = x => `<g transform="translate(${x},4)">
    <rect x="15" y="0" width="10" height="12" rx="2" fill="var(--line)"/>
    <path d="M8 12 h24 a7 7 0 0 1 7 7 v55 a9 9 0 0 1 -9 9 H10 a9 9 0 0 1 -9 -9 V19 a7 7 0 0 1 7 -7 Z" fill="var(--surface)" stroke="var(--line)" stroke-width="2"/>
    <text x="20" y="56" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="30" fill="var(--amber)">?</text>
  </g>`;
  return `<svg class="ph-titel" viewBox="0 0 150 90" role="img" aria-label="Welche Biere es gibt, bleibt bis zum Schluss geheim">
    ${flasche(8)}${flasche(54)}${flasche(100)}</svg>`;
}
/* Bild eines Biers: hochgeladenes Kronkorken- oder (ersatzweise) Flaschenbild in Kronkorken-Form, sonst gezeichneter Platzhalter. groesse: "klein" | "gross" */
function bier(b, groesse = "klein") {
  const k = groesse === "klein";
  const p = b?.bild_kronkorken || b?.bild_flasche;
  if (p) return `<img class="bb bb-kronkorken bb-${groesse} kb-zack" src="${esc(url(p, k))}" alt="${esc(b?.name || "Bier")}" loading="lazy">`;
  return `<span class="bb bb-kronkorken bb-${groesse}">${platzhalter(b)}</span>`;
}
/* Beide hochgeladenen Fotos eines Biers (Kronkorken + Flasche), größer, für Detailansichten; leer, wenn keins hochgeladen ist.
   bierFotosVerdrahten() danach aufrufen, damit ein Antippen die Großansicht öffnet. */
function bierFotos(b) {
  const kk = b?.bild_kronkorken, fl = b?.bild_flasche;
  if (!kk && !fl) return "";
  const stueck = (p, kappe) => `<button type="button" class="bb-foto-zeig" data-p="${esc(p)}"><img class="bb-foto${kappe ? " kb-zack" : ""}" src="${esc(url(p, true))}" alt="${kappe ? "Kronkorken" : "Flasche"}" loading="lazy"></button>`;
  return `<div class="bb-fotos">${kk ? stueck(kk, true) : ""}${fl ? stueck(fl, false) : ""}</div>`;
}
function bierFotosVerdrahten(wurzel) {
  wurzel.querySelectorAll(".bb-foto-zeig").forEach(btn => btn.onclick = () => zeigen(btn.dataset.p));
}

/* ---------- Datei → Bild ---------- */
function ladeBild(datei) {
  return new Promise((ok, fehler) => {
    if (!datei || !/^image\//.test(datei.type || "image/")) { fehler(new Error("Bitte eine Bilddatei wählen.")); return; }
    const img = new Image(), u = URL.createObjectURL(datei);
    img.onload = () => { URL.revokeObjectURL(u); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(u); fehler(new Error("Das Bild kann der Browser nicht lesen (z. B. HEIC). Bitte als JPEG speichern oder ein Foto direkt aufnehmen.")); };
    img.src = u;
  });
}
const zuBlob = (cv, q = 0.84) => new Promise((ok, f) => cv.toBlob(b => b ? ok(b) : f(new Error("Bild konnte nicht erzeugt werden.")), "image/jpeg", q));
/* Ausschnitt (sx, sy, sw, sh) des Bildes in w×h zeichnen */
function zeichne(img, sx, sy, sw, sh, w, h) {
  const cv = document.createElement("canvas"); cv.width = Math.round(w); cv.height = Math.round(h);
  const c = cv.getContext("2d"); c.fillStyle = "#fff"; c.fillRect(0, 0, cv.width, cv.height);
  c.imageSmoothingQuality = "high"; c.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height); return cv;
}
/* Freies Bild: lange Kante max. 1600 px; Vorschau quadratisch 360 px (Mitte) */
async function verkleinern(img, max = 1600) {
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const gross = await zuBlob(zeichne(img, 0, 0, img.naturalWidth, img.naturalHeight, img.naturalWidth * s, img.naturalHeight * s), 0.82);
  const m = Math.min(img.naturalWidth, img.naturalHeight);
  const klein = await zuBlob(zeichne(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 360, 360), 0.78);
  return { gross, klein };
}

/* ---------- Auswahl- und Zuschneide-Dialog ----------
   form: "rund" (Kronkorken/Etikett), "hoch" (Flasche, 3:4), "frei" (Titelbild, Galerie: nur verkleinern)
   Ergebnis: Promise<{gross: Blob, klein: Blob} | null> */
const FORMEN = { rund: { v: 1, gross: [600, 600], klein: [160, 160] }, hoch: { v: 3 / 4, gross: [600, 800], klein: [150, 200] } };
function waehlen(opts = {}) {
  const form = opts.form || "frei";
  return new Promise(resolve => {
    const box = document.createElement("div");
    box.className = "bilddialog"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    box.innerHTML = `<div class="bd-inner">
      <div class="bd-kopf"><b>${esc(opts.titel || "Bild wählen")}</b><button type="button" class="btn ghost schliessen" data-a="zu" aria-label="Schließen">✕</button></div>
      <div class="bd-start">
        <label class="btn primary">Foto aufnehmen<input type="file" accept="image/*" capture="environment" hidden></label>
        <label class="btn">Datei wählen<input type="file" accept="image/*" hidden></label>
        <p class="hint">${form === "rund" ? "Danach den Kreis auf den Kronkorken bzw. das Etikett legen." : form === "hoch" ? "Danach die Flasche in den Rahmen schieben." : "Das Foto wird verkleinert; Standortdaten werden entfernt."}</p>
      </div>
      <div class="bd-crop" hidden><div class="bd-stage"><canvas></canvas><div class="bd-maske ${form}"></div></div>
        <label class="bd-zoom">Zoom<input type="range" min="1" max="4" step="0.01" value="1"></label>
        <p class="hint">Bild mit Finger oder Maus verschieben.</p></div>
      <p class="err" data-a="err"></p>
      <div class="bd-fuss"><button type="button" class="btn" data-a="zu">Abbrechen</button><button type="button" class="btn primary" data-a="ok" hidden>Übernehmen</button></div>
    </div>`;
    document.body.appendChild(box);
    const $ = s => box.querySelector(s);
    let img = null, zoom = 1, cx = 0, cy = 0, fertig = false;
    const ende = erg => { if (fertig) return; fertig = true; box.remove(); document.removeEventListener("keydown", taste); resolve(erg); };
    const taste = e => { if (e.key === "Escape") ende(null); };
    document.addEventListener("keydown", taste);
    box.querySelectorAll('[data-a="zu"]').forEach(b => b.onclick = () => ende(null));
    const fehler = t => { $('[data-a="err"]').textContent = t; };

    // Zuschneiden: Bühne zeigt das Bild; Rahmen (Maske) liegt fest in der Mitte
    const cv = $(".bd-stage canvas"), ctx = cv.getContext("2d");
    const F = FORMEN[form];
    const rahmen = () => { const W = cv.width, H = cv.height, rh = H * 0.86, rw = Math.min(W * 0.86, rh * F.v); return { w: rw, h: rw / F.v, x: (W - rw) / 2, y: (H - rw / F.v) / 2 }; };
    const basis = () => { const r = rahmen(); return Math.max(r.w / img.naturalWidth, r.h / img.naturalHeight); };   // Bild füllt den Rahmen
    function begrenze() {
      const r = rahmen(), s = basis() * zoom, w = img.naturalWidth * s, h = img.naturalHeight * s;
      cx = Math.min(Math.max(cx, r.x + r.w - w / 2 - cv.width / 2), r.x - cv.width / 2 + w / 2);
      cy = Math.min(Math.max(cy, r.y + r.h - h / 2 - cv.height / 2), r.y - cv.height / 2 + h / 2);
    }
    function malen() {
      begrenze();
      const s = basis() * zoom, w = img.naturalWidth * s, h = img.naturalHeight * s;
      ctx.fillStyle = "#222"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, cv.width / 2 + cx - w / 2, cv.height / 2 + cy - h / 2, w, h);
    }
    async function ausschnitt() {
      const r = rahmen(), s = basis() * zoom;
      const ix = (cv.width / 2 + cx - img.naturalWidth * s / 2), iy = (cv.height / 2 + cy - img.naturalHeight * s / 2);
      const sx = (r.x - ix) / s, sy = (r.y - iy) / s, sw = r.w / s, sh = r.h / s;
      return { gross: await zuBlob(zeichne(img, sx, sy, sw, sh, ...F.gross), 0.85), klein: await zuBlob(zeichne(img, sx, sy, sw, sh, ...F.klein), 0.8) };
    }
    let zieh = null;
    cv.addEventListener("pointerdown", e => { zieh = { x: e.clientX, y: e.clientY, cx, cy }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", e => { if (!zieh) return; const k = cv.width / cv.getBoundingClientRect().width; cx = zieh.cx + (e.clientX - zieh.x) * k; cy = zieh.cy + (e.clientY - zieh.y) * k; malen(); });
    cv.addEventListener("pointerup", () => { zieh = null; });
    cv.addEventListener("wheel", e => { e.preventDefault(); zoom = Math.min(4, Math.max(1, zoom * (e.deltaY < 0 ? 1.08 : 0.93))); $(".bd-zoom input").value = zoom; malen(); }, { passive: false });
    $(".bd-zoom input").oninput = e => { zoom = +e.target.value; malen(); };

    box.querySelectorAll('input[type=file]').forEach(inp => inp.onchange = async () => {
      const datei = inp.files[0]; inp.value = ""; if (!datei) return;
      fehler("");
      try { img = await ladeBild(datei); } catch (e) { fehler(e.message); return; }
      if (form === "frei") {
        $('[data-a="ok"]').hidden = false; $('[data-a="ok"]').textContent = "Wird vorbereitet …"; $('[data-a="ok"]').disabled = true;
        try { ende(await verkleinern(img)); } catch (e) { fehler(e.message); }
        return;
      }
      $(".bd-start").hidden = true; $(".bd-crop").hidden = false; $('[data-a="ok"]').hidden = false;
      cv.width = 720; cv.height = 720; zoom = 1; cx = 0; cy = 0; malen();
    });
    $('[data-a="ok"]').onclick = async () => { if (!img) return; $('[data-a="ok"]').disabled = true; try { ende(await ausschnitt()); } catch (e) { fehler(e.message); $('[data-a="ok"]').disabled = false; } };
  });
}

/* ---------- Speicher ---------- */
async function hochladen(basis, blobs) {
  const sb = KB.sb, pfad = `${basis}-${Date.now().toString(36)}.jpg`;
  const opt = { contentType: "image/jpeg", cacheControl: "31536000", upsert: true };
  let r = await sb.storage.from(BUCKET).upload(pfad, blobs.gross, opt);
  if (r.error) throw r.error;
  r = await sb.storage.from(BUCKET).upload(kleinPfad(pfad), blobs.klein, opt);
  if (r.error) { await sb.storage.from(BUCKET).remove([pfad]); throw r.error; }
  return pfad;
}
async function loeschen(pfad) {
  if (!pfad) return;
  try { await KB.sb.storage.from(BUCKET).remove([pfad, kleinPfad(pfad)]); } catch (_) { /* Datei bleibt liegen – unschädlich */ }
}
/* Ein vorhandenes Bild (inkl. Vorschau) unter neuem Pfad duplizieren, z. B. um ein Sud-Etikett als Bier-Kronkorken zu übernehmen,
   ohne dass beide auf dieselbe Datei zeigen (sonst würde das Löschen des einen auch das andere zerstören). */
async function kopieren(von, basis) {
  if (!von) return null;
  const sb = KB.sb, pfad = `${basis}-${Date.now().toString(36)}.jpg`;
  let r = await sb.storage.from(BUCKET).copy(von, pfad);
  if (r.error) throw r.error;
  r = await sb.storage.from(BUCKET).copy(kleinPfad(von), kleinPfad(pfad));
  if (r.error) { await sb.storage.from(BUCKET).remove([pfad]); throw r.error; }
  return pfad;
}

/* ---------- Großansicht ---------- */
// Jeder Eintrag ist entweder ein Pfad (string) oder {pfad, bildunterschrift} – Großansicht zeigt die Bildunterschrift, falls vorhanden.
function zeigen(pfade, start = 0) {
  const liste = (Array.isArray(pfade) ? pfade : [pfade]).map(p => (p && typeof p === "object") ? p : { pfad: p });
  let i = start;
  const box = document.createElement("div");
  box.className = "lightbox"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
  const mal = () => { box.innerHTML = `<img src="${esc(url(liste[i].pfad))}" alt="Foto ${i + 1} von ${liste.length}">
    ${liste[i].bildunterschrift ? `<p class="lb-cap">${esc(liste[i].bildunterschrift)}</p>` : ""}
    ${liste.length > 1 ? `<button class="lb-pfeil l" aria-label="Vorheriges Foto">‹</button><button class="lb-pfeil r" aria-label="Nächstes Foto">›</button><span class="lb-zahl">${i + 1} / ${liste.length}</span>` : ""}
    <button class="lb-zu" aria-label="Schließen">✕</button>`;
    box.querySelector(".lb-zu").onclick = zu;
    const l = box.querySelector(".lb-pfeil.l"), r = box.querySelector(".lb-pfeil.r");
    if (l) { l.onclick = e => { e.stopPropagation(); i = (i + liste.length - 1) % liste.length; mal(); }; r.onclick = e => { e.stopPropagation(); i = (i + 1) % liste.length; mal(); }; } };
  const zu = () => { box.remove(); document.removeEventListener("keydown", taste); };
  const taste = e => { if (e.key === "Escape") zu(); if (e.key === "ArrowRight" && liste.length > 1) { i = (i + 1) % liste.length; mal(); } if (e.key === "ArrowLeft" && liste.length > 1) { i = (i + liste.length - 1) % liste.length; mal(); } };
  box.addEventListener("click", e => { if (e.target === box) zu(); });
  document.addEventListener("keydown", taste);
  mal(); document.body.appendChild(box);
}

/* ---------- Bildfeld für Formulare ----------
   feldHtml(id, pfad, {art, bier, beschriftung}) → HTML; feldVerdrahten(id, {form, basis, titel, art, bier}) → { wert(): pfad|null }
   Das Bild wird sofort hochgeladen; gespeichert wird der Pfad mit dem Formular. */
function vorschau(pfad, art, b) {
  if (pfad) return `<img src="${esc(url(pfad, true))}" alt="" class="${art !== "frei" ? "kb-zack" : ""}">`;
  return art === "frei" ? `<span class="bf-leer">kein Bild</span>` : platzhalter(b);
}
function feldHtml(id, pfad, o = {}) {
  return `<div class="bildfeld bf-${o.art || "rund"}" id="${id}" data-pfad="${esc(pfad || "")}">
    <div class="bf-bild">${vorschau(pfad, o.art || "rund", o.bier)}</div>
    <div class="bf-text"><b>${esc(o.beschriftung || "Bild")}</b>
      <span><button type="button" class="linkbtn" data-bf="neu">${pfad ? "Ersetzen" : "Hinzufügen"}</button>${pfad ? ` · <button type="button" class="linkbtn" data-bf="weg">Entfernen</button>` : ""}</span>
      <small class="err"></small></div></div>`;
}
function feldVerdrahten(id, o = {}) {
  const el = document.getElementById(id); if (!el) return { wert: () => null };
  const neuZeichnen = () => {
    const p = el.dataset.pfad || null;
    el.querySelector(".bf-bild").innerHTML = vorschau(p, o.art || "rund", o.bier);
    el.querySelector(".bf-text span").innerHTML = `<button type="button" class="linkbtn" data-bf="neu">${p ? "Ersetzen" : "Hinzufügen"}</button>${p ? ` · <button type="button" class="linkbtn" data-bf="weg">Entfernen</button>` : ""}`;
    binden();
  };
  const binden = () => {
    el.querySelector('[data-bf="neu"]').onclick = async () => {
      const erg = await waehlen({ form: o.art || "rund", titel: o.titel });
      if (!erg) return;
      const info = el.querySelector(".err"); info.textContent = "Wird hochgeladen …";
      try { el.dataset.pfad = await hochladen(o.basis, erg); info.textContent = ""; neuZeichnen(); if (o.geaendert) o.geaendert(el.dataset.pfad); }
      catch (e) { info.textContent = "Hochladen fehlgeschlagen" + (e && e.message ? ": " + e.message : "."); }
    };
    const w = el.querySelector('[data-bf="weg"]'); if (w) w.onclick = () => { el.dataset.pfad = ""; neuZeichnen(); if (o.geaendert) o.geaendert(null); };
  };
  binden();
  return {
    wert: () => el.dataset.pfad || null,
    // zum programmatischen Setzen ohne Hochladen (z. B. Etikett eines Suds übernehmen)
    setzen: p => { el.dataset.pfad = p || ""; neuZeichnen(); if (o.geaendert) o.geaendert(el.dataset.pfad || null); },
  };
}

/* Galerie: Vorschaubilder im Raster, Klick öffnet die Großansicht.
   pfade: Pfad (string) oder {pfad, bildunterschrift} je Eintrag.
   o.loeschbar / o.bearbeitbar: true oder i => bool – zeigt ✕ (löschen) bzw. ✎ (Bildunterschrift bearbeiten) je Bild.
   o.beschriftet: zeigt die Bildunterschrift (oder „ohne Bildunterschrift") unter jedem Bild.
   o.extra: zusätzliches HTML, das als letztes Raster-Element eingefügt wird (z. B. eine „Hinzufügen"-Kachel). */
function galerieHtml(pfade, o = {}) {
  const item = (p, i) => {
    const obj = (p && typeof p === "object") ? p : { pfad: p };
    const cap = obj.bildunterschrift || "";
    const bearb = o.bearbeitbar && (o.bearbeitbar === true || o.bearbeitbar(i));
    const weg = o.loeschbar && (o.loeschbar === true || o.loeschbar(i));
    return `<div class="g-item"><button type="button" class="g-zeig" data-i="${i}" aria-label="Foto ${i + 1} groß zeigen"><img src="${esc(url(obj.pfad, true))}" alt="" loading="lazy"></button>
      ${(bearb || weg) ? `<div class="g-actions">${bearb ? `<button type="button" class="g-bearb" data-bearb="${i}" aria-label="Bildunterschrift von Foto ${i + 1} bearbeiten">✎</button>` : ""}${weg ? `<button type="button" class="g-weg" data-weg="${i}" aria-label="Foto ${i + 1} löschen">✕</button>` : ""}</div>` : ""}
      ${o.beschriftet ? `<div class="g-cap${cap ? "" : " leer"}">${cap ? esc(cap) : "ohne Bildunterschrift"}</div>` : ""}</div>`;
  };
  return `<div class="galerie${o.beschriftet ? " mit-text" : ""}">${pfade.map(item).join("")}${o.extra || ""}</div>`;
}
function galerieVerdrahten(wurzel, pfade, onLoeschen, onBearbeiten) {
  wurzel.querySelectorAll(".g-zeig").forEach(b => b.onclick = () => zeigen(pfade, +b.dataset.i));
  if (onLoeschen) wurzel.querySelectorAll(".g-weg").forEach(b => b.onclick = () => onLoeschen(+b.dataset.weg));
  if (onBearbeiten) wurzel.querySelectorAll(".g-bearb").forEach(b => b.onclick = () => onBearbeiten(+b.dataset.bearb));
}

global.Bilder = { galerieHtml, galerieVerdrahten, url, kleinPfad, ebcFarbe, stilEbc, platzhalter, titelPlatzhalter, bier, bierFotos, bierFotosVerdrahten, waehlen, verkleinern, ladeBild, hochladen, kopieren, loeschen, zeigen, feldHtml, feldVerdrahten };
})(typeof window !== "undefined" ? window : globalThis);
