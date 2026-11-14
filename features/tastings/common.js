/* Koldingbräu – Verkostungen: gemeinsame Bausteine (Konstanten, Zustand, Helfer)
   Die Dateien dieses Bereichs teilen sich den globalen Gültigkeitsbereich der Seite verkostung.html;
   Reihenfolge: common → form → guest → overview → results → admin → main.
   Gäste haben keinen Tabellenzugriff, sondern nutzen nur die vk_*-Funktionen der Datenbank. */
"use strict";
const {$, esc, state, isBM, isAdmin, siteUrl, fmtDateLong, fmtZahl, gradeCls, toast, notice, sheet, closeSheet, bestaetigen, sec, fehlertext, lsGet, lsSet} = KB;
const sb = new Proxy({}, {get: (_, k) => { const v = KB.sb[k]; return typeof v === "function" ? v.bind(KB.sb) : v; }});

const STATUS = {vorbereitung:"In Vorbereitung", laeuft:"Läuft", abgeschlossen:"Abgeschlossen"};
const MERKMALE = [
  ["Aussehen", [["farbe","Farbe","hell","dunkel"],["klarheit","Trübung","klar","trüb"],["schaum","Schaum","wenig","viel"]]],
  ["Geruch", [["intensitaet","Intensität","schwach","kräftig"]]],
  ["Geschmack", [["bitter","Bittere","mild","bitter"],["suesse","Süße","trocken","süß"],["malzhopfen","Betonung","malzig","hopfig"]]],
  ["Mundgefühl", [["koerper","Körper","schlank","vollmundig"],["kohlensaeure","Kohlensäure","wenig","spritzig"],["abgang","Abgang","kurz","lang"]]],
];
/* MERKMALE: die früheren Regler – der Bogen fragt sie seit 13.11.2026 nicht mehr ab, sie bleiben nur für die Anzeige
   historischer Bewertungen (Geschmacksprofil).
   Tags für den Bogen (Seite „Riechen“ und „Schmecken“): [wort, emoji, Beispiele]. Die Beispiele stehen seit
   14.11.2026 direkt auf der Kachel und ersetzen dort das Glossar („Was heißt das?“).
   Gespeichert werden beide Seiten zusammen in bewertungen.geruch (nur das Wort, ohne Emoji) – darum darf kein Wort in
   beiden Listen vorkommen. Ältere Bewertungen enthalten dort noch die früheren Geruchs-Tags (Zitrus, Banane …), die
   zählen bei der Anzeige zum Geruch. */
const TAGS_GERUCH = [
  ["fruchtig","🍊","Apfel, Beeren, Pfirsich"],
  ["zitronig","🍋","Zitrone, Grapefruit"],
  ["blumig","🌸","Blüten, Parfüm"],
  ["kräuterig","🌿","Kräuter, Gras, Heu"],
  ["brotig","🍞","Brot, Teig, Getreide"],
  ["karamellig","🍯","Karamell, Toffee"],
  ["röstig","🔥","Kaffee, Schokolade"],
  ["bananig","🍌","reife Banane, Nelke"],
];
const TAGS_GESCHMACK = [
  ["hopfig","🌿","würzig, leicht bitter"],
  ["malzig","🍺","Brotkruste, Malzbier"],
  ["spritzig","🫧","viel Kohlensäure"],
  ["leicht","🪶","schlank und frisch"],
  ["kräftig","💪","voll, fast cremig"],
  ["süffig","🍻","trinkt sich leicht"],
  ["ungewöhnlich","🤔","anders als erwartet"],
  ["nicht meins","😬","schmeckt mir nicht"],
];
/* „herb“ und „süß“ waren am 13.11.2026 kurz Geschmacks-Tags – seit dem Geschmackskreis fragt der Kreis das ab.
   Sie bleiben hier nur, damit bereits gespeicherte Bewertungen weiter richtig angezeigt werden. */
const TAGS_GESCHMACK_FRUEHER = [["herb","🍋"],["süß","🍯"]];
/* Geschmackskreis (Seite „Geschmacksbild“): zwei Achsen, gespeichert als die früheren Regler in merkmale –
   bitter: 0 = mild … 10 = bitter, suesse: 0 = trocken … 10 = süß. Begriffe fürs Glossar der Seite.
   (Heißt im Code weiter „Kreis“ – seit 13.11.2026 ist es eine quadratische Karte, siehe karteHtml.) */
const KREIS_BEGRIFFE = [
  ["bitter","☕","Die Bittere vom Hopfen – zieht am Gaumen, wie Grapefruit, Chicorée oder dunkle Schokolade. Typisch für Pils und IPA."],
  ["mild","🥛","Kaum Bittere, weich und rund. Typisch für Helles oder Weizen."],
  ["süß","🍯","Schmeckt nach Malz-Süße, wie Honig, Karamell oder Malzbier. Typisch für Bock und Märzen."],
  ["trocken","🌵","Das Gegenteil von süß: kaum Restsüße, endet knackig und sauber – man will gleich den nächsten Schluck. Typisch für Pils und Kölsch."],
  ["ausgewogen","⚖️","Die Mitte der Karte: nichts sticht heraus."],
];
/* Notenseite (seit 14.11.2026): Wort und kurze Erklärung je Note 0–10, damit klar ist, was eine 3 gegenüber einer 9 heißt */
const NOTE_STUFEN = [
  ["Ausguss","Ab in den Ausguss."],
  ["Furchtbar","Kein zweiter Schluck."],
  ["Schlecht","Deutliche Fehler im Geschmack."],
  ["Mag ich nicht","Trinkbar, aber nicht meins."],
  ["Naja","Lässt mich ziemlich kalt."],
  ["Okay","Solide, nichts Besonderes."],
  ["Ganz gut","Würde ich trinken."],
  ["Gut","Gerne wieder."],
  ["Sehr gut","Würde ich mir kaufen."],
  ["Hervorragend","Empfehle ich weiter."],
  ["Spitze","Eins der besten, die ich kenne."],
];
/* Geschmackskarte (seit 13.11.2026 statt des Kreises): Quadrat mit den vier Polen am Rand (die Bierstil-Beispiele in
   den Ecken gab es nur am 13.11.). Gemeinsam für den Bogen (Eingabe) und die Ergebnisseite (Punktwolke). Lage als x/y von -1 bis 1:
   x = Süße (links trocken, rechts süß), y = Bittere (unten mild, oben bitter) – 1:1 die Werte 0–10 in merkmale. */
function karteHtml({klein = false, attr = "", innen = ""} = {}){
  return `<div class="karte${klein?" klein":""}"${attr}><i class="k-achse v" aria-hidden="true"></i><i class="k-achse h" aria-hidden="true"></i>
    <span class="k-pol o" aria-hidden="true">${klein?"":"☕ "}Bitter</span><span class="k-pol u" aria-hidden="true">${klein?"":"🥛 "}Mild</span>
    <span class="k-pol l" aria-hidden="true">${klein?"":"🌵 "}Trocken</span><span class="k-pol r" aria-hidden="true">Süß${klein?"":" 🍯"}</span>
    ${innen}</div>`;
}
// Position in Prozent aus den gespeicherten Werten 0–10 (suesse, bitter)
const kartePos = (suesse, bitter) => `left:${(suesse*10).toFixed(1)}%;top:${(100 - bitter*10).toFixed(1)}%`;
// Wahl in Worten, z. B. „Leicht bitter und trocken“ (p = {x, y} von -1 bis 1)
function kreisText(p){
  if(!p) return "Noch nichts gewählt – tipp auf die Karte.";
  const teil = (v, plus, minus) => { const a = Math.abs(v); if(a < 0.2) return null;
    return {a, t: (a > 0.75 ? "sehr " : a < 0.45 ? "leicht " : "") + (v > 0 ? plus : minus)}; };
  const t = [teil(p.y, "bitter", "mild"), teil(p.x, "süß", "trocken")].filter(Boolean).sort((a,b) => b.a - a.a).map(x => x.t);
  if(!t.length) return "Ausgewogen";
  const s = t.join(" und "); return s[0].toUpperCase() + s.slice(1);
}
const eindruck = t => { const e = [...TAGS_GERUCH, ...TAGS_GESCHMACK, ...TAGS_GESCHMACK_FRUEHER].find(([x]) => x === t); return e ? e[1]+" "+t : t; };
const istGeschmack = t => [...TAGS_GESCHMACK, ...TAGS_GESCHMACK_FRUEHER].some(([x]) => x === t);
const MIN_LIVE = 15000; // Abstand der Aktualisierung während einer laufenden Verkostung

const params = new URLSearchParams(location.search);
const code = (params.get("v") || "").trim().toLowerCase();
const detailId = params.get("id") || "";
const ergebnisId = params.get("e") || "";
const ankuendigungId = params.get("a") || "";
const ansicht = code ? "gast" : detailId ? "detail" : ergebnisId ? "ergebnis" : ankuendigungId ? "ankuendigung" : "liste";
const main = () => $("#vk");
let stile = [];            // Bierstile (für Formulare)
let timer = null;

/* ---------- Helfer ---------- */
const statusTag = s => `<span class="vk-status ${esc(s)}">${esc(STATUS[s]||s)}</span>`;
const note = v => v==null ? "–" : fmtZahl(v,1);
const bierZeile = b => b ? [b.brauerei, b.stil, b.alkohol!=null?fmtZahl(b.alkohol,1)+" % Vol.":""].filter(Boolean).join(" · ") : "";
function rangfolge(liste){ // liste: {schnitt, nochmal, nummer}
  return liste.slice().sort((a,b)=>(b.schnitt??-1)-(a.schnitt??-1)||(b.nochmal||0)-(a.nochmal||0)||a.nummer-b.nummer);
}
function rangTabelle(zeilen, opts){
  // zeilen: [{nummer, titel, unter, schnitt, anzahl, nochmal, id}]
  if(!zeilen.length) return `<p class="empty">Noch keine Biere eingetragen.</p>`;
  const max = 10;
  let platz = 0, vorher = null;
  return `<ol class="rank">${rangfolge(zeilen).map((z,i)=>{
    const key = z.schnitt==null ? null : `${z.schnitt}|${z.nochmal||0}`;
    if(key!==vorher){platz=i+1;vorher=key;}
    const w = z.schnitt==null ? 0 : Math.round(z.schnitt/max*100);
    return `<li${opts&&opts.klick?` data-id="${esc(z.id)}" tabindex="0" role="button"`:""}>
      <span class="pl num">${z.schnitt==null?"–":platz+"."}</span>
      <span class="nm${z.bild?" mit-bild":""}">${z.bild||""}<span><b>${esc(z.titel)}</b>${z.unter?`<small>${esc(z.unter)}</small>`:""}</span></span>
      <span class="sc"><b class="num ${gradeCls(z.schnitt)}">${note(z.schnitt)}</b></span>
      <small class="mt">${z.anzahl||0} Bew.</small>
      <span class="bar"><i class="${gradeCls(z.schnitt)}" style="width:${w}%"></i></span>
    </li>`;}).join("")}</ol>`;
}
function stopTimer(){ if(timer){clearInterval(timer);timer=null;} }
function startTimer(fn){ stopTimer(); timer=setInterval(()=>{ if(document.visibilityState==="visible" && $("#sheet").hidden) fn(); }, MIN_LIVE); }
async function ladeStile(){
  if(stile.length) return stile;
  const {data} = await sb.from("bierstile").select("id,name,reihenfolge").order("reihenfolge").order("name");
  stile = data || []; return stile;
}
function gastLink(c){ return siteUrl()+"verkostung.html?v="+encodeURIComponent(c); }
/* Link für die Einladung: führt auf die Ankündigung, NICHT zum Mitmachen (der Code kommt erst am Abend).
   Auf kolding.de die schöne Adresse /verkostung/<id>/ – dort liegt eine Vorschauseite fürs WhatsApp-Bild
   (scripts/build-previews.mjs) bzw. leitet 404.html weiter, solange sie noch nicht gebaut ist. Lokal
   (localhost) gibt es beides nicht, dort direkt die Ankündigungsseite. */
function ankuendigungLink(id){
  return /(^|\.)kolding\.de$/.test(location.hostname) ? "https://kolding.de/verkostung/"+encodeURIComponent(id)+"/" : siteUrl()+"verkostung.html?a="+encodeURIComponent(id);
}
function wochentagDatum(iso){
  if(!iso) return "";
  const [y,m,d] = iso.split("-").map(Number);
  return new Date(y, m-1, d).toLocaleDateString("de-DE", {weekday:"long", day:"numeric", month:"long"});
}
function wannWo(v){ // „Samstag, 21. November, 19:30 Uhr · Werkstatt“
  const uhr = v.uhrzeit ? String(v.uhrzeit).slice(0,5) : "";
  return [wochentagDatum(v.datum) + (uhr ? `, ${uhr} Uhr` : ""), v.ort].filter(Boolean).join(" · ");
}
function einladungsNachricht(v){
  const zeilen = [`${v.titel} – Koldingbräu lädt ein`, wannWo(v)];
  if((v.einladungstext||"").trim()) zeilen.push("", v.einladungstext.trim());
  zeilen.push("", ankuendigungLink(v.id));
  return zeilen.join("\n");
}
async function einladungTeilen(v){
  const text = einladungsNachricht(v);
  if(navigator.share){
    try{ await navigator.share({title: v.titel, text}); return; }
    catch(e){ if(e && e.name === "AbortError") return; }
  }
  try{ await navigator.clipboard.writeText(text); toast("Einladung kopiert – jetzt im Messenger einfügen"); }
  catch(_){ toast("Kopieren ging nicht – bitte den Text markieren und kopieren"); }
}

/* ---------- Fotos vom Abend für Teilnehmer (seit 10.11.2026) ----------
   Wer an einer Verkostung teilgenommen hat, sieht deren Galerie: während des Abends in der Gästeansicht, danach
   unbegrenzt auf der Ergebnisseite. Die Fotos liegen im privaten Bucket; die Edge Function „galerie-ansehen“ prüft den
   persönlichen Schlüssel und liefert signierte Links (1 Stunde). Öffentlich bleibt die Galerie unsichtbar.
   anfrage: {code, token} (Gästeansicht) oder {verkostung_id, tokens} (Ergebnisseite). */
const ggCache = {daten: null, zeit: 0, schluessel: ""};
async function gastGalerieLaden(anfrage, erzwingen){
  const k = JSON.stringify(anfrage);
  if(!erzwingen && ggCache.daten && ggCache.schluessel === k && Date.now() - ggCache.zeit < 60000) return ggCache.daten;
  const {data, error} = await sb.functions.invoke("galerie-ansehen", {body: anfrage});
  if(error || !data || !data.fotos) return ggCache.schluessel === k ? ggCache.daten : null;
  Object.assign(ggCache, {daten: data, zeit: Date.now(), schluessel: k});
  return data;
}
const gastGalerieAusCache = anfrage => ggCache.schluessel === JSON.stringify(anfrage) ? ggCache.daten : null;
// Persönlicher Zugangslink: öffnet die Gästeansicht mit dem Schlüssel und merkt ihn sich auf dem neuen Gerät.
const zugangsLink = (c, token) => gastLink(c) + "&t=" + encodeURIComponent(token);
function gastGalerieHtml(d){
  const fotos = d.fotos || [];
  return `${fotos.length
      ? `<div class="gg-raster">${fotos.map((f,i) => `<button type="button" data-gg="${i}" aria-label="Foto ${i+1} groß zeigen"><img src="${esc(f.klein)}" alt="" loading="lazy">${f.von?`<small>von ${esc(f.mein?"dir":f.von)}</small>`:""}</button>`).join("")}</div>`
      : `<p class="hint">Noch keine Fotos.</p>`}
    <details class="zugang"><summary class="hint">Fotos auf einem anderen Gerät ansehen</summary>
      <p class="hint">Mit deinem persönlichen Link siehst du die Fotos auch auf einem neuen Handy oder in einem anderen Browser – auch noch Wochen später. Bitte nicht weitergeben: Wer den Link hat, ist als du dabei.</p>
      <div class="zugang-link"><button type="button" class="btn" data-zugang>Meinen Link teilen</button></div></details>`;
}
function gastGalerieVerdrahten(wurzel, d){
  wurzel.querySelectorAll("[data-gg]").forEach(b => b.onclick = () =>
    Bilder.zeigenRoh(d.fotos.map(f => ({src: f.gross, bildunterschrift: f.von ? "von "+(f.mein?"dir":f.von) : ""})), +b.dataset.gg));
  const z = wurzel.querySelector("[data-zugang]");
  if(z) z.onclick = async () => {
    const url = zugangsLink(d.code, d.token);
    if(navigator.share){ try{ await navigator.share({title: "Mein Zugang zur Verkostung", url}); return; }catch(e){ if(e && e.name === "AbortError") return; } }
    try{ await navigator.clipboard.writeText(url); toast("Link kopiert"); }catch(_){ window.prompt("Dein persönlicher Link:", url); }
  };
}
