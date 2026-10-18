/* Koldingbräu – Seite „Sude“ (das Braubuch)
   Übersicht, Liste, Details, Editor und CSV-Export. Anmeldung und Menü kommen aus kern.js. */
(function () {
"use strict";
const {$, esc, state, isBM, isAdmin, fmtDate, fmtDateTime, personName, todayIso, toast, sheet, openSheet, closeSheet, kv, sec, fehlertext} = KB;
const sb = new Proxy({}, {get: (_, k) => { const v = KB.sb[k]; return typeof v === "function" ? v.bind(KB.sb) : v; }});  // Client entsteht erst beim Start
// Spalten, die Gäste lesen dürfen (ohne notizen, bewertung)
const PUBLIC_COLS = "id,nr,datum,datum_geschaetzt,stil,etikett,hauptguss,nachguss,wasser,malz,maischplan,laeutern,kochzeit,wuerze,stammwuerze,hopfensorten,hopfen,hefe,hefemenge,messungen,restextrakt,ausschlag,biermenge,zucker,flaschen,alkohol,abgefuellt,oeffentlich,rezept_id";
// Spalten, die beim Speichern geschrieben werden
const WRITE_COLS = ["nr","datum","datum_geschaetzt","stil","etikett","bewertung","hauptguss","nachguss","wasser","malz","maischplan","laeutern","kochzeit","wuerze","stammwuerze","hopfensorten","hopfen","hefe","hefemenge","messungen","restextrakt","ausschlag","biermenge","zucker","flaschen","alkohol","abgefuellt","notizen","oeffentlich","rezept_id"];
const CAPS = {rot:"#c23b2b",blau:"#2f5fa8",orange:"#e5862b",silber:"#b9bec4",gruen:"#3f8a3a",gold:"#c9a227",schwarz:"#1c1c1c",weiss:"#f4f4f0",gelb:"#e8c82e"};
const CAP_LABEL = {rot:"Rot",blau:"Blau",orange:"Orange",silber:"Silber",gruen:"Grün",gold:"Gold",schwarz:"Schwarz",weiss:"Weiß",gelb:"Gelb"};
Object.assign(state, { brews: [], q: "", style: "", sort: "neu" });

/* --- Helfer --- */
function gradeVal(g){const m=String(g||"").match(/(\d)\s*([+-])?/);if(!m)return null;let v=+m[1];if(m[2]==="+")v-=.3;if(m[2]==="-")v+=.3;return v;}
function gradeCls(v){if(v==null)return"";return v<=1.7?"g1":v<=2.7?"g2":"g3";}
function ageText(iso){if(!iso)return"";const days=Math.floor((Date.now()-new Date(iso+"T12:00:00").getTime())/864e5);
  if(days<0)return"geplant";if(days<1)return"heute";if(days<14)return`vor ${days} Tag${days===1?"":"en"}`;if(days<60)return`vor ${Math.round(days/7)} Wochen`;
  const months=Math.round(days/30.44);if(months<24)return`vor ${months} Monaten`;return`vor ${(days/365.25).toFixed(1).replace(".",",")} Jahren`;}
function title(b){return b.stil||`Sud ${b.nr}`;}
function malzSum(b){return(b.malz||[]).reduce((a,m)=>a+(+m.gramm||0),0);}
function fmtKg(g){return(g/1000).toLocaleString("de-DE",{maximumFractionDigits:2})+" kg";}
function haystack(b){return JSON.stringify(b).toLowerCase();}
const Bz=window.Brau;
const TYP=Bz.HOPFEN_TYPEN;
/* Hopfengabe in die strukturierte Form bringen. Alte Einträge: {menge:"22 g Magnum", zeit:"60 min"} */
function hopfenNeu(h){
  if(!h)return{sorte:"",gramm:null,alpha:null,zeit:null,typ:"Kochen"};
  if(h.sorte!==undefined)return{sorte:h.sorte||"",gramm:h.gramm??null,alpha:h.alpha??null,zeit:h.zeit??null,typ:h.typ||"Kochen"};
  let txt=String(h.menge||"").trim(),gramm=null,alpha=null;
  const a=txt.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:α|alpha)?/i);if(a){alpha=Bz.zahl(a[1]);txt=txt.replace(a[0],"").replace(/\(\s*\)/,"").trim();}
  const m=txt.match(/^(\d+(?:[.,]\d+)?)\s*(kg|g)\b\.?\s*(.*)$/i);
  if(m){gramm=Bz.inGramm(m[1],m[2]);txt=m[3].trim();}
  const z=String(h.zeit||"");const zn=z.match(/(\d+(?:[.,]\d+)?)\s*min/i)||z.match(/^\s*(\d+(?:[.,]\d+)?)\s*$/);
  let typ=Bz.hopfenTyp(z);if(/koch|ende/i.test(z)&&typ==="Kochen"&&!zn)typ="Kochen";
  return{sorte:txt,gramm,alpha,zeit:zn?Bz.zahl(zn[1]):(/ende/i.test(z)?0:null),typ,alt:(h.menge||h.zeit)?[h.menge,h.zeit].filter(Boolean).join(" · "):undefined};
}
function hopfenLinks(h){
  if(h.sorte===undefined)return esc(h.menge||"");
  return esc([h.gramm!=null?Bz.fmtGramm(h.gramm):"",h.sorte].filter(Boolean).join(" "))+(h.alpha!=null?` <small>${esc(Bz.fmtZahl(h.alpha))} % α</small>`:"");
}
function hopfenRechts(h){
  if(h.sorte===undefined)return esc(h.zeit||"");
  if(h.typ==="Kochen")return h.zeit!=null?esc(Bz.fmtZahl(h.zeit,0))+" min":"Kochen";
  return esc(TYP[h.typ]||h.typ)+(h.typ==="Vorderwuerze"&&h.zeit!=null?` · ${esc(Bz.fmtZahl(h.zeit,0))} min`:"");
}

/* --- Kopfzeile: was nur diese Seite betrifft --- */
function chrome(){
  const bm=isBM();
  $("#newBtn").hidden=!bm;
  $("#exportBtn").hidden=!bm;
  $("#chartBox").hidden=!bm;
  $("#overview").classList.toggle("solo",!bm);
  $("#sort").querySelector('option[value="note"]').hidden=!bm;
  if(!bm&&state.sort==="note"){state.sort="neu";$("#sort").value="neu";}
  $("#q").placeholder=bm?"Suchen: Malz, Hopfen, Hefe, Notiz …":"Suchen: Malz, Hopfen, Hefe …";
}

/* --- Übersicht --- */
function renderStats(){
  const b=state.brews;const years=[...new Set(b.map(x=>x.datum?.slice(0,4)).filter(Boolean))].sort();
  const malz=b.reduce((a,x)=>a+malzSum(x),0);
  const fl=b.reduce((a,x)=>a+(+x.flaschen||0),0);
  $("#subtitle").textContent=years.length?`Das Braubuch · ${years[0]}–${years[years.length-1]}`:"Das Braubuch";
  let last;
  if(isBM()){const gv=b.map(x=>gradeVal(x.bewertung)).filter(v=>v!=null);const avg=gv.length?gv.reduce((a,v)=>a+v,0)/gv.length:null;
    last=`<div class="stat"><b class="num">${avg==null?"–":avg.toFixed(1).replace(".",",")}</b><span>Ø Note</span></div>`;}
  else last=`<div class="stat"><b class="num">${years.length}</b><span>Jahrgänge</span></div>`;
  $("#stats").innerHTML=`
    <div class="stat"><b class="num">${b.length}</b><span>Sude</span></div>
    <div class="stat"><b class="num">${Math.round(malz/1000)}</b><span>kg Malz verbraut</span></div>
    <div class="stat"><b class="num">${fl.toLocaleString("de-DE")}</b><span>Flaschen notiert</span></div>${last}`;
  if(isBM())renderChart();
}
function renderChart(){
  const pts=state.brews.filter(b=>b.datum&&gradeVal(b.bewertung)!=null).map(b=>({b,t:new Date(b.datum+"T12:00:00").getTime(),v:gradeVal(b.bewertung)})).sort((a,c)=>a.t-c.t);
  if(pts.length<2){$("#chart").innerHTML=`<p class="empty">Ab zwei bewerteten Suden erscheint hier der Verlauf.</p>`;return;}
  const W=600,H=170,L=26,R=12,T=12,B=26;const t0=pts[0].t,t1=pts[pts.length-1].t;
  const x=t=>L+(t-t0)/(t1-t0||1)*(W-L-R);const y=v=>T+(Math.min(Math.max(v,0.7),5.3)-0.7)/(5.3-0.7)*(H-T-B);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Noten aller Sude im Zeitverlauf">`;
  [1,2,3,4,5].forEach(g=>{s+=`<line x1="${L}" x2="${W-R}" y1="${y(g)}" y2="${y(g)}" stroke="var(--line)" stroke-width="1"/><text x="${L-8}" y="${y(g)+4}" text-anchor="end">${g}</text>`;});
  const y0=new Date(t0).getFullYear(),y1=new Date(t1).getFullYear();
  for(let yr=y0+1;yr<=y1;yr++){const tx=x(new Date(yr,0,1).getTime());s+=`<text x="${tx}" y="${H-6}" text-anchor="middle">${yr}</text><line x1="${tx}" x2="${tx}" y1="${T}" y2="${H-B}" stroke="var(--line)" stroke-dasharray="2 4"/>`;}
  s+=`<polyline fill="none" stroke="var(--amber)" stroke-width="1.5" stroke-opacity=".5" points="${pts.map(p=>x(p.t)+","+y(p.v)).join(" ")}"/>`;
  pts.forEach((p,i)=>{const last=i===pts.length-1;s+=`<circle cx="${x(p.t)}" cy="${y(p.v)}" r="${last?6:4.5}" fill="${p.v<=1.7?"var(--hop)":p.v<=2.7?"var(--amber)":"var(--warn)"}" stroke="var(--bg)" stroke-width="1.5" style="cursor:pointer" data-id="${esc(p.b.id)}"><title>${esc(title(p.b))} · ${esc(fmtDate(p.b.datum))}${esc(p.b.datum.slice(0,4))} · Note ${esc(p.b.bewertung)}</title></circle>`;});
  s+=`</svg>`;$("#chart").innerHTML=s;
  $("#chart").querySelectorAll("circle[data-id]").forEach(c=>c.addEventListener("click",()=>openDetail(c.dataset.id)));
}
function renderChips(){
  const styles=[...new Set(state.brews.map(b=>b.stil).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"de"));
  if(state.style&&!styles.includes(state.style))state.style="";
  $("#chips").innerHTML=[`<button class="chip" data-s="" aria-pressed="${state.style===""}">Alle</button>`].concat(styles.map(s=>`<button class="chip" data-s="${esc(s)}" aria-pressed="${state.style===s}">${esc(s)}</button>`)).join("");
  $("#chips").querySelectorAll(".chip").forEach(c=>c.onclick=()=>{state.style=c.dataset.s;renderChips();renderList();});
}
function renderList(){
  let b=state.brews.slice();
  if(state.style)b=b.filter(x=>x.stil===state.style);
  const q=state.q.trim().toLowerCase();if(q)b=b.filter(x=>haystack(x).includes(q));
  if(state.sort==="note")b.sort((a,c)=>(gradeVal(a.bewertung)??9)-(gradeVal(c.bewertung)??9)||(c.datum||"").localeCompare(a.datum||""));
  else b.sort((a,c)=>state.sort==="alt"?(a.datum||"").localeCompare(c.datum||""):(c.datum||"").localeCompare(a.datum||""));
  if(!state.brews.length){$("#list").innerHTML=`<p class="empty">${isBM()?"Noch keine Sude eingetragen. Leg mit „Neuer Sud“ den ersten Braugang an.":"Hier sind noch keine Sude freigegeben."}</p>`;return;}
  if(!b.length){$("#list").innerHTML=`<p class="empty">Kein Sud passt zu dieser Suche.</p>`;return;}
  const groups=[];if(state.sort==="note"){groups.push({k:"Nach Note",items:b});}
  else b.forEach(x=>{const k=x.datum?x.datum.slice(0,4):"Ohne Datum";let g=groups[groups.length-1];if(!g||g.k!==k){g={k,items:[]};groups.push(g);}g.items.push(x);});
  $("#list").innerHTML=groups.map(g=>`<section class="year"><div class="year-head"><h2>${esc(g.k)}</h2><span>${g.items.length} Sud${g.items.length===1?"":"e"}</span></div>${g.items.map(rowHTML).join("")}</section>`).join("");
  $("#list").querySelectorAll(".brew").forEach(r=>r.onclick=()=>openDetail(r.dataset.id));
}
function rowHTML(b){
  const bm=isBM();const gv=gradeVal(b.bewertung);const malz=(b.malz||[]).map(m=>m.sorte).filter(Boolean).join(", ");
  const cap=b.etikett?`<i class="cap" style="background:${CAPS[b.etikett]||"var(--line)"}" title="Kronkorken ${esc(CAP_LABEL[b.etikett]||b.etikett)}"></i>`:"";
  const lock=bm&&!b.oeffentlich?`<span class="lock" title="Nur für angemeldete Braumeister sichtbar">intern</span>`:"";
  const sub=[malz,b.hopfensorten,b.hefe].filter(Boolean).join(" · ");
  return `<button class="brew" data-id="${esc(b.id)}">
    <div class="date"><b>${esc(fmtDate(b.datum))}</b>${esc(b.datum?b.datum.slice(0,4):"")}</div>
    <div class="main"><div class="title"><h3>${esc(title(b))}</h3>${cap}<span class="nr">Nr. ${esc(b.nr)}</span>${lock}</div><div class="meta">${esc(sub||"Keine Angaben")}</div></div>
    <div class="facts"><div class="num">${b.stammwuerze?esc(b.stammwuerze)+"<br>":""}${b.flaschen?esc(b.flaschen)+" Fl.":esc(ageText(b.datum))}</div>${bm?`<span class="grade ${gradeCls(gv)}" title="Bewertung">${esc(b.bewertung||"–")}</span>`:""}</div>
  </button>`;
}
function renderAll(){renderStats();renderChips();renderList();}

/* --- Details --- */
function openDetail(id){
  const b=state.brews.find(x=>x.id===id);if(!b)return;
  const bm=isBM();const total=malzSum(b);
  const grist=(b.malz||[]).length?`<div class="grist">${b.malz.map(m=>`<div class="grist-row"><span>${esc(m.sorte)}${m.ebc!=null&&m.ebc!==""?` <small style="color:var(--muted)">${esc(Bz.fmtZahl(m.ebc))} EBC</small>`:""}</span><span class="num">${m.gramm?esc((+m.gramm).toLocaleString("de-DE"))+" g":"–"}</span><div class="grist-bar"><i style="width:${total?Math.round((+m.gramm||0)/total*100):0}%"></i></div></div>`).join("")}<div class="grist-row" style="color:var(--muted)"><span>Schüttung gesamt</span><span class="num">${fmtKg(total)}</span></div></div>`:"";
  const steps=(b.maischplan||[]).filter(Boolean).length?`<ol class="steps">${b.maischplan.filter(Boolean).map((s,i)=>`<li><b>${i+1}</b><span>${esc(s)}</span></li>`).join("")}</ol>`:"";
  const hops=(b.hopfen||[]).length?`<div class="hops">${b.hopfen.map(h=>`<div><b style="font-weight:500">${hopfenLinks(h)}</b><span>${hopfenRechts(h)}</span></div>`).join("")}</div>`:"";
  const head=`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      ${bm?`<span class="grade ${gradeCls(gradeVal(b.bewertung))}">${esc(b.bewertung||"–")}</span>`:""}
      <span class="num">${esc(fmtDate(b.datum))}${esc(b.datum?b.datum.slice(0,4):"")}</span>
      <span class="tag">Nr. ${esc(b.nr)}</span>
      ${b.etikett?`<span class="tag" style="display:inline-flex;gap:6px;align-items:center"><i class="cap" style="background:${CAPS[b.etikett]||"var(--line)"}"></i>${esc(CAP_LABEL[b.etikett]||b.etikett)}</span>`:""}
      <span class="tag">${esc(ageText(b.datum))}</span>
      ${b.datum_geschaetzt?`<span class="tag" title="In der Tabelle stand das Datum ohne Jahr">Jahr ergänzt</span>`:""}
      ${bm?(b.oeffentlich?`<span class="tag pub">öffentlich</span>`:`<span class="tag intern">intern</span>`):""}
    </div>${b.rezept_id?`<p class="meta-line" id="rezeptVerweis">Nach Rezept …</p>`:""}`;
  const changed=bm&&b.geaendert?`<p class="meta-line">Zuletzt geändert ${esc(fmtDateTime(b.geaendert))}${personName(b.geaendert_von)?" von "+esc(personName(b.geaendert_von)):""}</p>`:"";
  const body=head
    +sec("Schüttung",grist)
    +sec("Wasser & Maische",kv([["Hauptguss",b.hauptguss],["Nachguss",b.nachguss],["Wasserbehandlung",b.wasser]])+(steps?`<div style="margin-top:12px">${steps}</div>`:""))
    +sec("Läutern & Kochen",kv([["Läutern",b.laeutern],["Kochzeit",b.kochzeit],["Würzemenge",b.wuerze],["Stammwürze",b.stammwuerze]]))
    +sec("Hopfen",(b.hopfensorten?`<p style="margin:0 0 8px;color:var(--muted);font-size:.9rem">${esc(b.hopfensorten)}</p>`:"")+hops)
    +sec("Gärung",kv([["Hefe",b.hefe],["Hefemenge",b.hefemenge],["Messungen",b.messungen],["Messung vor Abfüllung",b.restextrakt]]))
    +sec("Abfüllung",kv([["Ausschlagwürze",b.ausschlag],["Biermenge",b.biermenge!=null&&b.biermenge!==""?String(b.biermenge).replace(".",",")+" L":""],["Speise / Zucker",b.zucker],["Flaschen",b.flaschen],["Alkohol",b.alkohol],["Abgefüllt am",b.abgefuellt]]))
    +sec("Notizen",b.notizen?`<div class="note">${esc(b.notizen)}</div>`:"")
    +changed;
  let foot=`<span class="spacer"></span><button class="btn" id="closeBtn2">Schließen</button>`;
  if(bm)foot=`${isAdmin()?`<button class="btn danger" id="delBtn">Löschen</button>`:""}<span class="spacer"></span><button class="btn" id="rzBtn">Als Rezept speichern</button><button class="btn" id="dupBtn">Als Vorlage nutzen</button><button class="btn primary" id="editBtn">Bearbeiten</button>`;
  sheet(title(b),body,foot);
  if(bm){$("#editBtn").onclick=()=>openEditor(b,false);$("#dupBtn").onclick=()=>openEditor(b,true);$("#rzBtn").onclick=()=>rezeptAusSud(b);if(isAdmin())$("#delBtn").onclick=()=>confirmDelete(b);}
  else $("#closeBtn2").onclick=closeSheet;
  if(b.rezept_id)sb.from("rezepte").select("id,name").eq("id",b.rezept_id).maybeSingle().then(({data})=>{const el=$("#rezeptVerweis");if(!el)return;if(data)el.innerHTML=`Nach Rezept <a href="rezepte.html?id=${esc(data.id)}">${esc(data.name)}</a>`;else el.remove();});
}
function confirmDelete(b){
  $("#sheetFoot").innerHTML=`<span style="align-self:center;font-size:.9rem">„${esc(title(b))}“ vom ${esc(fmtDate(b.datum))}${esc(b.datum?.slice(0,4)||"")} endgültig löschen?</span><span class="spacer"></span><button class="btn" id="noDel">Abbrechen</button><button class="btn danger" id="yesDel">Ja, löschen</button>`;
  $("#noDel").onclick=()=>openDetail(b.id);
  $("#yesDel").onclick=async()=>{$("#yesDel").disabled=true;
    const {data,error}=await sb.from("sude").delete().eq("id",b.id).select("id");
    if(error||!data||!data.length){toast(error?fehlertext(error):"Löschen ist nur dem Admin erlaubt.");openDetail(b.id);return;}
    state.brews=state.brews.filter(x=>x.id!==b.id);closeSheet();renderAll();toast("Sud gelöscht");};
}
/* --- Editor --- */
const FIELDS=[
 ["Grunddaten",[["datum","Braudatum","date"],["stil","Stil / Name"],["etikett","Kronkorken","cap"],["bewertung","Bewertung (Schulnote, z. B. 2+)"]]],
 ["Wasser",[["hauptguss","Hauptguss"],["nachguss","Nachguss"],["wasser","Wasserbehandlung (Milchsäure, pH)"]]],
 ["Läutern & Kochen",[["laeutern","Läutern"],["kochzeit","Kochzeit"],["wuerze","Würzemenge"],["stammwuerze","Stammwürze"]]],
 ["Gärung",[["hefe","Hefesorte"],["hefemenge","Hefemenge"],["messungen","Messungen"],["restextrakt","Messung vor Abfüllung"]]],
 ["Abfüllung",[["ausschlag","Ausschlagwürze"],["biermenge","Biermenge in Litern","number"],["zucker","Speise / Zucker"],["flaschen","Flaschen","integer"],["alkohol","Alkohol"],["abgefuellt","Abgefüllt am"]]],
];
function field([k,label,type],v){
  const id="f_"+k;
  if(type==="cap")return`<label class="f" for="${id}">${label}<select id="${id}" name="${k}"><option value="">Keiner</option>${Object.keys(CAPS).map(c=>`<option value="${c}"${v===c?" selected":""}>${CAP_LABEL[c]}</option>`).join("")}</select></label>`;
  const num=type==="number"||type==="integer";
  return`<label class="f" for="${id}">${label}<input id="${id}" name="${k}" type="${num?"number":(type||"text")}"${type==="number"?' step="any" inputmode="decimal"':""}${type==="integer"?' step="1" min="0" inputmode="numeric"':""} value="${esc(v??"")}"></label>`;
}
function rowsHTML(kind,items){
  if(kind==="malz")return items.map((m,i)=>`<div class="r"><input id="malz_s_${i}" placeholder="Malzsorte" value="${esc(m.sorte)}" aria-label="Malzsorte"><input id="malz_g_${i}" type="number" step="any" inputmode="decimal" placeholder="Gramm" value="${esc(m.gramm??"")}" aria-label="Menge in Gramm"><input id="malz_e_${i}" type="number" step="any" inputmode="decimal" placeholder="EBC" value="${esc(m.ebc??"")}" aria-label="Farbe in EBC"><button type="button" class="x" data-del="malz" data-i="${i}" aria-label="Zeile entfernen">✕</button></div>`).join("");
  if(kind==="hopfen")return items.map((h,i)=>`<div class="r"><input id="hop_s_${i}" placeholder="Sorte" value="${esc(h.sorte)}" aria-label="Hopfensorte"><input id="hop_g_${i}" type="number" step="any" inputmode="decimal" placeholder="Gramm" value="${esc(h.gramm??"")}" aria-label="Menge in Gramm"><input id="hop_a_${i}" type="number" step="any" inputmode="decimal" placeholder="% α" value="${esc(h.alpha??"")}" aria-label="Alphasäure in Prozent"><input id="hop_z_${i}" type="number" step="any" inputmode="numeric" placeholder="min" value="${esc(h.zeit??"")}" aria-label="Kochzeit der Gabe in Minuten"><select id="hop_t_${i}" aria-label="Art der Hopfengabe">${Object.entries(TYP).map(([k,l])=>`<option value="${k}"${h.typ===k?" selected":""}>${l}</option>`).join("")}</select><button type="button" class="x" data-del="hopfen" data-i="${i}" aria-label="Zeile entfernen">✕</button></div>${h.alt?`<small class="hint">vorher: ${esc(h.alt)}</small>`:""}`).join("");
  return items.map((s,i)=>`<div class="r one"><input id="rast_${i}" placeholder="z. B. 63 °C 30 Min." value="${esc(s)}" aria-label="Rast ${i+1}"><button type="button" class="x" data-del="maischplan" data-i="${i}" aria-label="Zeile entfernen">✕</button></div>`).join("");
}
let draft=null,editingId=null;
function openEditor(src,asCopy){
  if(!isBM())return;
  const nextNr=Math.max(0,...state.brews.map(b=>+b.nr||0))+1;
  if(src&&src.ausRezept){draft=Object.assign({nr:nextNr,datum:todayIso(),oeffentlich:false},src.draft);editingId=null;}
  else if(!src){draft={nr:nextNr,datum:todayIso(),oeffentlich:false,malz:[{sorte:"",gramm:"",ebc:null}],maischplan:[""],hopfen:[hopfenNeu(null)]};editingId=null;}
  else if(asCopy){draft=JSON.parse(JSON.stringify(src));delete draft.id;delete draft.rezept_id;Object.assign(draft,{nr:nextNr,datum:todayIso(),bewertung:"",messungen:"",restextrakt:"",ausschlag:"",biermenge:null,flaschen:null,alkohol:"",abgefuellt:"",notizen:"",datum_geschaetzt:false,oeffentlich:false});editingId=null;}
  else{draft=JSON.parse(JSON.stringify(src));editingId=src.id;}
  ["malz","maischplan","hopfen"].forEach(k=>{if(!Array.isArray(draft[k]))draft[k]=[];});
  draft.hopfen=draft.hopfen.map(hopfenNeu);
  $("#sheetTitle").textContent=editingId?`Sud ${draft.nr} bearbeiten`:asCopy?`Neuer Sud nach Vorlage`:src&&src.ausRezept?`Neuer Sud nach „${src.name}“`:"Neuer Sud";
  drawForm();
  $("#sheetFoot").innerHTML=`<span class="err" id="formErr"></span><span class="spacer"></span><button class="btn" id="cancelEdit">Abbrechen</button><button class="btn primary" id="saveBtn">${editingId?"Änderungen speichern":"Sud anlegen"}</button>`;
  $("#cancelEdit").onclick=()=>editingId?openDetail(editingId):closeSheet();
  $("#saveBtn").onclick=save;
  openSheet();$("#sheetBody").scrollTop=0;
}
function drawForm(){
  const d=draft;const fs=(t,inner)=>`<fieldset><legend>${t}</legend>${inner}</fieldset>`;
  $("#sheetBody").innerHTML=`<form id="form" novalidate>
    ${fs("Grunddaten",`<div class="grid2">${FIELDS[0][1].map(f=>field(f,d[f[0]])).join("")}</div>
      <label class="check"><input type="checkbox" id="f_oeffentlich" name="oeffentlich"${d.oeffentlich?" checked":""}><span><b>Öffentlich zeigen</b><br><span class="hint">Gäste sehen dann Werte, Schüttung, Hopfen und Hefe – Notizen und Bewertung bleiben intern.</span></span></label>`)}
    ${fs("Schüttung",`<div class="rowlist m3" id="rl_malz">${rowsHTML("malz",d.malz)}</div><button type="button" class="add" data-add="malz">+ Malz</button>`)}
    ${fs("Wasser & Maischplan",`<div class="grid2">${FIELDS[1][1].map(f=>field(f,d[f[0]])).join("")}</div><div class="rowlist" id="rl_maischplan">${rowsHTML("maischplan",d.maischplan)}</div><button type="button" class="add" data-add="maischplan">+ Rast</button>`)}
    ${fs("Läutern & Kochen",`<div class="grid2">${FIELDS[2][1].map(f=>field(f,d[f[0]])).join("")}</div>`)}
    ${fs("Hopfen",`<label class="f" for="f_hopfensorten">Hopfensorten mit Alphasäure<input id="f_hopfensorten" name="hopfensorten" value="${esc(d.hopfensorten??"")}"></label><div class="rowlist h5" id="rl_hopfen">${rowsHTML("hopfen",d.hopfen)}</div><button type="button" class="add" data-add="hopfen">+ Hopfengabe</button><p class="hint">Zeit = Kochzeit der Gabe in Minuten; bei Stopfhopfen leer lassen.</p>`)}
    ${fs("Gärung",`<div class="grid2">${FIELDS[3][1].map(f=>field(f,d[f[0]])).join("")}</div>`)}
    ${fs("Abfüllung",`<div class="grid2">${FIELDS[4][1].map(f=>field(f,d[f[0]])).join("")}</div>`)}
    ${fs("Notizen (intern)",`<label class="f" for="f_notizen">Was ist aufgefallen?<textarea id="f_notizen" name="notizen">${esc(d.notizen??"")}</textarea></label>`)}
  </form>`;
  $("#form").onsubmit=e=>{e.preventDefault();save();};
  $("#form").querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{collect();const k=b.dataset.add;draft[k].push(k==="malz"?{sorte:"",gramm:"",ebc:null}:k==="hopfen"?hopfenNeu(null):"");const top=$("#sheetBody").scrollTop;drawForm();$("#sheetBody").scrollTop=top;});
  $("#form").querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{collect();draft[b.dataset.del].splice(+b.dataset.i,1);const top=$("#sheetBody").scrollTop;drawForm();$("#sheetBody").scrollTop=top;});
}
function collect(){
  const f=$("#form");if(!f)return;
  f.querySelectorAll("input[name],select[name],textarea[name]").forEach(el=>{
    if(el.type==="checkbox")draft[el.name]=el.checked;
    else if(el.type==="number")draft[el.name]=el.value===""?null:+el.value;
    else draft[el.name]=el.value.trim();
  });
  const nz=id=>{const el=$(id);return !el||el.value===""?null:Bz.zahl(el.value);};
  draft.malz=draft.malz.map((_,i)=>({sorte:($("#malz_s_"+i)?.value||"").trim(),gramm:nz("#malz_g_"+i),ebc:nz("#malz_e_"+i)}));
  draft.hopfen=draft.hopfen.map((h,i)=>({sorte:($("#hop_s_"+i)?.value||"").trim(),gramm:nz("#hop_g_"+i),alpha:nz("#hop_a_"+i),zeit:nz("#hop_z_"+i),typ:$("#hop_t_"+i)?.value||"Kochen",alt:h.alt}));
  draft.maischplan=draft.maischplan.map((_,i)=>($("#rast_"+i)?.value||"").trim());
}
async function save(){
  collect();
  const err=$("#formErr");
  if(!draft.datum){err.textContent="Bitte ein Braudatum eintragen.";$("#f_datum")?.focus();return;}
  if(draft.flaschen!=null&&!Number.isInteger(draft.flaschen)){err.textContent="Flaschen bitte als ganze Zahl eintragen.";$("#f_flaschen")?.focus();return;}
  const out={};WRITE_COLS.forEach(k=>{let v=draft[k];if(v==="")v=null;if(v!==undefined)out[k]=v;});
  out.malz=(draft.malz||[]).filter(m=>m.sorte||m.gramm);out.hopfen=(draft.hopfen||[]).filter(h=>h.sorte||h.gramm).map(({alt,...h})=>({...h,zeit:h.typ==="Stopfen"?null:h.zeit}));out.maischplan=(draft.maischplan||[]).filter(Boolean);
  out.oeffentlich=!!draft.oeffentlich;out.datum_geschaetzt=!!draft.datum_geschaetzt;
  if(editingId&&out.datum!==state.brews.find(b=>b.id===editingId)?.datum)out.datum_geschaetzt=false;
  const btn=$("#saveBtn");btn.disabled=true;err.textContent="";
  const q=editingId?sb.from("sude").update(out).eq("id",editingId):sb.from("sude").insert(out);
  const {data,error}=await q.select().single();
  if(error){btn.disabled=false;err.textContent=fehlertext(error);return;}
  state.brews=state.brews.filter(b=>b.id!==data.id).concat([data]);
  renderAll();toast(editingId?"Gespeichert":`Sud ${data.nr} angelegt`);openDetail(data.id);
}
/* --- Neuer Sud: leer oder aus Rezept --- */
async function neuerSud(){
  const [rz,an]=await Promise.all([sb.from("rezepte").select("id,name,stil,ausschlag,sudhausausbeute").order("name"),sb.from("anlagen").select("*").order("id").limit(1).maybeSingle()]);
  const liste=rz.data||[],anl=an.data;
  sheet("Neuer Sud",`<div class="wahl">
      <button class="wahl-k" id="leer"><b>Leer beginnen</b><span>Alle Felder selbst ausfüllen.</span></button>
      <div class="wahl-k ${liste.length?"":"aus"}"><b>Aus Rezept</b><span>${liste.length?"Mengen werden auf eure Ausschlagwürze umgerechnet.":"Noch keine Rezepte – unter „Rezepte“ importieren oder anlegen."}</span>
        ${liste.length?`<form id="ausRz" class="stack" novalidate>
          <label class="f" for="nr_rz">Rezept<select id="nr_rz">${liste.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}${r.stil?" · "+esc(r.stil):""}</option>`).join("")}</select></label>
          <label class="f" for="nr_menge">Ausschlagwürze (Liter)<input id="nr_menge" type="number" step="0.5" min="1" inputmode="decimal" value="${esc(anl?.standard_menge??20)}"></label>
          ${anl?`<label class="check"><input type="checkbox" id="nr_anl" checked><span>Auf Anlage ${esc(anl.name)} umrechnen (${esc(Bz.fmtZahl(anl.sudhausausbeute))} % Ausbeute)</span></label>`:""}
          <span class="err" id="nrErr"></span>
          <button class="btn primary" type="submit" style="align-self:flex-start">Sud anlegen</button></form>`:""}
      </div></div>`,`<span class="spacer"></span><button class="btn" id="nrZu">Abbrechen</button>`);
  $("#nrZu").onclick=closeSheet;
  $("#leer").onclick=()=>openEditor(null,false);
  const f=$("#ausRz");if(!f)return;
  f.onsubmit=async e=>{e.preventDefault();
    const id=$("#nr_rz").value,ziel=Bz.zahl($("#nr_menge").value);
    if(!ziel||ziel<=0){$("#nrErr").textContent="Bitte die Ausschlagwürze in Litern angeben.";return;}
    const {data:r,error}=await sb.from("rezepte").select("*").eq("id",id).single();
    if(error){$("#nrErr").textContent=fehlertext(error);return;}
    const mitAnl=!!($("#nr_anl")?.checked&&r.sudhausausbeute);
    const u=Bz.umrechnen(r,{ziel,anlage:mitAnl?anl:null});
    openEditor({ausRezept:true,name:r.name,draft:draftAusRezept(u,r,ziel,mitAnl)},false);
  };
}
function draftAusRezept(u,r,ziel,mitAnl){
  const t=v=>v==null?"":Bz.fmtZahl(v);
  const plan=[u.einmaischtemperatur!=null?`Einmaischen ${t(u.einmaischtemperatur)} °C`:"",...(u.rasten||[]).map(x=>`${t(x.temperatur)} °C ${t(x.zeit)} min`),u.abmaischtemperatur!=null?`Abmaischen ${t(u.abmaischtemperatur)} °C`:""].filter(Boolean);
  const sorten=[...new Map((u.hopfen||[]).filter(h=>h.sorte).map(h=>[h.sorte,h.alpha])).entries()].map(([s,a])=>a!=null?`${s} ${t(a)} %`:s).join(", ");
  const ziele=[r.stammwuerze!=null?`${t(r.stammwuerze)} °P`:"",r.bittere!=null?`${t(r.bittere)} IBU`:"",r.farbe!=null?`${t(r.farbe)} EBC`:"",r.alkohol!=null?`${t(r.alkohol)} % Alkohol`:""].filter(Boolean).join(" · ");
  const gaer=[r.gaertemperatur?`Gärtemperatur ${r.gaertemperatur}${/°/.test(r.gaertemperatur)?"":" °C"}`:"",r.endvergaerungsgrad!=null?`EVG ${t(r.endvergaerungsgrad)} %`:"",r.karbonisierung!=null?`Karbonisierung ${t(r.karbonisierung)} g/l`:""].filter(Boolean).join(" · ");
  return{stil:r.name,rezept_id:r.id,
    hauptguss:u.hauptguss!=null?`${t(u.hauptguss)} l`:"",nachguss:u.nachguss!=null?`${t(u.nachguss)} l`:"",
    maischplan:plan.length?plan:[""],kochzeit:u.kochzeit!=null?`${t(u.kochzeit)} min`:"",
    malz:(u.malze||[]).map(m=>({sorte:m.name,gramm:m.gramm,ebc:m.ebc??null})),
    hopfen:(u.hopfen||[]).map(h=>({sorte:h.sorte,gramm:h.gramm,alpha:h.alpha,zeit:h.zeit,typ:h.typ})),
    hopfensorten:sorten,hefe:r.hefe||"",
    notizen:`Nach Rezept „${r.name}“, umgerechnet auf ${t(ziel)} l Ausschlagwürze${mitAnl?" (Anlagenprofil)":""}.${ziele?"\nZiel: "+ziele:""}${gaer?"\n"+gaer:""}`};
}
/* Rückweg: aus einem Sud ein Rezept machen */
async function rezeptAusSud(b){
  const n=v=>{const m=String(v??"").match(/(\d+(?:[.,]\d+)?)/);return m?Bz.zahl(m[1]):null;};
  let einm=null,abm=null;const rasten=[];
  (b.maischplan||[]).filter(Boolean).forEach(s=>{const t=String(s).match(/(\d+(?:[.,]\d+)?)\s*°/);const z=String(s).match(/(\d+)\s*min/i);
    if(/einmaisch/i.test(s))einm=t?Bz.zahl(t[1]):null;else if(/abmaisch/i.test(s))abm=t?Bz.zahl(t[1]):null;else if(t)rasten.push({temperatur:Bz.zahl(t[1]),zeit:z?+z[1]:null});});
  const r={name:title(b),autor:"Koldingbräu",quelle:`aus Sud Nr. ${b.nr} (${fmtDate(b.datum)}${b.datum?b.datum.slice(0,4):""})`,aus_sud_id:b.id,
    ausschlag:n(b.ausschlag)||n(b.wuerze)||n(b.biermenge),stammwuerze:n(b.stammwuerze),alkohol:n(b.alkohol),
    hauptguss:n(b.hauptguss),nachguss:n(b.nachguss),kochzeit:n(b.kochzeit),einmaischtemperatur:einm,abmaischtemperatur:abm,rasten,
    malze:(b.malz||[]).filter(m=>m.sorte||m.gramm).map(m=>({name:m.sorte,gramm:Bz.zahl(m.gramm),ebc:m.ebc!=null&&m.ebc!==""?Bz.zahl(m.ebc):Bz.malzEbc(m.sorte)})),
    hopfen:(b.hopfen||[]).map(hopfenNeu).filter(h=>h.sorte||h.gramm).map(({alt,...h})=>h),
    hefe:b.hefe||null,anmerkung:[b.hefemenge?`Hefemenge: ${b.hefemenge}`:"",b.wasser?`Wasser: ${b.wasser}`:"",b.laeutern?`Läutern: ${b.laeutern}`:"",b.notizen||""].filter(Boolean).join("\n")||null,oeffentlich:false};
  if(r.stammwuerze&&r.ausschlag){const kg=r.malze.reduce((a,m)=>a+(m.gramm||0),0)/1000;if(kg)r.sudhausausbeute=Bz.runde(r.ausschlag*r.stammwuerze/100*Bz.sgAusPlato(r.stammwuerze)/kg*100,1);}
  $("#rzBtn").disabled=true;
  const {data,error}=await sb.from("rezepte").insert(r).select("id").single();
  if(error){$("#rzBtn").disabled=false;toast(fehlertext(error));return;}
  toast("Rezept angelegt");location.href="rezepte.html?id="+data.id;
}
let einstieg=true;
function einstiegVerarbeiten(){
  if(!einstieg)return;einstieg=false;
  const p=new URLSearchParams(location.search);
  if(p.get("sud")){const id=p.get("sud");history.replaceState(null,"",location.pathname);if(state.brews.some(b=>b.id===id))openDetail(id);else KB.notice("Diesen Sud gibt es nicht oder er ist nicht öffentlich.");}
  else if(p.get("ausRezept")&&isBM()){
    history.replaceState(null,"",location.pathname);
    let x=null;try{x=JSON.parse(sessionStorage.getItem("kb_sud_aus_rezept")||"null");sessionStorage.removeItem("kb_sud_aus_rezept");}catch(_){}
    if(x&&x.rezept){openEditor({ausRezept:true,name:x.name,draft:draftAusRezept(x.rezept,{...x.rezept,id:x.rezept_id,name:x.name},x.ziel,x.anlage)},false);}
  }
}
/* --- CSV-Export --- */
function toCSV(){
  const cols=["nr","datum","stil","etikett","bewertung","hauptguss","nachguss","wasser","malz","maischplan","laeutern","kochzeit","wuerze","stammwuerze","hopfensorten","hopfen","hefe","hefemenge","messungen","restextrakt","ausschlag","biermenge","zucker","flaschen","alkohol","abgefuellt","notizen","oeffentlich"];
  const v=(b,c)=>c==="malz"?(b.malz||[]).map(m=>`${m.sorte} ${m.gramm??""}g`).join(" | "):c==="hopfen"?(b.hopfen||[]).map(h=>h.sorte===undefined?`${h.menge} (${h.zeit})`:`${h.gramm??""}g ${h.sorte}${h.alpha!=null?" "+h.alpha+"%":""} (${TYP[h.typ]||h.typ}${h.zeit!=null?" "+h.zeit+" min":""})`).join(" | "):c==="maischplan"?(b.maischplan||[]).join(" | "):c==="oeffentlich"?(b.oeffentlich?"ja":"nein"):(b[c]??"");
  const q=x=>`"${String(x).replace(/"/g,'""')}"`;
  return [cols.join(";")].concat(state.brews.slice().sort((a,c)=>(a.datum||"").localeCompare(c.datum||"")).map(b=>cols.map(c=>q(v(b,c))).join(";"))).join("\n");
}
function downloadCSV(){
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["﻿"+toCSV()],{type:"text/csv;charset=utf-8"}));
  a.download="koldingbraeu-sude.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

/* --- Daten laden --- */
async function loadBrews(){
  const q=isBM()?sb.from("sude").select("*"):sb.from("sude").select(PUBLIC_COLS).eq("oeffentlich",true);
  const {data,error}=await q.order("datum",{ascending:true});
  if(error){$("#list").innerHTML=`<p class="empty">Die Sude konnten nicht geladen werden. Bitte die Seite neu laden.</p>`;return false;}
  state.brews=data||[];return true;
}

KB.seite = {
  chrome,
  start(){
    const s=KB.lsGet("kb_sort");if(s){state.sort=s;$("#sort").value=s;}
    $("#newBtn").onclick=neuerSud;
    $("#exportBtn").onclick=downloadCSV;
    $("#q").addEventListener("input",e=>{state.q=e.target.value;renderList();});
    $("#sort").addEventListener("change",e=>{state.sort=e.target.value;KB.lsSet("kb_sort",state.sort);renderList();});
  },
  async laden(){ if(await loadBrews()){renderAll();einstiegVerarbeiten();} },
};
})();
