/* Koldingbräu – Verkostungen: gemeinsame Bausteine (Konstanten, Zustand, Helfer)
   Die Dateien dieses Bereichs teilen sich den globalen Gültigkeitsbereich der Seite verkostung.html;
   Reihenfolge: common → form → guest → overview → results → admin → main.
   Gäste haben keinen Tabellenzugriff, sondern nutzen nur die vk_*-Funktionen der Datenbank. */
"use strict";
const {$, esc, state, isBM, isAdmin, siteUrl, fmtDateLong, fmtZahl, gradeCls, toast, notice, sheet, closeSheet, sec, fehlertext, lsGet, lsSet} = KB;
const sb = new Proxy({}, {get: (_, k) => { const v = KB.sb[k]; return typeof v === "function" ? v.bind(KB.sb) : v; }});

const STATUS = {vorbereitung:"In Vorbereitung", laeuft:"Läuft", abgeschlossen:"Abgeschlossen"};
const MERKMALE = [
  ["Aussehen", [["farbe","Farbe","hell","dunkel"],["klarheit","Klarheit","klar","trüb"],["schaum","Schaum","wenig","viel"]]],
  ["Geruch", [["intensitaet","Intensität","schwach","kräftig"]]],
  ["Geschmack", [["bitter","Bittere","mild","bitter"],["suesse","Süße","trocken","süß"],["malzhopfen","Betonung","malzig","hopfig"]]],
  ["Mundgefühl", [["koerper","Körper","schlank","vollmundig"],["kohlensaeure","Kohlensäure","wenig","spritzig"],["abgang","Abgang","kurz","lang"]]],
];
const GERUCH = ["malzig","brotig","Karamell","röstig","blumig","Zitrus","tropisch","harzig/kräuterig","Banane","Nelke","fruchtig","säuerlich"];
const MIN_LIVE = 15000; // Abstand der Aktualisierung während einer laufenden Verkostung

const params = new URLSearchParams(location.search);
const code = (params.get("v") || "").trim().toLowerCase();
const detailId = params.get("id") || "";
const ergebnisId = params.get("e") || "";
const ansicht = code ? "gast" : detailId ? "detail" : ergebnisId ? "ergebnis" : "liste";
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
    return `<li class="${z.schnitt!=null&&platz<=3?"top p"+platz:""}"${opts&&opts.klick?` data-id="${esc(z.id)}" tabindex="0" role="button"`:""}>
      <span class="pl num">${z.schnitt==null?"–":platz+"."}</span>
      <span class="nm${z.bild?" mit-bild":""}">${z.bild||""}<span><b>${esc(z.titel)}</b>${z.unter?`<small>${esc(z.unter)}</small>`:""}</span></span>
      <span class="sc"><b class="num ${gradeCls(z.schnitt)}">${note(z.schnitt)}</b></span>
      <small class="mt">${z.anzahl||0} Bew.${z.anzahl?` · ${Math.round((z.nochmal||0)/z.anzahl*100)} % nochmal`:""}</small>
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
