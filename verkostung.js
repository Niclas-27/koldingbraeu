/* Koldingbräu – Seite „Verkostungen“
   Drei Ansichten:
   - ?v=<code>  Gäste (und Braumeister, die mitbewerten): beitreten, Biere bewerten, Live-Zwischenstand
   - ?id=<uuid> Braumeister: Verkostung vorbereiten, QR-Code, Biere, Status, Live-Auswertung, Bewertungen ausblenden
   - ohne       Übersicht: Braumeister sehen alle Verkostungen, Gäste die abgeschlossenen Ergebnisse
   Gäste haben keinen Tabellenzugriff, sondern nutzen nur die vk_*-Funktionen der Datenbank. */
(function () {
"use strict";
const {$, esc, state, isBM, isAdmin, siteUrl, fmtDateLong, fmtZahl, toast, notice, sheet, closeSheet, sec, fehlertext, lsGet, lsSet} = KB;
const sb = new Proxy({}, {get: (_, k) => { const v = KB.sb[k]; return typeof v === "function" ? v.bind(KB.sb) : v; }});

const STATUS = {vorbereitung:"In Vorbereitung", laeuft:"Läuft", abgeschlossen:"Abgeschlossen"};
const MERKMALE = [
  ["Aussehen", [["farbe","Farbe","hell","dunkel"],["klarheit","Klarheit","klar","trüb"],["schaum","Schaum","wenig","viel"]]],
  ["Geruch", [["intensitaet","Intensität","schwach","kräftig"]]],
  ["Geschmack", [["bitter","Bittere","mild","bitter"],["suesse","Süße","süß","trocken"],["malzhopfen","Betonung","malzig","hopfig"],["saeure","Säure","keine","deutlich"]]],
  ["Mundgefühl", [["koerper","Körper","schlank","vollmundig"],["kohlensaeure","Kohlensäure","wenig","spritzig"],["abgang","Abgang","kurz","lang"]]],
];
const GERUCH = ["malzig","brotig","Karamell","röstig","blumig","Zitrus","tropisch","harzig/kräuterig","Banane","Nelke","fruchtig","säuerlich"];
const FEHLER = ["Butter","Pappe/oxidiert","Schwefel","Lösungsmittel","Gemüse","Essig"];
const MIN_LIVE = 15000; // Abstand der Aktualisierung während einer laufenden Verkostung

const params = new URLSearchParams(location.search);
const code = (params.get("v") || "").trim().toLowerCase();
const detailId = params.get("id") || "";
const ansicht = code ? "gast" : detailId ? "detail" : "liste";
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
      <span class="nm"><b>${esc(z.titel)}</b>${z.unter?`<small>${esc(z.unter)}</small>`:""}</span>
      <span class="sc"><b class="num">${note(z.schnitt)}</b></span>
      <small class="mt">${z.anzahl||0} Bew.${z.anzahl?` · ${Math.round((z.nochmal||0)/z.anzahl*100)} % nochmal`:""}</small>
      <span class="bar"><i style="width:${w}%"></i></span>
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

/* =========================================================================
   Gäste-Ansicht (?v=code)
   ========================================================================= */
const gastKey = () => "kb_gast_"+code;
function gast(){ try{ return JSON.parse(lsGet(gastKey())||"null"); }catch(_){ return null; } }
let gData = null;

async function gastLaden(still){
  const g = gast();
  const {data, error} = await sb.rpc("vk_laden", {p_code: code, p_token: g ? g.token : null});
  if(error){ stopTimer(); main().innerHTML = `<div class="vk-head"><h2>Verkostung</h2></div><p class="empty">${esc(fehlertext(error))}</p><p class="empty"><a href="verkostung.html">Zur Übersicht</a></p>`; return; }
  if(g && !data.ich){ lsSet(gastKey(), null); }   // Schlüssel passt nicht (mehr) – neu beitreten
  gData = data;
  gastZeigen();
  if(data.verkostung.status !== "abgeschlossen") { if(!timer) startTimer(()=>gastLaden(true)); } else stopTimer();
}

function gastZeigen(){
  const d = gData, v = d.verkostung, ich = d.ich, offen = !v.blind || v.status === "abgeschlossen";
  const meine = new Map((ich?.bewertungen||[]).map(b=>[b.probe_id,b]));
  let h = `<div class="vk-head">
      <div><p class="kicker">Verkostung</p><h2>${esc(v.titel)}</h2>
      <p class="hint">${esc([fmtDateLong(v.datum), v.ort].filter(Boolean).join(" · "))}${v.blind?" · blind":""} · ${d.teilnehmer} Teilnehmer</p></div>
      ${statusTag(v.status)}
    </div>`;

  if(!ich && v.status !== "abgeschlossen"){
    h += `<form id="joinForm" class="vk-card stack" novalidate>
        <h3>Mitmachen</h3>
        <p class="hint">Gib deinen Namen ein. Er ist nur für die Braumeister sichtbar und gilt nur für diesen Abend.</p>
        <label class="f" for="j_name">Dein Name<input id="j_name" maxlength="40" autocomplete="given-name" required></label>
        <span class="err" id="joinErr"></span>
        <button class="btn primary" type="submit" id="joinBtn" style="align-self:flex-start">Los geht’s</button>
      </form>`;
  } else if(ich){
    h += `<p class="hint">Du bist dabei als <b>${esc(ich.name)}</b>. <button class="linkbtn" id="notMe">Nicht du?</button></p>`;
  }

  if(v.status === "vorbereitung"){
    h += `<div class="vk-card"><h3>Gleich geht’s los</h3><p class="hint">Sobald die Braumeister die Verkostung starten, kannst du hier die Biere bewerten. Die Seite aktualisiert sich von selbst.</p>
      ${offen && d.proben.length ? `<ul class="plain">${d.proben.map(p=>`<li><b>${p.nummer}.</b> ${esc(p.bier.name)} <small class="hint">${esc(bierZeile(p.bier))}</small></li>`).join("")}</ul>` : d.proben.length?`<p class="hint">${d.proben.length} Biere stehen bereit – welche, wird erst am Ende verraten.</p>`:""}
    </div>`;
    if(ich){
      h += `<form id="vsForm" class="vk-card stack" novalidate>
        <h3>Bier mitgebracht?</h3>
        <p class="hint">Schlag es vor – die Braumeister nehmen es dann in die Runde auf.</p>
        <label class="f" for="vs_name">Name des Biers<input id="vs_name" maxlength="80" required></label>
        <div class="grid2"><label class="f" for="vs_br">Brauerei<input id="vs_br" maxlength="80"></label>
        <label class="f" for="vs_stil">Bierstil<input id="vs_stil" maxlength="60" list="stilListe"></label></div>
        <datalist id="stilListe">${stile.map(s=>`<option value="${esc(s.name)}">`).join("")}</datalist>
        <span class="err" id="vsErr"></span>
        <button class="btn" type="submit" id="vsBtn" style="align-self:flex-start">Vorschlagen</button>
        ${(ich.vorschlaege||[]).length?`<ul class="plain">${ich.vorschlaege.map(x=>`<li>${esc(x.name)} <small class="hint">${esc({offen:"wartet",uebernommen:"ist dabei",abgelehnt:"nicht dabei"}[x.status])}</small></li>`).join("")}</ul>`:""}
      </form>`;
    }
  }

  if(v.status === "laeuft" && ich){
    const fertig = d.proben.filter(p=>meine.has(p.id)).length;
    h += sec(`Deine Bewertungen · ${fertig} von ${d.proben.length}`, `<div class="proben">${d.proben.map(p=>{
      const m = meine.get(p.id);
      return `<button class="probe${m?" done":""}" data-p="${esc(p.id)}">
        <span class="pn num">${p.nummer}</span>
        <span class="pt"><b>${offen?esc(p.bier.name):"Probe "+p.nummer}</b><small>${offen?esc(bierZeile(p.bier)):"blind"}</small></span>
        <span class="pg">${m?`<b class="num">${m.note}</b>`:"bewerten"}</span>
      </button>`;}).join("")}</div>`);
  }

  if(v.status !== "vorbereitung" && d.proben.length){
    const zeilen = d.proben.map(p=>({id:p.id, nummer:p.nummer, titel: offen ? p.bier.name : "Probe "+p.nummer,
      unter: offen ? bierZeile(p.bier) : "", schnitt:p.schnitt, anzahl:p.anzahl, nochmal:p.nochmal}));
    h += sec(v.status==="abgeschlossen" ? "Ergebnis" : "Zwischenstand (live)", rangTabelle(zeilen)
      + (v.status==="laeuft" ? `<p class="hint">Aktualisiert sich alle 15 Sekunden.${v.blind?" Die Namen werden am Ende aufgedeckt.":""}</p>` : ""));
  }
  if(v.status === "abgeschlossen" && !ich) h += `<p class="hint">Diese Verkostung ist abgeschlossen.</p>`;
  main().innerHTML = h;

  const jf = $("#joinForm");
  if(jf){
    const g = lsGet("kb_gastname"); if(g) $("#j_name").value = g;
    jf.onsubmit = async e => { e.preventDefault();
      const name = $("#j_name").value.trim();
      if(!name){ $("#joinErr").textContent = "Bitte deinen Namen eingeben."; return; }
      $("#joinBtn").disabled = true;
      const {data, error} = await sb.rpc("vk_beitreten", {p_code: code, p_name: name});
      if(error){ $("#joinBtn").disabled = false; $("#joinErr").textContent = fehlertext(error); return; }
      lsSet(gastKey(), JSON.stringify({token: data.token, name: data.name})); lsSet("kb_gastname", data.name);
      toast("Willkommen, "+data.name+"!"); gastLaden();
    };
  }
  const nm = $("#notMe");
  if(nm) nm.onclick = () => { lsSet(gastKey(), null); gastLaden(); };
  const vf = $("#vsForm");
  if(vf) vf.onsubmit = async e => { e.preventDefault();
    const name = $("#vs_name").value.trim();
    if(!name){ $("#vsErr").textContent = "Bitte den Namen des Biers eingeben."; return; }
    $("#vsBtn").disabled = true;
    const {error} = await sb.rpc("vk_vorschlagen", {p_code: code, p_token: gast().token, p_name: name, p_brauerei: $("#vs_br").value.trim()||null, p_stil: $("#vs_stil").value.trim()||null});
    $("#vsBtn").disabled = false;
    if(error){ $("#vsErr").textContent = fehlertext(error); return; }
    toast("Danke, ist vorgeschlagen"); gastLaden();
  };
  main().querySelectorAll(".probe[data-p]").forEach(b => b.onclick = () => bogen(b.dataset.p));
}

/* Bewertungsbogen */
function bogen(probeId){
  const d = gData, p = d.proben.find(x=>x.id===probeId); if(!p) return;
  const offen = !d.verkostung.blind || d.verkostung.status === "abgeschlossen";
  const alt = (d.ich.bewertungen||[]).find(b=>b.probe_id===probeId) || {};
  const f = { note: alt.note ?? null, merkmale: {...(alt.merkmale||{})}, geruch: new Set(alt.geruch||[]), fehler: new Set(alt.fehler||[]), nochmal: alt.nochmal ?? null };
  const regler = ([k,label,l,r]) => {
    const has = f.merkmale[k] != null;
    return `<div class="sl${has?"":" unset"}" data-k="${k}">
      <div class="sl-top"><span>${esc(label)}</span><output id="o_${k}" class="num">${has?f.merkmale[k]:"–"}</output></div>
      <input type="range" min="0" max="10" step="1" id="r_${k}" value="${has?f.merkmale[k]:5}" aria-label="${esc(label)}: ${esc(l)} bis ${esc(r)}">
      <div class="sl-ends"><span>${esc(l)}</span><span>${esc(r)}</span></div>
    </div>`;
  };
  const chips = (liste, set, art) => `<div class="tagpick">${liste.map(t=>`<button type="button" class="chip" data-art="${art}" data-t="${esc(t)}" aria-pressed="${set.has(t)}">${esc(t)}</button>`).join("")}</div>`;
  const body = `<form id="bogen" novalidate>
    ${offen?`<p class="hint">${esc(bierZeile(p.bier))}</p>`:""}
    <fieldset><legend>Gesamtnote *</legend>
      <div class="scale" role="radiogroup" aria-label="Gesamtnote von 0 bis 10">${Array.from({length:11},(_,i)=>`<button type="button" role="radio" aria-checked="${f.note===i}" data-n="${i}">${i}</button>`).join("")}</div>
      <div class="sl-ends"><span>0 = gar nicht</span><span>10 = großartig</span></div>
    </fieldset>
    <fieldset><legend>Würdest du es nochmal trinken?</legend>
      <div class="yn"><button type="button" data-yn="true" aria-pressed="${f.nochmal===true}">Ja</button><button type="button" data-yn="false" aria-pressed="${f.nochmal===false}">Nein</button></div>
    </fieldset>
    <label class="f" for="b_kom">Was fällt dir auf? (optional)<textarea id="b_kom" maxlength="1000">${esc(alt.kommentar||"")}</textarea></label>
    <p class="hint">Alles Weitere ist freiwillig – beschreib das Bier, so genau du magst.</p>
    ${MERKMALE.map(([grp, liste]) => `<details class="grp"${grp!=="Geschmack"&&!liste.some(x=>f.merkmale[x[0]]!=null)&&!(grp==="Geruch"&&f.geruch.size)?"":" open"}><summary>${esc(grp)}</summary>
      ${liste.map(regler).join("")}
      ${grp==="Geruch"?chips(GERUCH,f.geruch,"geruch"):""}
    </details>`).join("")}
    <details class="grp"${f.fehler.size?" open":""}><summary>Fehlaromen</summary>${chips(FEHLER,f.fehler,"fehler")}</details>
  </form>`;
  sheet(offen ? `${p.nummer}. ${p.bier.name}` : `Probe ${p.nummer}`, body,
    `<span class="err" id="bErr"></span><span class="spacer"></span><button class="btn" id="bAbbr">Abbrechen</button><button class="btn primary" id="bSave">Speichern</button>`);
  const form = $("#bogen");
  form.querySelectorAll(".scale button").forEach(b => b.onclick = () => { f.note = +b.dataset.n; $("#bErr").textContent = ""; form.querySelectorAll(".scale button").forEach(x=>x.setAttribute("aria-checked", String(x===b))); });
  form.querySelectorAll(".yn button").forEach(b => b.onclick = () => { const v = b.dataset.yn==="true"; f.nochmal = f.nochmal===v ? null : v; form.querySelectorAll(".yn button").forEach(x=>x.setAttribute("aria-pressed", String(f.nochmal!==null && (x.dataset.yn==="true")===f.nochmal))); });
  form.querySelectorAll(".sl input").forEach(r => r.addEventListener("input", () => { const k = r.id.slice(2); f.merkmale[k] = +r.value; $("#o_"+k).textContent = r.value; r.closest(".sl").classList.remove("unset"); }));
  form.querySelectorAll(".tagpick .chip").forEach(c => c.onclick = () => { const s = c.dataset.art==="geruch" ? f.geruch : f.fehler; const t = c.dataset.t; s.has(t) ? s.delete(t) : s.add(t); c.setAttribute("aria-pressed", String(s.has(t))); });
  $("#bAbbr").onclick = closeSheet;
  $("#bSave").onclick = async () => {
    if(f.note == null){ $("#bErr").textContent = "Bitte eine Gesamtnote wählen."; form.querySelector(".scale button")?.focus(); return; }
    $("#bSave").disabled = true; $("#bErr").textContent = "";
    const {error} = await sb.rpc("vk_bewerten", {p_code: code, p_token: gast().token, p_probe: probeId, p_note: f.note, p_merkmale: f.merkmale,
      p_geruch: [...f.geruch], p_fehler: [...f.fehler], p_nochmal: f.nochmal, p_kommentar: $("#b_kom").value.trim() || null});
    if(error){ $("#bSave").disabled = false; $("#bErr").textContent = fehlertext(error); return; }
    closeSheet(); toast("Gespeichert"); gastLaden();
  };
}

/* =========================================================================
   Übersicht (ohne Parameter)
   ========================================================================= */
async function listeLaden(){
  stopTimer();
  let h = `<div class="vk-head"><div><h2>Verkostungen</h2><p class="hint">Biere nebeneinander probieren, bewerten und am Ende das Ranking aufdecken.</p></div>
    ${isBM()?`<div class="top-actions"><button class="btn" id="bierBtn">Biere</button><button class="btn primary" id="neuBtn">+ Neue Verkostung</button></div>`:""}</div>
    <form id="codeForm" class="vk-card codebox" novalidate>
      <label class="f" for="c_code">Code von der Einladung<input id="c_code" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="z. B. k7m2p9qx4a"></label>
      <button class="btn" type="submit">Mitmachen</button>
    </form>`;
  if(isBM()){
    const {data, error} = await sb.from("verkostungen").select("id,titel,datum,ort,blind,status,proben(count),teilnehmer(count)").order("datum",{ascending:false}).order("angelegt",{ascending:false});
    if(error) h += `<p class="empty">${esc(fehlertext(error))}</p>`;
    else if(!data.length) h += `<p class="empty">Noch keine Verkostung angelegt. Leg mit „+ Neue Verkostung“ die erste an.</p>`;
    else h += `<div class="vk-list">${data.map(v=>`<a class="vk-item" href="verkostung.html?id=${esc(v.id)}">
        <span class="d num">${esc(fmtDateLong(v.datum))}</span>
        <span class="t"><b>${esc(v.titel)}</b><small>${esc([v.ort, (v.proben[0]?.count||0)+" Biere", (v.teilnehmer[0]?.count||0)+" Teilnehmer", v.blind?"blind":""].filter(Boolean).join(" · "))}</small></span>
        ${statusTag(v.status)}</a>`).join("")}</div>`;
  } else {
    const {data, error} = await sb.rpc("vk_archiv");
    if(error) h += `<p class="empty">${esc(fehlertext(error))}</p>`;
    else if(!data.length) h += `<p class="empty">Noch keine abgeschlossenen Verkostungen.</p>`;
    else h += data.map(v => `<section class="vk-card"><div class="vk-head small"><div><h3>${esc(v.titel)}</h3>
        <p class="hint">${esc([fmtDateLong(v.datum), v.ort, v.teilnehmer+" Teilnehmer"].filter(Boolean).join(" · "))}</p></div></div>
        ${rangTabelle(v.proben.map(p=>({nummer:p.nummer, titel:p.name, unter:bierZeile(p), schnitt:p.schnitt, anzahl:p.anzahl, nochmal:p.nochmal})))}</section>`).join("");
  }
  main().innerHTML = h;
  $("#codeForm").onsubmit = e => { e.preventDefault(); const c = $("#c_code").value.trim().toLowerCase().replace(/.*[?&]v=/, "").replace(/[^a-z0-9]/g, ""); if(c) location.href = "verkostung.html?v="+encodeURIComponent(c); };
  if(isBM()){ $("#neuBtn").onclick = () => vkForm(null); $("#bierBtn").onclick = bierKatalog; }
}

function vkForm(v){
  sheet(v ? "Verkostung bearbeiten" : "Neue Verkostung", `<form id="vkForm" class="stack" novalidate>
      <label class="f" for="v_titel">Titel<input id="v_titel" maxlength="100" value="${esc(v?.titel||"")}" placeholder="z. B. Herbstverkostung 2026" required></label>
      <div class="grid2"><label class="f" for="v_datum">Datum<input id="v_datum" type="date" value="${esc(v?.datum||KB.todayIso())}"></label>
      <label class="f" for="v_ort">Ort<input id="v_ort" maxlength="100" value="${esc(v?.ort||"")}"></label></div>
      <label class="check"><input type="checkbox" id="v_blind"${v?.blind?" checked":""}><span><b>Blind verkosten</b><br><span class="hint">Gäste sehen nur Probennummern; die Biere werden beim Abschließen aufgedeckt.</span></span></label>
      <span class="err" id="vErr"></span>
    </form>`,
    `<span class="spacer"></span><button class="btn" id="vAbbr">Abbrechen</button><button class="btn primary" id="vSave" form="vkForm" type="submit">${v?"Speichern":"Anlegen"}</button>`);
  $("#vAbbr").onclick = closeSheet;
  $("#vkForm").onsubmit = async e => { e.preventDefault();
    const out = {titel: $("#v_titel").value.trim(), datum: $("#v_datum").value || KB.todayIso(), ort: $("#v_ort").value.trim() || null, blind: $("#v_blind").checked};
    if(!out.titel){ $("#vErr").textContent = "Bitte einen Titel eingeben."; return; }
    $("#vSave").disabled = true;
    const q = v ? sb.from("verkostungen").update(out).eq("id", v.id) : sb.from("verkostungen").insert(out);
    const {data, error} = await q.select("id").single();
    if(error){ $("#vSave").disabled = false; $("#vErr").textContent = fehlertext(error); return; }
    closeSheet();
    if(v){ toast("Gespeichert"); detailLaden(); } else location.href = "verkostung.html?id="+data.id;
  };
}

/* =========================================================================
   Braumeister-Ansicht einer Verkostung (?id=)
   ========================================================================= */
let D = null; // {v, proben, teilnehmer, bewertungen, vorschlaege}

async function detailLaden(){
  if(!isBM()){ stopTimer(); main().innerHTML = `<p class="empty">Diese Ansicht ist nur für angemeldete Braumeister.</p><p class="empty"><a href="verkostung.html">Zur Übersicht</a></p>`; return; }
  const [v, pr, tn, vs] = await Promise.all([
    sb.from("verkostungen").select("*").eq("id", detailId).maybeSingle(),
    sb.from("proben").select("id,nummer,bier_id,biere(id,name,brauerei,eigen,alkohol,stil_id,sud_id,bierstile(name))").eq("verkostung_id", detailId).order("nummer"),
    sb.from("teilnehmer").select("id,name,angelegt").eq("verkostung_id", detailId).order("angelegt"),
    sb.from("vorschlaege").select("*").eq("verkostung_id", detailId).order("angelegt"),
  ]);
  if(v.error || !v.data){ stopTimer(); main().innerHTML = `<p class="empty">${v.error?esc(fehlertext(v.error)):"Diese Verkostung gibt es nicht (mehr)."}</p><p class="empty"><a href="verkostung.html">Zur Übersicht</a></p>`; return; }
  const ids = (pr.data||[]).map(p=>p.id);
  const bw = ids.length ? await sb.from("bewertungen").select("*").in("probe_id", ids) : {data: []};
  D = {v: v.data, proben: (pr.data||[]).map(p=>({...p, bier: {...p.biere, stil: p.biere?.bierstile?.name}})), teilnehmer: tn.data||[], bewertungen: bw.data||[], vorschlaege: vs.data||[]};
  detailZeigen();
  if(D.v.status === "laeuft") { if(!timer) startTimer(detailLaden); } else stopTimer();
}

function auswertung(probeId){
  const alle = D.bewertungen.filter(b=>b.probe_id===probeId && !b.ausgeblendet);
  const n = alle.length;
  return { anzahl: n, schnitt: n ? Math.round(alle.reduce((a,b)=>a+b.note,0)/n*100)/100 : null, nochmal: alle.filter(b=>b.nochmal).length, alle };
}

function detailZeigen(){
  const {v, proben, teilnehmer, bewertungen, vorschlaege} = D;
  const link = gastLink(v.code);
  const offeneVs = vorschlaege.filter(x=>x.status==="offen");
  const tnName = id => teilnehmer.find(t=>t.id===id)?.name || "Gast";
  let aktion = "";
  if(v.status==="vorbereitung") aktion = `<button class="btn primary" id="stStart"${proben.length?"":" disabled title=\"Erst Biere hinzufügen\""}>Verkostung starten</button>`;
  if(v.status==="laeuft") aktion = `<button class="btn primary" id="stEnde">Abschließen und aufdecken</button>`;
  if(v.status==="abgeschlossen") aktion = `<button class="btn" id="stWieder">Wieder öffnen</button>`;
  let h = `<p><a class="back" href="verkostung.html">← Alle Verkostungen</a></p>
    <div class="vk-head"><div><p class="kicker">Verkostung</p><h2>${esc(v.titel)}</h2>
      <p class="hint">${esc([fmtDateLong(v.datum), v.ort, v.blind?"blind":"offen", teilnehmer.length+" Teilnehmer"].filter(Boolean).join(" · "))}</p></div>
      ${statusTag(v.status)}</div>
    <div class="top-actions">${aktion}<button class="btn" id="vkEdit">Bearbeiten</button>${isAdmin()?`<button class="btn danger" id="vkDel">Löschen</button>`:""}</div>
    <div class="vk-grid">
      <section class="vk-card qrbox"><h3>Einladung</h3>
        <div class="qr" id="qrKlein">${QR.svg(link)}</div>
        <p class="num linktext">${esc(link)}</p>
        <div class="top-actions"><button class="btn" id="qrGross">Groß zeigen</button><button class="btn" id="copyLink">Link kopieren</button><a class="btn" href="${esc(link)}" target="_blank" rel="noopener">Selbst mitbewerten</a></div>
        <p class="hint">${v.status==="abgeschlossen"?"Die Verkostung ist abgeschlossen – über den Link sieht man jetzt das Ergebnis.":"Der Code gilt nur für diese Verkostung. Nach dem Abschließen kann niemand mehr beitreten oder bewerten."}</p>
      </section>
      <section class="vk-card"><h3>Biere (${proben.length})</h3>
        ${proben.length?`<ol class="plist">${proben.map((p,i)=>{const n=bewertungen.filter(b=>b.probe_id===p.id).length;return `<li>
          <span class="pn num">${p.nummer}</span>
          <span class="pt"><b>${esc(p.bier.name)}</b><small>${esc(bierZeile(p.bier))}${p.bier.eigen&&!/kolding/i.test(p.bier.brauerei||"")?" · selbst gebraut":""}</small></span>
          <span class="pa">${n?`<small class="hint">${n} Bew.</small>`:""}
            <button class="x" data-up="${i}" aria-label="Nach oben"${i===0?" disabled":""}>↑</button><button class="x" data-down="${i}" aria-label="Nach unten"${i===proben.length-1?" disabled":""}>↓</button><button class="x" data-raus="${esc(p.id)}" aria-label="Aus der Verkostung nehmen">✕</button></span>
        </li>`;}).join("")}</ol>`:`<p class="hint">Noch keine Biere. Etwa sechs sind ideal.</p>`}
        <button type="button" class="add" id="addBier">+ Bier hinzufügen</button>
        ${offeneVs.length?`<div class="vs"><h4>Vorschläge von Gästen</h4>${offeneVs.map(x=>`<div class="vs-row"><span><b>${esc(x.name)}</b><small class="hint">${esc([x.brauerei,x.stil,"von "+tnName(x.teilnehmer_id)].filter(Boolean).join(" · "))}</small></span>
          <span><button class="btn" data-vs-ok="${esc(x.id)}">Übernehmen</button><button class="btn ghost" data-vs-no="${esc(x.id)}">Ablehnen</button></span></div>`).join("")}</div>`:""}
      </section>
    </div>`;

  const zeilen = proben.map(p=>{const a=auswertung(p.id);return {id:p.id, nummer:p.nummer, titel:`${p.nummer}. ${p.bier.name}`, unter:bierZeile(p.bier), schnitt:a.schnitt, anzahl:a.anzahl, nochmal:a.nochmal};});
  h += sec(v.status==="abgeschlossen" ? "Ergebnis" : v.status==="laeuft" ? "Zwischenstand (live)" : "Auswertung", (bewertungen.length ? rangTabelle(zeilen,{klick:true}) + `<p class="hint">Antippen zeigt alle Bewertungen und das Geschmacksprofil.${v.status==="laeuft"?" Aktualisiert sich alle 15 Sekunden.":""}</p>` : `<p class="hint">Noch keine Bewertungen.</p>`));
  if(teilnehmer.length) h += sec("Teilnehmer", `<div class="tn">${teilnehmer.map(t=>{const n=bewertungen.filter(b=>b.teilnehmer_id===t.id).length;return `<span class="tag">${esc(t.name)} · ${n}/${proben.length}</span>`;}).join("")}</div>`);
  main().innerHTML = h;

  const setStatus = async s => { const {error} = await sb.from("verkostungen").update({status: s}).eq("id", v.id); if(error){ toast(fehlertext(error)); return; } toast({laeuft:"Verkostung läuft",abgeschlossen:"Abgeschlossen – Ergebnis ist aufgedeckt",vorbereitung:"Zurück in Vorbereitung"}[s]); detailLaden(); };
  $("#stStart") && ($("#stStart").onclick = () => setStatus("laeuft"));
  $("#stEnde") && ($("#stEnde").onclick = () => bestaetigen("Verkostung abschließen?", "Danach kann niemand mehr bewerten, und das Ergebnis erscheint öffentlich in der Liga und bei den Verkostungen.", "Abschließen", () => setStatus("abgeschlossen")));
  $("#stWieder") && ($("#stWieder").onclick = () => bestaetigen("Wieder öffnen?", "Die Gäste können dann wieder bewerten. Das Ergebnis verschwindet so lange aus der öffentlichen Liga.", "Wieder öffnen", () => setStatus("laeuft")));
  $("#vkEdit").onclick = () => vkForm(v);
  $("#vkDel") && ($("#vkDel").onclick = () => bestaetigen("Verkostung löschen?", `„${v.titel}“ mit allen ${bewertungen.length} Bewertungen wird endgültig gelöscht. Die Biere selbst bleiben erhalten.`, "Endgültig löschen", async () => {
    const {data, error} = await sb.from("verkostungen").delete().eq("id", v.id).select("id");
    if(error || !data?.length){ toast(error ? fehlertext(error) : "Löschen ist nur dem Admin erlaubt."); return; }
    location.href = "verkostung.html";
  }, true));
  $("#qrGross").onclick = () => {
    sheet(v.titel, `<div class="qr gross">${QR.svg(link)}</div><p class="num linktext" style="text-align:center">${esc(link)}</p><p class="hint" style="text-align:center">Mit der Handykamera scannen und mitmachen.</p>`, `<span class="spacer"></span><button class="btn" id="qrZu">Schließen</button>`);
    $("#qrZu").onclick = closeSheet;
  };
  $("#copyLink").onclick = async () => { try{ await navigator.clipboard.writeText(link); toast("Link kopiert"); }catch(_){ toast("Kopieren ging nicht – bitte den Link markieren"); } };
  $("#addBier").onclick = () => bierWaehlen();
  main().querySelectorAll("[data-up],[data-down]").forEach(b => b.onclick = () => { const i = +(b.dataset.up ?? b.dataset.down); tauschen(i, b.dataset.up != null ? i-1 : i+1); });
  main().querySelectorAll("[data-raus]").forEach(b => b.onclick = () => {
    const p = proben.find(x=>x.id===b.dataset.raus), n = bewertungen.filter(x=>x.probe_id===p.id).length;
    bestaetigen(`„${p.bier.name}“ herausnehmen?`, n ? `Dabei gehen ${n} Bewertungen für dieses Bier verloren.` : "Das Bier bleibt in der Bierliste und kann später wieder hinzugefügt werden.", "Herausnehmen", async () => {
      const {error} = await sb.from("proben").delete().eq("id", p.id);
      if(error){ toast(fehlertext(error)); return; }
      const rest = D.proben.filter(x=>x.id!==p.id);
      await neuNummerieren(rest); toast("Herausgenommen"); detailLaden();
    }, true);
  });
  main().querySelectorAll("[data-vs-ok]").forEach(b => b.onclick = () => { const x = vorschlaege.find(y=>y.id===b.dataset.vsOk); bierForm(null, {name:x.name, brauerei:x.brauerei, stilName:x.stil, vorschlag:x.id}); });
  main().querySelectorAll("[data-vs-no]").forEach(b => b.onclick = async () => { const {error} = await sb.from("vorschlaege").update({status:"abgelehnt"}).eq("id", b.dataset.vsNo); if(error) toast(fehlertext(error)); detailLaden(); });
  main().querySelectorAll(".rank li[data-id]").forEach(li => { const f = () => probeDetail(li.dataset.id); li.onclick = f; li.onkeydown = e => { if(e.key==="Enter"||e.key===" "){ e.preventDefault(); f(); } }; });
}

function bestaetigen(titel, text, knopf, ok, gefahr){
  sheet(titel, `<p>${esc(text)}</p>`, `<span class="spacer"></span><button class="btn" id="bNein">Abbrechen</button><button class="btn ${gefahr?"danger":"primary"}" id="bJa">${esc(knopf)}</button>`);
  $("#bNein").onclick = closeSheet;
  $("#bJa").onclick = async () => { $("#bJa").disabled = true; closeSheet(); await ok(); };
}

async function neuNummerieren(liste){
  const rows = liste.map((p,i)=>({id:p.id, verkostung_id:D.v.id, bier_id:p.bier_id, nummer:i+1})).filter((r,i)=>liste[i].nummer!==r.nummer);
  if(!rows.length) return;
  const {error} = await sb.from("proben").upsert(rows);
  if(error) toast(fehlertext(error));
}
async function tauschen(i, j){
  const l = D.proben.slice(); [l[i], l[j]] = [l[j], l[i]];
  await neuNummerieren(l); detailLaden();
}

/* Detail einer Probe: alle Bewertungen, Profil, Ausblenden */
function probeDetail(probeId){
  const p = D.proben.find(x=>x.id===probeId); if(!p) return;
  const alle = D.bewertungen.filter(b=>b.probe_id===probeId).sort((a,b)=>b.note-a.note);
  const sichtbar = alle.filter(b=>!b.ausgeblendet);
  const tn = id => D.teilnehmer.find(t=>t.id===id)?.name || "Gast";
  const profil = MERKMALE.flatMap(([,l])=>l).map(([k,label,l,r])=>{
    const w = sichtbar.map(b=>b.merkmale?.[k]).filter(x=>x!=null);
    if(!w.length) return "";
    const m = w.reduce((a,x)=>a+x,0)/w.length;
    return `<div class="pf"><span class="pf-l">${esc(l)}</span><span class="pf-t"><i style="left:${m*10}%"></i></span><span class="pf-r">${esc(r)}</span><small class="pf-n">${esc(label)} · ${w.length}×</small></div>`;
  }).join("");
  const zaehle = feld => { const c = new Map(); sichtbar.forEach(b=>(b[feld]||[]).forEach(t=>c.set(t,(c.get(t)||0)+1))); return [...c].sort((a,b)=>b[1]-a[1]).map(([t,n])=>`<span class="tag">${esc(t)} ${n}×</span>`).join(" "); };
  const a = auswertung(probeId);
  const body = `<p class="hint">${esc(bierZeile(p.bier))}</p>
    <div class="stats mini"><div class="stat"><b class="num">${note(a.schnitt)}</b><span>Ø Gesamtnote</span></div><div class="stat"><b class="num">${a.anzahl}</b><span>Bewertungen</span></div><div class="stat"><b class="num">${a.anzahl?Math.round(a.nochmal/a.anzahl*100):0} %</b><span>würden nochmal</span></div></div>
    ${sec("Geschmacksprofil", profil)}
    ${sec("Geruch", zaehle("geruch"))}
    ${sec("Fehlaromen", zaehle("fehler"))}
    ${sec("Einzelne Bewertungen", alle.length ? `<div class="bw">${alle.map(b=>`<div class="bw-row${b.ausgeblendet?" aus":""}">
      <span class="grade">${b.note}</span>
      <span class="bw-t"><b>${esc(tn(b.teilnehmer_id))}</b>${b.nochmal===true?" · nochmal: ja":b.nochmal===false?" · nochmal: nein":""}${b.kommentar?`<span class="note">${esc(b.kommentar)}</span>`:""}</span>
      <button class="btn ghost" data-aus="${esc(b.id)}">${b.ausgeblendet?"Einblenden":"Ausblenden"}</button></div>`).join("")}</div>
      <p class="hint">Ausgeblendete Bewertungen zählen nicht fürs Ranking und die Liga.</p>` : "")}`;
  sheet(`${p.nummer}. ${p.bier.name}`, body, `<span class="spacer"></span><button class="btn" id="pdZu">Schließen</button>`);
  $("#pdZu").onclick = closeSheet;
  $("#sheetBody").querySelectorAll("[data-aus]").forEach(btn => btn.onclick = async () => {
    const b = D.bewertungen.find(x=>x.id===btn.dataset.aus);
    btn.disabled = true;
    const {error} = await sb.from("bewertungen").update({ausgeblendet: !b.ausgeblendet}).eq("id", b.id);
    if(error){ btn.disabled = false; toast(fehlertext(error)); return; }
    b.ausgeblendet = !b.ausgeblendet; probeDetail(probeId); detailZeigen();
  });
}

/* Bier zur Verkostung hinzufügen: aus der Bierliste wählen oder neu anlegen */
async function bierWaehlen(){
  const {data, error} = await sb.from("biere").select("id,name,brauerei,eigen,alkohol,bierstile(name)").order("name");
  if(error){ toast(fehlertext(error)); return; }
  const schon = new Set(D.proben.map(p=>p.bier_id));
  const liste = (data||[]).filter(b=>!schon.has(b.id));
  const zeile = b => `<button class="pick" data-b="${esc(b.id)}" data-s="${esc((b.name+" "+(b.brauerei||"")+" "+(b.bierstile?.name||"")).toLowerCase())}"><b>${esc(b.name)}</b><small>${esc(bierZeile({...b, stil:b.bierstile?.name}))}</small></button>`;
  sheet("Bier hinzufügen", `<button class="btn primary" id="neuesBier" style="align-self:flex-start">+ Neues Bier anlegen</button>
    ${liste.length?`<input class="search" id="bSuche" type="search" placeholder="In der Bierliste suchen …" aria-label="Bierliste durchsuchen"><div class="picklist" id="pickList">${liste.map(zeile).join("")}</div>`:`<p class="hint">Die Bierliste ist noch leer – leg das erste Bier an.</p>`}`,
    `<span class="spacer"></span><button class="btn" id="bwZu">Abbrechen</button>`);
  $("#bwZu").onclick = closeSheet;
  $("#neuesBier").onclick = () => bierForm(null, {});
  const s = $("#bSuche"); if(s) s.oninput = () => { const q = s.value.trim().toLowerCase(); $("#pickList").querySelectorAll(".pick").forEach(p => p.hidden = q && !p.dataset.s.includes(q)); };
  $("#sheetBody").querySelectorAll(".pick").forEach(p => p.onclick = async () => { p.disabled = true; await probeAnlegen(p.dataset.b); closeSheet(); detailLaden(); });
}
async function probeAnlegen(bierId){
  const nr = Math.max(0, ...D.proben.map(p=>p.nummer)) + 1;
  const {error} = await sb.from("proben").insert({verkostung_id: D.v.id, bier_id: bierId, nummer: nr});
  if(error) toast(error.code==="23505" ? "Dieses Bier ist schon dabei." : fehlertext(error)); else toast("Bier hinzugefügt");
}

/* Bier anlegen oder bearbeiten. vorgabe: {name, brauerei, stilName, vorschlag} */
async function bierForm(bier, vorgabe, nachher){
  await ladeStile();
  const {data: sude} = await sb.from("sude").select("id,nr,stil,datum").order("datum", {ascending:false});
  const b = bier || {name: vorgabe.name||"", brauerei: vorgabe.brauerei||"", eigen: false, stil_id: (stile.find(s=>s.name.toLowerCase()===(vorgabe.stilName||"").toLowerCase())||{}).id ?? null, alkohol: null, sud_id: null, notiz: ""};
  sheet(bier ? "Bier bearbeiten" : "Neues Bier", `<form id="bierForm" class="stack" novalidate>
      <label class="f" for="bi_name">Name *<input id="bi_name" maxlength="80" value="${esc(b.name)}" required></label>
      <label class="check"><input type="checkbox" id="bi_eigen"${b.eigen?" checked":""}><span><b>Selbst gebraut (Koldingbräu)</b></span></label>
      <div class="grid2">
        <label class="f" for="bi_br">Brauerei<input id="bi_br" maxlength="80" value="${esc(b.brauerei||"")}"></label>
        <label class="f" for="bi_alk">Alkohol (% Vol.)<input id="bi_alk" type="number" step="0.1" min="0" max="30" inputmode="decimal" value="${esc(b.alkohol??"")}"></label>
        <label class="f" for="bi_stil">Bierstil<select id="bi_stil"><option value="">– bitte wählen –</option>${stile.map(s=>`<option value="${s.id}"${s.id===b.stil_id?" selected":""}>${esc(s.name)}</option>`).join("")}${isAdmin()?`<option value="neu">+ Neuer Stil …</option>`:""}</select></label>
        <label class="f" for="bi_sud" id="sudWrap"${b.eigen?"":" hidden"}>Zugehöriger Sud<select id="bi_sud"><option value="">–</option>${(sude||[]).map(s=>`<option value="${s.id}"${s.id===b.sud_id?" selected":""}>Nr. ${esc(s.nr)} · ${esc(s.stil||"")} · ${esc(fmtDateLong(s.datum))}</option>`).join("")}</select></label>
      </div>
      <label class="f" for="bi_neustil" id="neuStilWrap" hidden>Name des neuen Stils<input id="bi_neustil" maxlength="60"></label>
      <label class="f" for="bi_notiz">Notiz (intern)<textarea id="bi_notiz" maxlength="1000">${esc(b.notiz||"")}</textarea></label>
      <span class="err" id="biErr"></span>
    </form>`,
    `<span class="spacer"></span><button class="btn" id="biAbbr">Abbrechen</button><button class="btn primary" id="biSave" form="bierForm" type="submit">${bier?"Speichern":D&&!nachher?"Anlegen und hinzufügen":"Anlegen"}</button>`);
  $("#biAbbr").onclick = closeSheet;
  $("#bi_eigen").onchange = () => { $("#sudWrap").hidden = !$("#bi_eigen").checked; if($("#bi_eigen").checked && !$("#bi_br").value.trim()) $("#bi_br").value = "Koldingbräu"; };
  $("#bi_stil").onchange = () => { $("#neuStilWrap").hidden = $("#bi_stil").value !== "neu"; };
  $("#bierForm").onsubmit = async e => { e.preventDefault();
    const err = $("#biErr"), alk = $("#bi_alk").value;
    const out = {name: $("#bi_name").value.trim(), brauerei: $("#bi_br").value.trim() || null, eigen: $("#bi_eigen").checked,
      alkohol: alk === "" ? null : +alk, sud_id: $("#bi_eigen").checked ? ($("#bi_sud").value || null) : null, notiz: $("#bi_notiz").value.trim() || null};
    if(!out.name){ err.textContent = "Bitte einen Namen eingeben."; return; }
    if(out.alkohol != null && (isNaN(out.alkohol) || out.alkohol < 0 || out.alkohol > 30)){ err.textContent = "Alkohol bitte zwischen 0 und 30 % angeben."; return; }
    $("#biSave").disabled = true; err.textContent = "";
    let stil = $("#bi_stil").value;
    if(stil === "neu"){
      const n = $("#bi_neustil").value.trim();
      if(!n){ $("#biSave").disabled = false; err.textContent = "Bitte den Namen des neuen Stils eingeben."; return; }
      const r = await sb.from("bierstile").insert({name: n}).select("id,name,reihenfolge").single();
      if(r.error){ $("#biSave").disabled = false; err.textContent = fehlertext(r.error); return; }
      stile.push(r.data); stil = r.data.id;
    }
    out.stil_id = stil ? +stil : null;
    const q = bier ? sb.from("biere").update(out).eq("id", bier.id) : sb.from("biere").insert(out);
    const {data, error} = await q.select("id").single();
    if(error){ $("#biSave").disabled = false; err.textContent = fehlertext(error); return; }
    if(!bier && D && !nachher){
      await probeAnlegen(data.id);
      if(vorgabe.vorschlag) await sb.from("vorschlaege").update({status: "uebernommen"}).eq("id", vorgabe.vorschlag);
      closeSheet(); detailLaden(); return;
    }
    toast(bier ? "Gespeichert" : "Bier angelegt");
    if(nachher) nachher(); else closeSheet();
  };
}

/* Bierliste (alle Biere bearbeiten) */
async function bierKatalog(){
  const {data, error} = await sb.from("biere").select("id,name,brauerei,eigen,alkohol,stil_id,sud_id,notiz,bierstile(name),proben(count)").order("name");
  if(error){ toast(fehlertext(error)); return; }
  sheet("Biere", `<p class="hint">Jedes Bier gibt es nur einmal – so zählen seine Bewertungen aus allen Verkostungen zusammen in der Liga.</p>
    ${data.length ? `<div class="picklist">${data.map(b=>`<div class="pick row"><span><b>${esc(b.name)}</b><small>${esc(bierZeile({...b, stil:b.bierstile?.name}))} · ${b.proben[0]?.count||0} Verkostungen</small></span>
      <span><button class="btn ghost" data-ed="${esc(b.id)}">Bearbeiten</button>${isAdmin()?`<button class="btn ghost danger" data-del="${esc(b.id)}">Löschen</button>`:""}</span></div>`).join("")}</div>` : `<p class="hint">Noch keine Biere. Biere legst du direkt in einer Verkostung an.</p>`}`,
    `<span class="spacer"></span><button class="btn" id="kZu">Schließen</button>`);
  $("#kZu").onclick = closeSheet;
  $("#sheetBody").querySelectorAll("[data-ed]").forEach(btn => btn.onclick = () => bierForm(data.find(b=>b.id===btn.dataset.ed), {}, bierKatalog));
  $("#sheetBody").querySelectorAll("[data-del]").forEach(btn => btn.onclick = async () => {
    const b = data.find(x=>x.id===btn.dataset.del);
    if(b.proben[0]?.count){ toast("Das Bier ist in einer Verkostung – erst dort herausnehmen."); return; }
    btn.disabled = true;
    const r = await sb.from("biere").delete().eq("id", b.id).select("id");
    if(r.error || !r.data?.length){ toast(r.error ? fehlertext(r.error) : "Löschen ist nur dem Admin erlaubt."); btn.disabled = false; return; }
    toast("Bier gelöscht"); bierKatalog();
  });
}

/* ---------- Start ---------- */
KB.seite = {
  chrome(){},
  start(){
    document.addEventListener("visibilitychange", () => { if(document.visibilityState==="visible" && timer && $("#sheet").hidden) KB.seite.laden(); });
  },
  async laden(){
    if(ansicht === "gast"){ await ladeStile(); await gastLaden(); if(isBM()) bmHinweis(); }
    else if(ansicht === "detail") await detailLaden();
    else await listeLaden();
  },
};
async function bmHinweis(){
  const {data} = await sb.from("verkostungen").select("id").eq("code", code).maybeSingle();
  if(data){ const n = $("#notice"); n.hidden = false; n.innerHTML = `Du bist als Braumeister angemeldet. <a href="verkostung.html?id=${esc(data.id)}">Zur Verwaltung dieser Verkostung</a>`; }
}
})();
