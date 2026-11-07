/* Koldingbräu – Bilder: auswählen (auch Kamera), zuschneiden (rund / hochkant / frei), verkleinern, hochladen,
   anzeigen, gezeichnete Platzhalter (Kronkorken in Bierfarbe). Fotos (Etiketten) werden per CSS-Clip (.kb-zack)
   in Kronkorken-Form (gezackter Kreis) dargestellt.
   Speicherort: Supabase-Storage-Bucket „bilder“ (öffentlich lesbar). Zu jedem Bild „…/x.jpg“ gibt es „…/x_t.jpg“ (Vorschau).
   Beim Neuzeichnen im Browser gehen Metadaten wie der Aufnahmeort verloren – gewollt.
   Nutzung: window.Bilder; braucht window.KB (core.js) nur für Hochladen/Löschen. */
(function (global) {
"use strict";
const BUCKET = "bilder";
// Galerie-Fotos, die Teilnehmer bei einer Verkostung hochladen, liegen in einem eigenen PRIVATEN Bucket –
// nur Braumeister/Admin dürfen sie sehen (RLS). Es gibt dafür keine öffentliche URL; der Zugriff läuft
// ausschließlich über kurzlebige Signed URLs (galerieSignierteUrls). Titelbild und Bierbilder bleiben im
// öffentlichen Bucket "bilder" wie bisher.
const GALERIE_BUCKET = "verkostung-galerie";
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
/* HEIC/HEIF (z. B. aus der Mac-Fotos-Mediathek per Drag & Drop, je nach Einstellung „Originale beibehalten“)
   kann kein Browser in ein <img> laden – dafür einmalig und nur bei Bedarf heic2any von cdnjs nachladen und
   nach JPEG wandeln. Das Original-EXIF-Datum geht dabei verloren (anderes Dateiformat als JPEG/Exif); die
   Oberfläche zeigt für solche Fotos dann das Hochlade-Datum. */
const HEIC2ANY_URL = "https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js";
let heic2anyLadend = null;
function heic2anyLaden() {
  if (global.heic2any) return Promise.resolve(global.heic2any);
  if (!heic2anyLadend) heic2anyLadend = new Promise((ok, fehler) => {
    const s = document.createElement("script");
    s.src = HEIC2ANY_URL;
    s.onload = () => global.heic2any ? ok(global.heic2any) : fehler(new Error("HEIC-Umwandlung nicht verfügbar."));
    s.onerror = () => fehler(new Error("HEIC-Umwandlung konnte nicht geladen werden (keine Internetverbindung?)."));
    document.head.appendChild(s);
  });
  return heic2anyLadend;
}
const istHeic = datei => /^image\/hei[cf]/i.test(datei.type || "") || /\.hei[cf]$/i.test(datei.name || "");
async function alsJpegDatei(datei) {
  if (!istHeic(datei)) return datei;
  let heic2any;
  try { heic2any = await heic2anyLaden(); }
  catch (_) { throw new Error("HEIC-Fotos können gerade nicht umgewandelt werden. Bitte als JPEG speichern oder später erneut versuchen."); }
  let blob;
  try { blob = await heic2any({ blob: datei, toType: "image/jpeg", quality: 0.9 }); }
  catch (_) { throw new Error("Dieses HEIC-Foto konnte nicht umgewandelt werden."); }
  blob = Array.isArray(blob) ? blob[0] : blob;
  return new File([blob], (datei.name || "foto").replace(/\.hei[cf]$/i, "") + ".jpg", { type: "image/jpeg" });
}
function ladeBild(datei) {
  return new Promise((ok, fehler) => {
    if (!datei || !/^image\//.test(datei.type || "image/")) { fehler(new Error("Bitte eine Bilddatei wählen.")); return; }
    const img = new Image(), u = URL.createObjectURL(datei);
    img.onload = () => { URL.revokeObjectURL(u); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(u); fehler(new Error("Das Bild kann der Browser nicht lesen (z. B. HEIC). Bitte als JPEG speichern oder ein Foto direkt aufnehmen.")); };
    img.src = u;
  });
}
/* Aufnahmedatum aus den EXIF-Daten der Originaldatei lesen (DateTimeOriginal, sonst DateTime), bevor beim
   Verkleinern/Neuzeichnen die Metadaten verloren gehen. Liefert "YYYY-MM-DD" oder null (kein JPEG, keine
   Exif-Daten, oder kein Datum darin – z. B. Screenshots oder weiterverschickte Bilder). Nur die ersten
   128 KB werden gelesen, das reicht für den Exif-Block am Dateianfang. */
async function exifDatum(datei) {
  try {
    const buf = await datei.slice(0, 131072).arrayBuffer();
    const v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
    let off = 2;
    while (off + 4 <= v.byteLength) {
      if (v.getUint8(off) !== 0xFF) break;
      const marker = v.getUint16(off);
      if (marker === 0xFFDA) break; // Bilddaten beginnen – keine weiteren Marker-Segmente
      const segLen = v.getUint16(off + 2);
      if (marker === 0xFFE1) return exifAusAPP1(v, off + 4, segLen - 2);
      off += 2 + segLen;
    }
  } catch (_) { /* kaputte oder zu kurze Datei – kein Datum */ }
  return null;
}
function exifAusAPP1(v, start, laenge) {
  try {
    if (laenge < 14 || v.getUint32(start) !== 0x45786966 || v.getUint16(start + 4) !== 0) return null; // "Exif\0\0"
    const tiffStart = start + 6, little = v.getUint16(tiffStart) === 0x4949;
    const g16 = p => v.getUint16(p, little), g32 = p => v.getUint32(p, little);
    if (g16(tiffStart + 2) !== 0x002A) return null;
    const ifd = ifdStart => { const n = g16(ifdStart), e = {}; for (let i = 0; i < n; i++) { const p = ifdStart + 2 + i * 12; e[g16(p)] = p; } return e; };
    const str = (e, max) => { const anzahl = g32(e + 4), off2 = anzahl <= 4 ? e + 8 : tiffStart + g32(e + 8); let s = ""; for (let i = 0; i < Math.min(anzahl, max); i++) s += String.fromCharCode(v.getUint8(off2 + i)); return s; };
    const ifd0 = ifd(tiffStart + g32(tiffStart + 4));
    let datumStr = null;
    if (ifd0[0x8769]) { const sub = ifd(tiffStart + g32(ifd0[0x8769] + 8)); if (sub[0x9003]) datumStr = str(sub[0x9003], 19); } // Exif-IFD: DateTimeOriginal
    if (!datumStr && ifd0[0x0132]) datumStr = str(ifd0[0x0132], 19); // Fallback: DateTime in IFD0
    const m = datumStr && datumStr.match(/^(\d{4}):(\d{2}):(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  } catch (_) { return null; }
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

/* ---------- Auswahl- und Zuschneide-Dialog (seit 07.11.2026 einheitlich für alle Bildfelder) ----------
   form: "rund" (Kronkorken, 1:1 mit Zacken-Maske), "hoch" (Flasche, 3:4), "frei" (alles andere).
   Ein Rahmen liegt über dem ganzen Foto: innen ziehen = verschieben, an den Ecken ziehen = größer/kleiner.
   Bei "rund"/"hoch" bleibt das Seitenverhältnis fest; bei "frei" ist es frei, mit Schnellknöpfen (Ganzes Bild,
   1:1, 4:3, 16:9). "frei" hat einen zweiten Schritt: das Quadrat für das Vorschaubild in Listen/Rastern.
   opts.vorlage = {src, rahmen, quadrat, basisPfad, altbild} öffnet direkt den Zuschnitt eines vorhandenen
   Bildes („Ausschnitt ändern“) statt der Dateiauswahl.
   Ergebnis: Promise<{gross, klein, basis|null, basisPfad|null, ausschnitt:{rahmen, quadrat}} | null>
   – gross/klein werden aus dem geladenen Foto in voller Auflösung geschnitten; basis ist das ganze Foto
   unbeschnitten in max. 1600 px (Variante B, für späteres Neuzuschneiden); rahmen/quadrat als Anteile 0…1. */
const FORMEN = { rund: { v: 1, gross: [600, 600], klein: [160, 160] }, hoch: { v: 3 / 4, gross: [600, 800], klein: [150, 200] } };
const SCHNELL = [["Frei", "frei"], ["Ganzes Bild", "ganz"], ["1:1", 1], ["4:3", 4 / 3], ["16:9", 16 / 9]];
const BASIS_MAX = 1600;
const ladeUrl = src => new Promise((ok, fehler) => {
  const img = new Image(); img.crossOrigin = "anonymous";
  img.onload = () => ok(img); img.onerror = () => fehler(new Error("Das Bild konnte nicht geladen werden."));
  img.src = src;
});
function waehlen(opts = {}) {
  const form = opts.form || "frei", fest = FORMEN[form] || null, vorlage = opts.vorlage || null;
  return new Promise(resolve => {
    const box = document.createElement("div");
    box.className = "bilddialog"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    box.innerHTML = `<div class="bd-inner">
      <div class="bd-kopf"><b>${esc(opts.titel || "Bild wählen")}</b><button type="button" class="btn ghost schliessen" data-a="zu" aria-label="Schließen">✕</button></div>
      <div class="bd-start"${vorlage ? " hidden" : ""}>
        <label class="btn primary">Foto aufnehmen<input type="file" accept="image/*" capture="environment" hidden></label>
        <label class="btn">Datei wählen<input type="file" accept="image/*" hidden></label>
        <p class="hint">${form === "rund" ? "Danach den Kreis auf den Kronkorken legen." : form === "hoch" ? "Danach den Rahmen um die Flasche legen." : "Danach den Ausschnitt wählen."} Standortdaten werden entfernt.</p>
      </div>
      <div class="bd-crop" hidden>
        <p class="bd-schritt"></p>
        <div class="bd-schnell" hidden>${SCHNELL.map(([l, a], i) => `<button type="button" class="tag${i === 0 ? " an" : ""}" data-schnell="${i}">${l}</button>`).join("")}</div>
        <div class="bd-stage"><canvas></canvas></div>
        <p class="hint bd-tipp"></p>
      </div>
      <p class="err" data-a="err"></p>
      <div class="bd-fuss"><button type="button" class="btn" data-a="zu" data-fuss-zu>Abbrechen</button><button type="button" class="btn" data-a="zurueck" hidden>Zurück</button><span class="spacer"></span><button type="button" class="btn primary" data-a="ok" hidden>Übernehmen</button></div>
    </div>`;
    document.body.appendChild(box);
    const $ = s => box.querySelector(s);
    let img = null, nw = 0, nh = 0, schritt = 1, lock = fest ? fest.v : null, R = null, Q = null, fertig = false;
    const ende = erg => { if (fertig) return; fertig = true; box.remove(); document.removeEventListener("keydown", taste); resolve(erg); };
    const taste = e => { if (e.key === "Escape") ende(null); };
    document.addEventListener("keydown", taste);
    box.querySelectorAll('[data-a="zu"]').forEach(b => b.onclick = () => ende(null));
    const fehler = t => { $('[data-a="err"]').textContent = t; };
    const cv = $(".bd-stage canvas"), ctx = cv.getContext("2d");
    let view = null, sk = 1, pad = 0; // sichtbarer Bildausschnitt (Bildpixel), Maßstab Bild→Canvas, Rand um das Bild (Platz für die Eck-Griffe)

    // größtes Rechteck mit Seitenverhältnis a, zentriert um (mx,my), innerhalb von g = {x,y,w,h}
    const passend = (a, g, anteil = 1, mx, my) => {
      let w = g.w * anteil, h = w / a; if (h > g.h * anteil) { h = g.h * anteil; w = h * a; }
      mx = mx ?? g.x + g.w / 2; my = my ?? g.y + g.h / 2;
      return { x: Math.min(Math.max(mx - w / 2, g.x), g.x + g.w - w), y: Math.min(Math.max(my - h / 2, g.y), g.y + g.h - h), w, h };
    };
    const ganz = () => ({ x: 0, y: 0, w: nw, h: nh });
    const quadratIn = r => { const s = Math.min(r.w, r.h); return { x: r.x + (r.w - s) / 2, y: r.y + (r.h - s) / 2, s }; };
    const aktiv = () => schritt === 1 ? R : { x: Q.x, y: Q.y, w: Q.s, h: Q.s };
    const grenze = () => schritt === 1 ? ganz() : R;
    const verhaeltnis = () => schritt === 1 ? lock : 1;
    const minGroesse = () => Math.max(24, Math.min(nw, nh) * 0.04);

    function buehne() {
      view = schritt === 1 ? ganz() : { ...R };
      const MAXW = 720, MAXH = 720;
      pad = 26;
      sk = Math.min((MAXW - 2 * pad) / view.w, (MAXH - 2 * pad) / view.h);
      cv.width = Math.round(view.w * sk + 2 * pad); cv.height = Math.round(view.h * sk + 2 * pad);
      malen();
    }
    const zuCv = (x, y) => [pad + (x - view.x) * sk, pad + (y - view.y) * sk];
    function malen() {
      ctx.fillStyle = "#222"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, view.x, view.y, view.w, view.h, pad, pad, cv.width - 2 * pad, cv.height - 2 * pad);
      const a = aktiv(), [x, y] = zuCv(a.x, a.y), w = a.w * sk, h = a.h * sk;
      ctx.save(); ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.beginPath(); ctx.rect(0, 0, cv.width, cv.height);
      if (form === "rund") ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2, true); else ctx.rect(x + w, y, -w, h);
      ctx.fill("evenodd"); ctx.restore();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(2, cv.width / 300); ctx.strokeRect(x, y, w, h);
      const r = griffRadius() * 0.45;
      ctx.fillStyle = "#fff";
      for (const [gx, gy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) { ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); ctx.fill(); }
    }
    // Trefferradius der Ecken: mindestens 22 CSS-Pixel (also gut 44 px Durchmesser) – auch am Handy greifbar
    const griffRadius = () => 22 * cv.width / Math.max(1, cv.getBoundingClientRect().width || cv.width);
    const punkt = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * cv.width / b.width, (e.clientY - b.top) * cv.height / b.height]; };

    function setzeAktiv(n) {
      if (schritt === 1) { R = n; if (Q && (Q.x < R.x || Q.y < R.y || Q.x + Q.s > R.x + R.w || Q.y + Q.s > R.y + R.h)) Q = quadratIn(R); }
      else Q = { x: n.x, y: n.y, s: n.w };
    }
    let zieh = null;
    cv.addEventListener("pointerdown", e => {
      if (!img) return;
      const [px, py] = punkt(e), a = aktiv(), [x, y] = zuCv(a.x, a.y), w = a.w * sk, h = a.h * sk, gr = griffRadius();
      const ecken = [[x, y, 0, 0], [x + w, y, 1, 0], [x, y + h, 0, 1], [x + w, y + h, 1, 1]];
      const ecke = ecken.find(([gx, gy]) => Math.hypot(px - gx, py - gy) <= gr);
      if (ecke) zieh = { art: "ecke", rx: ecke[2], ry: ecke[3], a: { ...a } };
      else if (px >= x && px <= x + w && py >= y && py <= y + h) zieh = { art: "schieben", px, py, a: { ...a } };
      else return;
      cv.setPointerCapture(e.pointerId); e.preventDefault();
    });
    cv.addEventListener("pointermove", e => {
      if (!zieh) return;
      const [px, py] = punkt(e), g = grenze(), a0 = zieh.a;
      if (zieh.art === "schieben") {
        const dx = (px - zieh.px) / sk, dy = (py - zieh.py) / sk;
        setzeAktiv({ x: Math.min(Math.max(a0.x + dx, g.x), g.x + g.w - a0.w), y: Math.min(Math.max(a0.y + dy, g.y), g.y + g.h - a0.h), w: a0.w, h: a0.h });
      } else {
        // gegenüberliegende Ecke bleibt fest
        const ax = zieh.rx ? a0.x : a0.x + a0.w, ay = zieh.ry ? a0.y : a0.y + a0.h;
        const bx = view.x + (px - pad) / sk, by = view.y + (py - pad) / sk;
        let w = Math.abs(bx - ax), h = Math.abs(by - ay);
        const wMax = zieh.rx ? g.x + g.w - ax : ax - g.x, hMax = zieh.ry ? g.y + g.h - ay : ay - g.y;
        const v = verhaeltnis(), mn = minGroesse();
        w = Math.min(Math.max(w, mn), wMax); h = Math.min(Math.max(h, mn), hMax);
        if (v) { if (w / h > v) w = h * v; else h = w / v; if (w > wMax) { w = wMax; h = w / v; } if (h > hMax) { h = hMax; w = h * v; } }
        setzeAktiv({ x: zieh.rx ? ax : ax - w, y: zieh.ry ? ay : ay - h, w, h });
      }
      malen();
    });
    const loslassen = () => { zieh = null; };
    cv.addEventListener("pointerup", loslassen); cv.addEventListener("pointercancel", loslassen);

    box.querySelectorAll("[data-schnell]").forEach(b => b.onclick = () => {
      const [, a] = SCHNELL[+b.dataset.schnell];
      box.querySelectorAll("[data-schnell]").forEach(x => x.classList.toggle("an", x === b));
      if (a === "frei") lock = null;
      else if (a === "ganz") { lock = null; R = ganz(); }
      else { lock = a; R = passend(a, ganz(), 1, R.x + R.w / 2, R.y + R.h / 2); }
      Q = quadratIn(R); malen();
    });

    function zeigeSchritt() {
      const frei = !fest;
      $(".bd-schnell").hidden = !(frei && schritt === 1);
      $('[data-a="zurueck"]').hidden = schritt === 1;
      $("[data-fuss-zu]").hidden = schritt === 2; // im zweiten Schritt Platz für „Zurück“ – Abbrechen geht weiter über ✕
      $('[data-a="ok"]').textContent = frei && schritt === 1 ? "Weiter" : "Übernehmen";
      $(".bd-schritt").textContent = frei ? (schritt === 1 ? "Schritt 1 von 2: Ausschnitt" : "Schritt 2 von 2: Quadrat für das Vorschaubild") : "";
      $(".bd-tipp").textContent = (schritt === 1 ? "Rahmen innen ziehen zum Verschieben, an den Ecken zum Vergrößern oder Verkleinern." : "Das Quadrat erscheint in Listen und Rastern. Innen verschieben, an den Ecken die Größe ändern.")
        + (vorlage && vorlage.altbild && schritt === 1 ? " Dieses Bild wurde vor dem 7.11.2026 hochgeladen – der Ausschnitt kann nur enger werden, nicht weiter." : "");
      buehne();
    }
    function starten(bild, rel) {
      img = bild; nw = img.naturalWidth; nh = img.naturalHeight;
      R = rel && rel.rahmen ? { x: rel.rahmen.x * nw, y: rel.rahmen.y * nh, w: rel.rahmen.w * nw, h: rel.rahmen.h * nh } : null;
      if (fest && (!R || Math.abs(R.w / R.h - fest.v) > 0.01)) R = R ? passend(fest.v, R) : passend(fest.v, ganz(), rel ? 1 : 0.9);
      if (!R) R = ganz();
      Q = rel && rel.quadrat ? { x: rel.quadrat.x * nw, y: rel.quadrat.y * nh, s: rel.quadrat.s * nw } : quadratIn(R);
      if (Q.x < R.x - 0.5 || Q.y < R.y - 0.5 || Q.x + Q.s > R.x + R.w + 0.5 || Q.y + Q.s > R.y + R.h + 0.5) Q = quadratIn(R);
      $(".bd-start").hidden = true; $(".bd-crop").hidden = false; $('[data-a="ok"]').hidden = false;
      schritt = 1; zeigeSchritt();
    }
    async function ergebnis() {
      const rel = { rahmen: { x: R.x / nw, y: R.y / nh, w: R.w / nw, h: R.h / nh }, quadrat: fest ? null : { x: Q.x / nw, y: Q.y / nh, s: Q.s / nw } };
      let gross, klein;
      if (fest) { gross = await zuBlob(zeichne(img, R.x, R.y, R.w, R.h, ...fest.gross), 0.85); klein = await zuBlob(zeichne(img, R.x, R.y, R.w, R.h, ...fest.klein), 0.8); }
      else {
        const s = Math.min(1, BASIS_MAX / Math.max(R.w, R.h));
        gross = await zuBlob(zeichne(img, R.x, R.y, R.w, R.h, R.w * s, R.h * s), 0.82);
        klein = await zuBlob(zeichne(img, Q.x, Q.y, Q.s, Q.s, 360, 360), 0.78);
      }
      let basis = null;
      if (!vorlage) { const s = Math.min(1, BASIS_MAX / Math.max(nw, nh)); basis = await zuBlob(zeichne(img, 0, 0, nw, nh, nw * s, nh * s), 0.82); }
      return { gross, klein, basis, basisPfad: vorlage ? vorlage.basisPfad || null : null, ausschnitt: rel };
    }
    $('[data-a="zurueck"]').onclick = () => { schritt = 1; zeigeSchritt(); };
    $('[data-a="ok"]').onclick = async () => {
      if (!img) return;
      if (!fest && schritt === 1) { schritt = 2; zeigeSchritt(); return; }
      const ok = $('[data-a="ok"]'); ok.disabled = true; ok.textContent = "Wird vorbereitet …";
      try { ende(await ergebnis()); } catch (e) { fehler(e.message); ok.disabled = false; ok.textContent = "Übernehmen"; }
    };
    box.querySelectorAll("input[type=file]").forEach(inp => inp.onchange = async () => {
      const datei = inp.files[0]; inp.value = ""; if (!datei) return;
      fehler("");
      try { starten(await ladeBild(await alsJpegDatei(datei)), null); } catch (e) { fehler(e.message); }
    });
    if (vorlage) ladeUrl(vorlage.src).then(b => starten(b, vorlage)).catch(e => fehler(e.message));
  });
}

/* ---------- Speicher ---------- */
const basisPfad = p => p ? p.replace(/\.jpg$/, "_b.jpg") : p;
/* Lädt Großbild + Vorschau hoch; mit erg.basis auch das unbeschnittene Bild, und merkt sich den Ausschnitt in
   bild_ausschnitte (für „Ausschnitt ändern“). Ohne Ausschnitt (z. B. Sud-Galerie) wie bisher nur gross/klein. */
async function hochladen(basis, blobs) {
  const sb = KB.sb, pfad = `${basis}-${Date.now().toString(36)}.jpg`;
  const opt = { contentType: "image/jpeg", cacheControl: "31536000", upsert: true };
  let r = await sb.storage.from(BUCKET).upload(pfad, blobs.gross, opt);
  if (r.error) throw r.error;
  r = await sb.storage.from(BUCKET).upload(kleinPfad(pfad), blobs.klein, opt);
  if (r.error) { await sb.storage.from(BUCKET).remove([pfad]); throw r.error; }
  if (blobs.ausschnitt) {
    let bp = blobs.basisPfad;
    if (blobs.basis) { bp = basisPfad(pfad); r = await sb.storage.from(BUCKET).upload(bp, blobs.basis, opt); if (r.error) bp = null; }
    // Best effort: ohne Eintrag gilt das Bild später als „Altbild“ (nachschneiden nur enger) – kein Grund, den Upload scheitern zu lassen.
    if (bp) { try { await sb.from("bild_ausschnitte").insert({ pfad, basis_pfad: bp, rahmen: blobs.ausschnitt.rahmen, quadrat: blobs.ausschnitt.quadrat }); } catch (_) {} }
  }
  return pfad;
}
/* Wird ein Pfad noch irgendwo als Bild benutzt? Seit Sud und verknüpftes Bier dieselben Kronkorken-/Flaschen-
   bilder teilen, darf ein Bild erst weg, wenn keine Zeile mehr darauf zeigt. */
async function nochVerwendet(pfad) {
  const sb = KB.sb, q = c => c.map(k => `${k}.eq."${pfad}"`).join(",");
  const proben = [["sude", ["bild_foto", "bild_kronkorken", "bild_flasche", "bild_etikett"]], ["rezepte", ["bild_foto", "bild_kronkorken", "bild_flasche", "bild_etikett"]],
    ["biere", ["bild_kronkorken", "bild_flasche"]], ["verkostungen", ["bild_titel"]]];
  for (const [t, cols] of proben) {
    const { data, error } = await sb.from(t).select("id").or(q(cols)).limit(1);
    if (error) return true; // im Zweifel nicht löschen
    if (data && data.length) return true;
  }
  return false;
}
async function loeschen(pfad) {
  if (!pfad) return;
  const sb = KB.sb;
  try {
    if (await nochVerwendet(pfad)) return;
    const weg = [kleinPfad(pfad)];
    const istBasis = ((await sb.from("bild_ausschnitte").select("pfad").eq("basis_pfad", pfad)).data || []).some(x => x.pfad !== pfad);
    if (!istBasis) weg.push(pfad);
    const { data: zeile } = await sb.from("bild_ausschnitte").select("basis_pfad").eq("pfad", pfad).maybeSingle();
    if (zeile) {
      await sb.from("bild_ausschnitte").delete().eq("pfad", pfad);
      if (zeile.basis_pfad && zeile.basis_pfad !== pfad) {
        const andere = (await sb.from("bild_ausschnitte").select("pfad").eq("basis_pfad", zeile.basis_pfad)).data || [];
        if (!andere.length && !(await nochVerwendet(zeile.basis_pfad))) weg.push(zeile.basis_pfad, kleinPfad(zeile.basis_pfad));
      }
    }
    await sb.storage.from(BUCKET).remove(weg);
  } catch (_) { /* Datei bleibt liegen – unschädlich */ }
}
/* Zuschnitt eines vorhandenen Bildes neu wählen: mit gespeichertem Ausschnitt aus dem unbeschnittenen Bild,
   sonst (Altbild vor dem 7.11.2026) aus dem Großbild selbst – das wird dann zum Basisbild und bleibt liegen. */
async function ausschnittAendern(pfad, o = {}) {
  if (!pfad) return null;
  let vorlage;
  try {
    const { data: z } = await KB.sb.from("bild_ausschnitte").select("basis_pfad,rahmen,quadrat").eq("pfad", pfad).maybeSingle();
    vorlage = z ? { src: url(z.basis_pfad), rahmen: z.rahmen, quadrat: z.quadrat, basisPfad: z.basis_pfad }
                : { src: url(pfad), basisPfad: pfad, altbild: true };
  } catch (_) { vorlage = { src: url(pfad), basisPfad: pfad, altbild: true }; }
  const erg = await waehlen({ form: o.art || "rund", titel: (o.titel || "Bild") + ": Ausschnitt ändern", vorlage });
  if (!erg) return null;
  return hochladen(o.basis, erg);
}

/* Ein vorhandenes Bild (inkl. Vorschau) unter neuem Pfad duplizieren, z. B. um ein Sud-Etikett als Bier-Kronkorken zu übernehmen,
   ohne dass beide auf dieselbe Datei zeigen (sonst würde das Löschen des einen auch das andere zerstören). */
/* ---------- Galerie (privater Bucket) ---------- */
/* Braumeister lädt selbst ein Galeriefoto hoch (Gäste laufen über die Edge Function „galerie-hochladen“). */
async function galerieHochladen(basis, blobs) {
  const sb = KB.sb, pfad = `${basis}-${Date.now().toString(36)}.jpg`;
  const opt = { contentType: "image/jpeg", cacheControl: "31536000", upsert: true };
  let r = await sb.storage.from(GALERIE_BUCKET).upload(pfad, blobs.gross, opt);
  if (r.error) throw r.error;
  r = await sb.storage.from(GALERIE_BUCKET).upload(kleinPfad(pfad), blobs.klein, opt);
  if (r.error) { await sb.storage.from(GALERIE_BUCKET).remove([pfad]); throw r.error; }
  return pfad;
}
async function galerieLoeschen(pfad) {
  if (!pfad) return;
  try { await KB.sb.storage.from(GALERIE_BUCKET).remove([pfad, kleinPfad(pfad)]); } catch (_) { /* Datei bleibt liegen – unschädlich */ }
}
/* Signierte, kurzlebige Lese-URLs für eine Liste von Pfaden (nur erfolgreich für Braumeister/Admin – das regelt die RLS-Policy
   auf dem privaten Bucket). Gibt eine Map Pfad → {gross, klein} zurück; fehlgeschlagene Pfade fehlen in der Map. */
async function galerieSignierteUrls(pfade, sekunden = 300) {
  if (!pfade.length) return {};
  const alle = pfade.flatMap(p => [p, kleinPfad(p)]);
  const { data, error } = await KB.sb.storage.from(GALERIE_BUCKET).createSignedUrls(alle, sekunden);
  if (error || !data) return {};
  const nachPfad = {};
  data.forEach(d => { if (d.path) nachPfad[d.path] = d.signedUrl; });
  const erg = {};
  pfade.forEach(p => { if (nachPfad[p]) erg[p] = { gross: nachPfad[p], klein: nachPfad[kleinPfad(p)] || nachPfad[p] }; });
  return erg;
}
/* Galerie mit bereits aufgelösten (signierten) URLs zeichnen – Gegenstück zu galerieHtml() für den privaten Bucket. */
function galerieHtmlSigniert(pfade, urls, o = {}) {
  return `<div class="galerie">${pfade.map((p, i) => `<div class="g-item"><button type="button" class="g-zeig" data-i="${i}" aria-label="Foto ${i + 1} groß zeigen"><img src="${esc(urls[p]?.klein || "")}" alt="" loading="lazy"></button>${o.loeschbar && (o.loeschbar === true || o.loeschbar(i)) ? `<button type="button" class="g-weg" data-weg="${i}" aria-label="Foto ${i + 1} löschen">✕</button>` : ""}</div>`).join("")}</div>`;
}
function zeigenSigniert(pfade, urls, start = 0) { zeigenRoh(pfade.map(p => ({ src: urls[p]?.gross })).filter(e => e.src), start); }

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
  zeigenRoh(liste.map(e => ({ src: url(e.pfad), bildunterschrift: e.bildunterschrift })), start);
}
/* Großansicht mit bereits fertigen Bild-URLs (öffentlich oder signiert). liste: {src, bildunterschrift?}[] */
function zeigenRoh(liste, start = 0) {
  let i = start;
  const box = document.createElement("div");
  box.className = "lightbox"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
  const mal = () => { box.innerHTML = `<img src="${esc(liste[i].src)}" alt="Foto ${i + 1} von ${liste.length}">
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
  // Mit dem Daumen wischen (Handy): nur eine waagerechte Wischgeste über einer Mindestlänge zählt,
  // sonst würde z. B. ein leicht schräger Tap zum Schließen versehentlich das Foto wechseln.
  let startX = null, startY = null;
  box.addEventListener("touchstart", e => { if (e.touches.length === 1) { startX = e.touches[0].clientX; startY = e.touches[0].clientY; } }, { passive: true });
  box.addEventListener("touchend", e => {
    if (startX === null || liste.length < 2) return;
    const dx = e.changedTouches[0].clientX - startX, dy = e.changedTouches[0].clientY - startY;
    startX = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) { i = dx < 0 ? (i + 1) % liste.length : (i + liste.length - 1) % liste.length; mal(); }
  }, { passive: true });
  mal(); document.body.appendChild(box);
}

/* ---------- Bildfeld für Formulare ----------
   feldHtml(id, pfad, {art, bier, beschriftung}) → HTML; feldVerdrahten(id, {form, basis, titel, art, bier}) → { wert(): pfad|null }
   Das Bild wird sofort hochgeladen; gespeichert wird der Pfad mit dem Formular. */
function vorschau(pfad, art, b) {
  if (pfad) return `<img src="${esc(url(pfad, true))}" alt="" class="${art === "rund" ? "kb-zack" : ""}">`;
  return art === "frei" ? `<span class="bf-leer">kein Bild</span>` : platzhalter(b);
}
const feldKnoepfe = p => `<button type="button" class="linkbtn" data-bf="neu">${p ? "Ersetzen" : "Hinzufügen"}</button>${p ? ` · <button type="button" class="linkbtn" data-bf="schnitt">Ausschnitt ändern</button> · <button type="button" class="linkbtn" data-bf="weg">Entfernen</button>` : ""}`;
function feldHtml(id, pfad, o = {}) {
  return `<div class="bildfeld bf-${o.art || "rund"}" id="${id}" data-pfad="${esc(pfad || "")}">
    <div class="bf-bild">${vorschau(pfad, o.art || "rund", o.bier)}</div>
    <div class="bf-text"><b>${esc(o.beschriftung || "Bild")}</b>
      <span>${feldKnoepfe(pfad)}</span>
      <small class="err"></small></div></div>`;
}
function feldVerdrahten(id, o = {}) {
  const el = document.getElementById(id); if (!el) return { wert: () => null };
  const neuZeichnen = () => {
    const p = el.dataset.pfad || null;
    el.querySelector(".bf-bild").innerHTML = vorschau(p, o.art || "rund", o.bier);
    el.querySelector(".bf-text span").innerHTML = feldKnoepfe(p);
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
    const sch = el.querySelector('[data-bf="schnitt"]');
    if (sch) sch.onclick = async () => {
      const info = el.querySelector(".err");
      try {
        const neu = await ausschnittAendern(el.dataset.pfad, { art: o.art || "rund", titel: o.titel, basis: o.basis });
        if (!neu) return;
        // Neuer Dateiname statt Überschreiben: Bilder werden ein Jahr lang im Browser zwischengespeichert.
        // Das alte Bild löscht das Formular beim Speichern (alt ≠ neu → Bilder.loeschen).
        el.dataset.pfad = neu; info.textContent = ""; neuZeichnen(); if (o.geaendert) o.geaendert(neu);
      } catch (e) { info.textContent = "Zuschneiden fehlgeschlagen" + (e && e.message ? ": " + e.message : "."); }
    };
    const w = el.querySelector('[data-bf="weg"]'); if (w) w.onclick = () => KB.bestaetigen(`${o.titel || "Bild"} entfernen?`, "Das Bild wird beim Speichern entfernt.", "Entfernen", () => { el.dataset.pfad = ""; neuZeichnen(); if (o.geaendert) o.geaendert(null); });
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
    return `<div class="g-item"><button type="button" class="g-zeig" data-i="${i}" aria-label="Foto ${i + 1} groß zeigen"><img src="${esc(url(obj.pfad, true))}" alt="" loading="lazy">${obj.datum ? `<span class="g-datum">${esc(obj.datum)}</span>` : ""}</button>
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

global.Bilder = { ausschnittAendern, galerieHtml, galerieVerdrahten, url, kleinPfad, ebcFarbe, stilEbc, platzhalter, titelPlatzhalter, bier, bierFotos, bierFotosVerdrahten, waehlen, verkleinern, ladeBild, exifDatum, alsJpegDatei, hochladen, kopieren, loeschen, zeigen, feldHtml, feldVerdrahten,
  galerieHochladen, galerieLoeschen, galerieSignierteUrls, galerieHtmlSigniert, zeigenSigniert };
})(typeof window !== "undefined" ? window : globalThis);
