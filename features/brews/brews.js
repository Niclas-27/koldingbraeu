/* Koldingbräu – Seite „Sude“ (das Braubuch)
   Übersicht, Liste, Details, Editor und CSV-Export. Anmeldung und Menü kommen aus kern.js. */
(function () {
"use strict";
const {$, esc, state, isBM, isAdmin, fmtDate, fmtDateTime, personName, todayIso, toast, sheet, openSheet, closeSheet, kv, sec, fehlertext} = KB;
const sb = new Proxy({}, {get: (_, k) => { const v = KB.sb[k]; return typeof v === "function" ? v.bind(KB.sb) : v; }});  // Client entsteht erst beim Start
// Spalten, die Gäste lesen dürfen (ohne notizen, bewertung); Messwerte seit 25.10.2026 Zahl+Einheit statt Freitext
const PUBLIC_COLS = "id,nr,datum,datum_geschaetzt,stil,etikett,hauptguss,nachguss,wasser,malz,einmaischtemperatur,abmaischtemperatur,rasten,laeutern,kochzeit,wuerze,stammwuerze,hopfensorten,hopfen,hefe,hefemenge,messungen,restextrakt,ausschlag,biermenge,zucker,flaschen,alkohol,alkohol_geschaetzt,abgefuellt,oeffentlich,rezept_id,bild_foto,bild_etikett";
// Spalten, die beim Speichern geschrieben werden
const WRITE_COLS = ["nr","datum","datum_geschaetzt","stil","etikett","bewertung","hauptguss","nachguss","wasser","malz","einmaischtemperatur","abmaischtemperatur","rasten","laeutern","kochzeit","wuerze","stammwuerze","hopfensorten","hopfen","hefe","hefemenge","messungen","restextrakt","ausschlag","biermenge","zucker","flaschen","alkohol","alkohol_geschaetzt","abgefuellt","notizen","oeffentlich","rezept_id","bild_foto","bild_etikett"];
const CAPS = {rot:"#c23b2b",blau:"#2f5fa8",orange:"#e5862b",silber:"#b9bec4",gruen:"#3f8a3a",gold:"#c9a227",schwarz:"#1c1c1c",weiss:"#f4f4f0",gelb:"#e8c82e"};
const CAP_LABEL = {rot:"Rot",blau:"Blau",orange:"Orange",silber:"Silber",gruen:"Grün",gold:"Gold",schwarz:"Schwarz",weiss:"Weiß",gelb:"Gelb"};
Object.assign(state, { brews: [], q: "", style: "", sort: "neu" });

/* --- Helfer --- */
/* Bewertung: Note von 0–10 (10 = beste Note), wie bei den Verkostungs-Gesamtnoten – bis 25.10.2026 noch
   eine Schulnote als Freitext (z. B. "2+"), siehe Migration 06 für die Umrechnung der Altdaten. */
const gradeCls = KB.gradeCls; // einheitliche Farbcodierung, gemeinsam mit Liga/Verkostungen (core/core.js)
function ageText(iso){if(!iso)return"";const days=Math.floor((Date.now()-new Date(iso+"T12:00:00").getTime())/864e5);
  if(days<0)return"geplant";if(days<1)return"heute";if(days<14)return`vor ${days} Tag${days===1?"":"en"}`;if(days<60)return`vor ${Math.round(days/7)} Wochen`;
  const months=Math.round(days/30.44);if(months<24)return`vor ${months} Monaten`;return`vor ${(days/365.25).toFixed(1).replace(".",",")} Jahren`;}
function title(b){return b.stil||`Sud ${b.nr}`;}
function malzSum(b){return(b.malz||[]).reduce((a,m)=>a+(+m.gramm||0),0);}
function hopfenSum(b){return(b.hopfen||[]).reduce((a,h)=>a+(+hopfenNeu(h).gramm||0),0);}
function fmtKg(g){return(g/1000).toLocaleString("de-DE",{maximumFractionDigits:2})+" kg";}
/* Messwert mit Einheit, oder null (für kv()/kw(), die null-Werte als „–“ bzw. gar nicht zeigen) */
function fmtNum(v,einheit,stellen=1){return v==null?null:`${Bz.fmtZahl(v,stellen)} ${einheit}`;}
/* Bild-Vorschau eines Suds: Etikett, sonst Foto, sonst gezeichneter Kronkorken in der gewählten Kronkorken-Farbe (sonst Bierfarbe) */
function sudFarbe(b){const v=b.ausschlag??b.wuerze??b.biermenge??null;return Bz.ebc({ausschlag:v,malze:(b.malz||[]).map(m=>({name:m.sorte,gramm:m.gramm,ebc:m.ebc}))});}
function sudBild(b){const p=b.bild_etikett||b.bild_foto;
  if(p)return`<img class="sud-bild kb-zack" src="${esc(Bilder.url(p,true))}" alt="" loading="lazy">`;
  return`<span class="sud-bild ph">${Bilder.platzhalter({name:title(b),stil:b.stil,ebc:sudFarbe(b),farbe:CAPS[b.etikett]})}</span>`;}
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
  const istDetail=new URLSearchParams(location.search).has("sud");
  $("#sudeActions").hidden=istDetail;
  $("#newBtn").hidden=!bm||istDetail;
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
  if(isBM()){const gv=b.map(x=>x.bewertung).filter(v=>v!=null).map(Number);const avg=gv.length?gv.reduce((a,v)=>a+v,0)/gv.length:null;
    last=`<div class="stat"><b class="num">${avg==null?"–":avg.toFixed(1).replace(".",",")}</b><span>Ø Note</span></div>`;}
  else{const hopfen=b.reduce((a,x)=>a+hopfenSum(x),0);
    last=`<div class="stat"><b class="num">${Math.round(hopfen).toLocaleString("de-DE")}</b><span>g Hopfen verbraut</span></div>`;}
  $("#stats").innerHTML=`
    <div class="stat"><b class="num">${b.length}</b><span>Sude</span></div>
    <div class="stat"><b class="num">${Math.round(malz/1000)}</b><span>kg Malz verbraut</span></div>
    <div class="stat"><b class="num">${fl.toLocaleString("de-DE")}</b><span>Flaschen notiert</span></div>${last}`;
  if(isBM())renderChart();
}
function renderChart(){
  const pts=state.brews.filter(b=>b.datum&&b.bewertung!=null).map(b=>({b,t:new Date(b.datum+"T12:00:00").getTime(),v:+b.bewertung})).sort((a,c)=>a.t-c.t);
  if(pts.length<2){$("#chart").innerHTML=`<p class="empty">Ab zwei bewerteten Suden erscheint hier der Verlauf.</p>`;return;}
  const W=600,H=170,L=26,R=12,T=12,B=26;const t0=pts[0].t,t1=pts[pts.length-1].t;
  // 0 unten, 10 (beste Note) oben – wie bei den Verkostungs-Gesamtnoten
  const x=t=>L+(t-t0)/(t1-t0||1)*(W-L-R);const y=v=>T+(10-Math.min(Math.max(v,0),10))/10*(H-T-B);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Noten aller Sude im Zeitverlauf">`;
  [0,2,4,6,8,10].forEach(g=>{s+=`<line x1="${L}" x2="${W-R}" y1="${y(g)}" y2="${y(g)}" stroke="var(--line)" stroke-width="1"/><text x="${L-8}" y="${y(g)+4}" text-anchor="end">${g}</text>`;});
  const y0=new Date(t0).getFullYear(),y1=new Date(t1).getFullYear();
  for(let yr=y0+1;yr<=y1;yr++){const tx=x(new Date(yr,0,1).getTime());s+=`<text x="${tx}" y="${H-6}" text-anchor="middle">${yr}</text><line x1="${tx}" x2="${tx}" y1="${T}" y2="${H-B}" stroke="var(--line)" stroke-dasharray="2 4"/>`;}
  s+=`<polyline fill="none" stroke="var(--amber)" stroke-width="1.5" stroke-opacity=".5" points="${pts.map(p=>x(p.t)+","+y(p.v)).join(" ")}"/>`;
  pts.forEach((p,i)=>{const last=i===pts.length-1;s+=`<circle cx="${x(p.t)}" cy="${y(p.v)}" r="${last?6:4.5}" fill="${p.v>=7?"var(--hop)":p.v>=4?"var(--amber)":"var(--warn)"}" stroke="var(--bg)" stroke-width="1.5" style="cursor:pointer" data-id="${esc(p.b.id)}"><title>${esc(title(p.b))} · ${esc(fmtDate(p.b.datum))}${esc(p.b.datum.slice(0,4))} · Note ${esc(Bz.fmtZahl(p.b.bewertung,1))}</title></circle>`;});
  s+=`</svg>`;$("#chart").innerHTML=s;
  $("#chart").querySelectorAll("circle[data-id]").forEach(c=>c.addEventListener("click",()=>{location.href="index.html?sud="+encodeURIComponent(c.dataset.id);}));
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
  if(state.sort==="note")b.sort((a,c)=>(c.bewertung??-1)-(a.bewertung??-1)||(c.datum||"").localeCompare(a.datum||""));
  else b.sort((a,c)=>state.sort==="alt"?(a.datum||"").localeCompare(c.datum||""):(c.datum||"").localeCompare(a.datum||""));
  if(!state.brews.length){$("#list").innerHTML=`<p class="empty">${isBM()?"Noch keine Sude eingetragen. Leg mit „Neuer Sud“ den ersten Braugang an.":"Hier sind noch keine Sude freigegeben."}</p>`;return;}
  if(!b.length){$("#list").innerHTML=`<p class="empty">Kein Sud passt zu dieser Suche.</p>`;return;}
  const groups=[];if(state.sort==="note"){groups.push({k:"Nach Note",items:b});}
  else b.forEach(x=>{const k=x.datum?x.datum.slice(0,4):"Ohne Datum";let g=groups[groups.length-1];if(!g||g.k!==k){g={k,items:[]};groups.push(g);}g.items.push(x);});
  $("#list").innerHTML=groups.map(g=>`<section class="year"><div class="year-head"><h2>${esc(g.k)}</h2><span>${g.items.length} Sud${g.items.length===1?"":"e"}</span></div>${g.items.map(rowHTML).join("")}</section>`).join("");
}
function rowHTML(b){
  const bm=isBM();const malz=(b.malz||[]).map(m=>m.sorte).filter(Boolean).join(", ");
  const cap=b.etikett?`<i class="cap" style="background:${CAPS[b.etikett]||"var(--line)"}" title="Kronkorken ${esc(CAP_LABEL[b.etikett]||b.etikett)}"></i>`:"";
  const lock=bm&&!b.oeffentlich?`<span class="lock" title="Nur für angemeldete Braumeister sichtbar">intern</span>`:"";
  const statusBadge=bm&&b.status!=="dokumentiert"?`<span class="tag ${b.status}">${b.status==="entwurf"?"Entwurf":"Gärung läuft"}</span>`:"";
  const sub=[malz,b.hopfensorten,b.hefe].filter(Boolean).join(" · ");
  return `<a class="brew" href="index.html?sud=${esc(b.id)}">
    ${sudBild(b)}<div class="date"><b>${esc(fmtDate(b.datum))}</b>${esc(b.datum?b.datum.slice(0,4):"")}</div>
    <div class="main"><div class="title"><h3>${esc(title(b))}</h3>${cap}<span class="nr">Nr. ${esc(b.nr)}</span>${lock}${statusBadge}</div><div class="meta">${esc(sub||"Keine Angaben")}</div></div>
    <div class="facts"><div class="num">${b.stammwuerze!=null?esc(fmtNum(b.stammwuerze,"°P"))+"<br>":""}${b.flaschen?esc(b.flaschen)+" Fl.":esc(ageText(b.datum))}</div>${bm?`<span class="grade ${gradeCls(b.bewertung)}" title="Bewertung">${esc(Bz.fmtZahl(b.bewertung,1))}</span>`:""}</div>
  </a>`;
}
/* Kopfzeile (Logo/Menü/Konto) nur im Braugang-Assistenten ausblenden, um auf dem Handy Höhe zu gewinnen –
   dort bleibt nur der kleine "← Zurück"-Link. Auf jeder anderen Ansicht wieder einblenden, da die Seite
   zwischen Liste/Detail/Assistent per history.replaceState ohne echtes Neuladen wechselt (sonst bliebe die
   Kopfzeile verschwunden, wenn man z. B. per Browser-Zurück von der Assistenten- auf die Listenansicht kommt). */
function kopfzeileZeigen(zeigen){
  const h=document.querySelector(".site-header"),f=document.querySelector(".foot");
  if(h)h.hidden=!zeigen;if(f)f.hidden=!zeigen;
}
function renderAll(){kopfzeileZeigen(true);renderStats();renderChips();renderList();}

/* --- Details (eigene Seite index.html?sud=<id>, wie bei den Rezepten) --- */
let aktuellerSud=null;
function zeigeDetail(b){
  kopfzeileZeigen(true);
  aktuellerSud=b;
  $("#overview").hidden=true;$("#filter").hidden=true;$("#sudeActions").hidden=true;
  document.title=title(b)+" · Koldingbräu";
  const bm=isBM();const total=malzSum(b);
  const grist=(b.malz||[]).length?`<div class="grist">${b.malz.map(m=>`<div class="grist-row"><span>${esc(m.sorte)}${m.ebc!=null&&m.ebc!==""?` <small style="color:var(--muted)">${esc(Bz.fmtZahl(m.ebc))} EBC</small>`:""}</span><span class="num">${m.gramm?esc((+m.gramm).toLocaleString("de-DE"))+" g":"–"}</span><div class="grist-bar"><i style="width:${total?Math.round((+m.gramm||0)/total*100):0}%"></i></div></div>`).join("")}<div class="grist-row" style="color:var(--muted)"><span>Schüttung gesamt</span><span class="num">${fmtKg(total)}</span></div></div>`:"";
  const rastZeilen=[
    b.einmaischtemperatur!=null?`<li><b>Einmaischen</b><span class="num">${esc(Bz.fmtZahl(b.einmaischtemperatur))} °C</span></li>`:"",
    ...(b.rasten||[]).map((r,i)=>`<li><b>${i+1}. Rast</b><span class="num">${r.temperatur!=null?esc(Bz.fmtZahl(r.temperatur))+" °C":"–"}${r.zeit!=null?" · "+esc(Bz.fmtZahl(r.zeit,0))+" min":""}</span></li>`),
    b.abmaischtemperatur!=null?`<li><b>Abmaischen</b><span class="num">${esc(Bz.fmtZahl(b.abmaischtemperatur))} °C</span></li>`:"",
  ].filter(Boolean);
  const steps=rastZeilen.length?`<ol class="steps">${rastZeilen.join("")}</ol>`:"";
  const hops=(b.hopfen||[]).length?`<div class="hops">${b.hopfen.map(h=>`<div><b style="font-weight:500">${hopfenLinks(h)}</b><span>${hopfenRechts(h)}</span></div>`).join("")}</div>`:"";
  const kronkorken=b.bild_etikett
    ?`<button type="button" class="sud-etikett" id="sudEtikett"><img class="sud-bild gross kb-zack" src="${esc(Bilder.url(b.bild_etikett,true))}" alt="Etikett"></button>`
    :b.bild_foto?""
    :`<span class="sud-bild gross ph">${Bilder.platzhalter({name:title(b),stil:b.stil,ebc:sudFarbe(b),farbe:CAPS[b.etikett]})}</span>`;
  const kw=(label,wert,einheit,cls)=>`<div class="kw"><span>${esc(label)}</span><b class="num${cls?" "+cls:""}">${wert==null||wert===""?"–":esc(wert)}</b>${einheit?`<small>${esc(einheit)}</small>`:""}</div>`;
  const posten=[["Stammwürze",b.stammwuerze!=null?Bz.fmtZahl(b.stammwuerze):null,"°P"],["Alkohol",b.alkohol!=null?Bz.fmtZahl(b.alkohol):null,"% Vol."]];
  if(bm)posten.push(["Bewertung",b.bewertung!=null?Bz.fmtZahl(b.bewertung,1):null,"/ 10",gradeCls(b.bewertung)]);
  posten.push(["Ausschlagwürze",b.ausschlag!=null?Bz.fmtZahl(b.ausschlag):null,"l"]);
  const kennzahlen=`<div class="kws" style="grid-template-columns:repeat(${posten.length},minmax(0,1fr))">${posten.map(p=>kw(...p)).join("")}</div>`;
  const header=`<header class="sud-kopf">
      ${kronkorken}
      <p class="kicker">Sud Nr. ${esc(b.nr)}</p>
      <h2>${esc(title(b))}</h2>
      ${kennzahlen}
      <div class="tags">
        <span class="num">${esc(fmtDate(b.datum))}${esc(b.datum?b.datum.slice(0,4):"")}</span>
        ${b.etikett?`<span class="tag" style="display:inline-flex;gap:6px;align-items:center"><i class="cap" style="background:${CAPS[b.etikett]||"var(--line)"}"></i>${esc(CAP_LABEL[b.etikett]||b.etikett)}</span>`:""}
        <span class="tag">${esc(ageText(b.datum))}</span>
        ${b.datum_geschaetzt?`<span class="tag" title="In der Tabelle stand das Datum ohne Jahr">Jahr ergänzt</span>`:""}
        ${b.alkohol_geschaetzt?`<span class="tag" title="Berechnet aus Stammwürze und Restextrakt, keine Messung">Alkohol geschätzt</span>`:""}
        ${bm?(b.oeffentlich?`<span class="tag pub">öffentlich</span>`:`<span class="tag intern">intern</span>`):""}
        ${bm&&b.status!=="dokumentiert"?`<span class="tag ${b.status}">${b.status==="entwurf"?"Entwurf":"Gärung läuft"}</span>`:""}
      </div>
    </header>${b.rezept_id?`<p class="meta-line" id="rezeptVerweis">Nach Rezept …</p>`:""}`;
  const changed=bm&&b.geaendert?`<p class="meta-line">Zuletzt geändert ${esc(fmtDateTime(b.geaendert))}${personName(b.geaendert_von)?" von "+esc(personName(b.geaendert_von)):""}</p>`:"";
  const bilder=(b.bild_foto?`<img class="sud-foto" id="sudFoto" src="${esc(Bilder.url(b.bild_foto))}" alt="Foto: ${esc(title(b))}">`:"");
  const body=`<p class="noprint"><a class="back" href="index.html">← Alle Sude</a></p>
    <article class="sud-blatt">
      ${bilder}
      ${header}
      ${sec("Schüttung",grist)}
      ${sec("Brauwasser",kv([["Hauptguss",fmtNum(b.hauptguss,"l")],["Nachguss",fmtNum(b.nachguss,"l")],["Wasserhärte",fmtNum(b.wasserhaerte,"°dH")],
        ["pH vorher",b.ph_vorher],["pH nachher",b.ph_nachher],["Milchsäure Hauptguss",fmtNum(b.milchsaeure_hauptguss,"ml")],
        ["Milchsäure Nachguss",fmtNum(b.milchsaeure_nachguss,"ml")],["Wasserbehandlung",b.wasser]]))}
      ${sec("Maischplan",steps)}
      ${sec("Läutern & Kochen"+(b.kochzeit!=null?` · ${Bz.fmtZahl(b.kochzeit,0)} min`:""),
        kv([["Läutern",b.laeutern],["Würzemenge",fmtNum(b.wuerze,"l")],["Stammwürze",fmtNum(b.stammwuerze,"°P")],["Stammwürze (Refraktometer)",fmtNum(b.refraktometer_anstellen,"°Brix")]])
        +(b.hopfensorten?`<p style="margin:12px 0 8px;color:var(--muted);font-size:.9rem">${esc(b.hopfensorten)}</p>`:"")
        +(hops?`<div style="margin-top:${b.hopfensorten?"0":"12px"}">${hops}</div>`:""))}
      ${sec("Gärung",kv([["Hefe",b.hefe],["Hefemenge",b.hefemenge],["Messungen",b.messungen],["Restextrakt",fmtNum(b.restextrakt,"°P")],
        ["Restextrakt (Refraktometer)",fmtNum(b.refraktometer_restextrakt,"°Brix")]]))}
      <section class="sec" id="sudMessungenSec" hidden><h3>Zwischenmessungen</h3><div id="sudMessungenListe"></div></section>
      ${sec("Abfüllung",kv([["Ausschlagwürze",fmtNum(b.ausschlag,"l")],["Biermenge",fmtNum(b.biermenge,"l")],["Speise / Zucker",b.zucker],
        ["Flaschen",b.flaschen],["Karbonisierung",fmtNum(b.karbonisierung,"g/l")],["Alkohol",fmtNum(b.alkohol,"% vol")],
        ["Abgefüllt am",b.abgefuellt?fmtDate(b.abgefuellt)+b.abgefuellt.slice(0,4):null]]))}
      ${sec("Eigene Angaben",(b.wizard_notizen||[]).length?kv(b.wizard_notizen.map(n=>[n.label||"(ohne Bezeichnung)",n.wert])):"")}
      ${sec("Notizen",b.notizen?`<div class="note">${esc(b.notizen)}</div>`:"")}
      <section class="sec" id="sudGalerieSec" hidden><h3>Fotos vom Brautag</h3><div id="sudGalerie"></div><input type="file" id="galerieFile" accept="image/*" multiple hidden></section>
      ${changed}
    </article>
    ${bm?`<div class="top-actions noprint sud-aktionen">${isAdmin()?`<button class="btn danger" id="delBtn">Löschen</button>`:""}<button class="btn" id="rzBtn">Als Rezept speichern</button><button class="btn" id="dupBtn">Als Vorlage nutzen</button><button class="btn" id="checklisteBtn">Checkliste</button>${b.status!=="dokumentiert"?`<button class="btn primary" id="wzFortBtn">Braugang-Assistent</button>`:`<button class="btn primary" id="editBtn">Bearbeiten</button>`}</div>`:""}`;
  $("#list").innerHTML=body;
  if(bm){
    if(b.status!=="dokumentiert")$("#wzFortBtn").onclick=async()=>{wizard={sud:b,step:b.status==="gaerung"?WIZARD_STEPS.findIndex(s=>s[0]==="gaerung"):0,messungen:[],rezept:null,anlage:null,rezeptUmgerechnet:null};await wizardMessungenLaden();wizardAnzeigen();wizardRezeptLaden();};
    else $("#editBtn").onclick=()=>editInline(b);
    $("#dupBtn").onclick=()=>openEditor(b,true);$("#rzBtn").onclick=()=>rezeptAusSud(b);$("#checklisteBtn").onclick=()=>zeigeChecklist(b);if(isAdmin())$("#delBtn").onclick=()=>confirmDelete(b);
  }
  const bp=[b.bild_foto,b.bild_etikett].filter(Boolean);
  if($("#sudFoto"))$("#sudFoto").onclick=()=>Bilder.zeigen(bp,0);
  if($("#sudEtikett"))$("#sudEtikett").onclick=()=>Bilder.zeigen(bp,bp.length-1);
  if(b.rezept_id)sb.from("rezepte").select("id,name").eq("id",b.rezept_id).maybeSingle().then(({data})=>{const el=$("#rezeptVerweis");if(!el)return;if(data)el.innerHTML=`Nach Rezept <a href="rezepte.html?id=${esc(data.id)}">${esc(data.name)}</a>`;else el.remove();});
  $("#galerieFile").onchange=galerieDateienGewaehlt;
  galerieDragDropVerdrahten($("#sudGalerieSec"));
  galerieLaden(b.id);
  messungenDetailLaden(b.id);
}
/* Zwischenmessungen auf der fertigen Sud-Seite anzeigen (reines Arbeitswerkzeug wie die Fotogalerie,
   sud_messungen ist per RLS ohnehin nur für Braumeister/Admin lesbar – daher kein eigener isBM()-Check nötig,
   die Abfrage liefert Gästen einfach nichts). */
function messungenDetailLaden(sudId){
  const el=$("#sudMessungenSec");if(!el)return;
  if(!isBM()){el.hidden=true;return;}
  sb.from("sud_messungen").select("*").eq("sud_id",sudId).order("angelegt").then(({data,error})=>{
    if(error||!data||!data.length){el.hidden=true;return;}
    el.hidden=false;
    $("#sudMessungenListe").innerHTML=`<ul class="steps">${data.map(m=>`<li><b>${esc(m.bezeichnung)}</b><span class="num">${esc([m.plato!=null?Bz.fmtZahl(m.plato)+" °P":"",m.refraktometer!=null?Bz.fmtZahl(m.refraktometer)+" °Brix":""].filter(Boolean).join(" · "))}</span></li>`).join("")}</ul>`;
  });
}
/* Drag & Drop auf die ganze Galerie-Fläche, z. B. direkt aus der Mac-Fotos-Mediathek. Nur für Braumeister/Admin;
   Zähler statt einfachem Ein/Aus, weil dragenter/dragleave beim Überqueren von Kind-Elementen sonst flackert. */
function galerieDragDropVerdrahten(abschnitt){
  if(!abschnitt)return;
  let tiefe=0;
  abschnitt.ondragenter=e=>{if(!isBM())return;e.preventDefault();tiefe++;abschnitt.classList.add("sg-dragover");};
  abschnitt.ondragover=e=>{if(!isBM())return;e.preventDefault();};
  abschnitt.ondragleave=()=>{if(!isBM())return;tiefe=Math.max(0,tiefe-1);if(!tiefe)abschnitt.classList.remove("sg-dragover");};
  abschnitt.ondrop=e=>{
    e.preventDefault();tiefe=0;abschnitt.classList.remove("sg-dragover");
    if(!isBM())return;
    const dateien=[...e.dataTransfer.files].filter(f=>/^image\//i.test(f.type)||/\.hei[cf]$/i.test(f.name));
    if(dateien.length)galerieDateienHinzufuegen(dateien);
    else if(e.dataTransfer.files.length)toast("Das sind keine Bilddateien.");
  };
}

/* --- Fotos vom Brautag: eigene Galerie je Sud, mit optionaler Bildunterschrift.
   Hochladen/Löschen/Bearbeiten nur Braumeister/Admin (anders als bei Verkostungen keine Gäste-Uploads).
   Seit 25.10.2026 auch das Ansehen nur Braumeister/Admin vorbehalten (RLS: features/brews/schema/04_sud_fotos_nur_braumeister.sql),
   unabhängig vom „Öffentlich zeigen"-Status des Suds – Gäste sehen stattdessen einen Anmelde-Hinweis. --- */
let galerie=[],galerieSudId=null,galeriePending=[];
/* Aufnahmedatum (aus Exif) bzw. ersatzweise Hochlade-Datum, klein auf dem Vorschaubild: DD.MM.JJ */
function fotoDatum(g){
  const iso=g.aufgenommen||(g.angelegt?g.angelegt.slice(0,10):null);
  if(!iso)return null;
  const [y,m,d]=iso.split("-");
  return `${d.padStart(2,"0")}.${m.padStart(2,"0")}.${y.slice(-2)}`;
}
async function galerieLaden(sudId){
  galerieSudId=sudId;galeriePending=[];
  if(!isBM()){galerie=[];if(aktuellerSud&&aktuellerSud.id===sudId)galerieZeichnen();return;}
  const {data,error}=await sb.from("sud_bilder").select("id,pfad,bildunterschrift,aufgenommen,angelegt").eq("sud_id",sudId).order("angelegt");
  galerie=error?[]:(data||[]);
  if(aktuellerSud&&aktuellerSud.id===sudId)galerieZeichnen();
}
function galerieZeichnen(){
  const abschnitt=$("#sudGalerieSec"),el=$("#sudGalerie");
  if(!abschnitt||!el)return;
  const bm=isBM();
  abschnitt.hidden=false;
  if(!bm){el.innerHTML=`<p class="hint">Melde dich als Braumeister an, um die Fotos vom Brautag zu sehen.</p>`;return;}
  const addKachel=bm?`<button type="button" class="g-add" id="galerieAdd" aria-label="Fotos hinzufügen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="7"/><path d="M9 13a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z"/><path d="M8 6h2l1-2h2l1 2h2"/></svg>Fotos hinzufügen</button>`:"";
  const items=galerie.map(g=>({...g,datum:fotoDatum(g)}));
  el.innerHTML=Bilder.galerieHtml(items,{loeschbar:bm,bearbeitbar:bm,beschriftet:true,extra:addKachel})+(bm?`<p class="hint sg-drophint">oder Fotos direkt hierher ziehen</p>`:"");
  Bilder.galerieVerdrahten(el,items,bm?galerieLoeschenBestaetigen:null,bm?galerieBearbeiten:null);
  const add=$("#galerieAdd");if(add)add.onclick=()=>$("#galerieFile").click();
  galerieTrayZeichnen();
}
/* Bildunterschrift UND Aufnahmedatum bearbeiten (z. B. wenn ein Foto kein/ein falsches Exif-Datum hat).
   Leeres Datum = wieder automatisch (Exif, sonst Hochlade-Datum wie bisher). */
function galerieBearbeiten(i){
  const g=galerie[i],items=$("#sudGalerie").querySelectorAll(".g-item"),item=items[i];
  if(!item)return;
  item.querySelector(".g-cap").outerHTML=`<div class="g-edit-row">
    <input type="text" value="${esc(g.bildunterschrift||"")}" placeholder="Bildunterschrift (optional)" maxlength="200" aria-label="Bildunterschrift">
    <div class="g-edit-foot">
      <input type="date" value="${esc(g.aufgenommen||"")}" aria-label="Aufnahmedatum (leer = automatisch)">
      <button type="button" style="background:var(--hop)" data-save aria-label="Speichern">✓</button>
      <button type="button" style="background:var(--muted)" data-cancel aria-label="Abbrechen">✕</button>
    </div></div>`;
  const row=item.querySelector(".g-edit-row"),input=row.querySelector('input[type=text]'),datumInput=row.querySelector('input[type=date]');
  input.focus();input.select();
  const speichern=async()=>{
    const wert=input.value.trim()||null,aufgenommen=datumInput.value||null;
    row.querySelector("[data-save]").disabled=true;
    const {error}=await sb.from("sud_bilder").update({bildunterschrift:wert,aufgenommen}).eq("id",g.id);
    if(error){toast(fehlertext(error));galerieZeichnen();return;}
    g.bildunterschrift=wert;g.aufgenommen=aufgenommen;galerieZeichnen();toast("Gespeichert");
  };
  row.querySelector("[data-save]").onclick=speichern;
  row.querySelector("[data-cancel]").onclick=()=>galerieZeichnen();
  input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();speichern();}if(e.key==="Escape")galerieZeichnen();});
  datumInput.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();speichern();}if(e.key==="Escape")galerieZeichnen();});
}
function galerieLoeschenBestaetigen(i){
  const g=galerie[i];
  sheet("Foto löschen?",`<p>Dieses Foto${g.bildunterschrift?` („${esc(g.bildunterschrift)}“)`:""} wird endgültig gelöscht.</p>`,
    `<span class="spacer"></span><button class="btn" id="noDelFoto">Abbrechen</button><button class="btn danger" id="yesDelFoto">Ja, löschen</button>`);
  $("#noDelFoto").onclick=closeSheet;
  $("#yesDelFoto").onclick=async()=>{
    $("#yesDelFoto").disabled=true;
    const {error}=await sb.from("sud_bilder").delete().eq("id",g.id);
    if(error){toast(fehlertext(error));closeSheet();return;}
    Bilder.loeschen(g.pfad);
    galerie=galerie.filter(x=>x.id!==g.id);
    closeSheet();galerieZeichnen();toast("Foto gelöscht");
  };
}
/* Dateien hinzufügen (per Dateiauswahl ODER per Drag & Drop aus z. B. der Mac-Fotos-Mediathek): jedes Bild
   sofort verkleinern (noch nicht hochladen), in die Ablage legen – dort je Bild eine optionale Bildunterschrift
   eintragen. HEIC/HEIF wird dafür zuerst nach JPEG umgewandelt (Bilder.alsJpegDatei) – das Exif-Aufnahmedatum
   wird aber vom Original gelesen, bevor die Umwandlung es verliert. */
async function galerieDateienHinzufuegen(dateien){
  for(const original of dateien){
    try{
      const [aufgenommen,datei]=await Promise.all([Bilder.exifDatum(original),Bilder.alsJpegDatei(original)]);
      const bild=await Bilder.ladeBild(datei);
      const blobs=await Bilder.verkleinern(bild);
      galeriePending.push({url:URL.createObjectURL(datei),blobs,caption:"",aufgenommen});
    }catch(e){toast(e.message);}
  }
  galerieTrayZeichnen();
}
async function galerieDateienGewaehlt(){
  const dateien=[...$("#galerieFile").files];$("#galerieFile").value="";
  await galerieDateienHinzufuegen(dateien);
}
function galerieTrayZeichnen(){
  const abschnitt=$("#sudGalerieSec");if(!abschnitt)return;
  let tray=$("#galerieTray");
  if(!galeriePending.length){if(tray)tray.remove();return;}
  if(!tray){tray=document.createElement("div");tray.className="sg-tray";tray.id="galerieTray";abschnitt.appendChild(tray);}
  tray.innerHTML=`<h4>${galeriePending.length} Foto${galeriePending.length===1?"":"s"} ausgewählt – Bildunterschrift optional</h4>
    <div class="sg-pending">${galeriePending.map((p,i)=>`<div class="sg-pend-row"><img src="${p.url}" alt=""><input type="text" data-pend="${i}" placeholder="Bildunterschrift (optional)" value="${esc(p.caption)}" maxlength="200" aria-label="Bildunterschrift Foto ${i+1}"><button type="button" class="x" data-pendweg="${i}" aria-label="Dieses Foto nicht hochladen">✕</button></div>`).join("")}</div>
    <div class="sg-tray-foot"><button type="button" class="btn" id="galerieTrayAbbrechen">Abbrechen</button><button type="button" class="btn primary" id="galerieTrayHochladen">Hochladen</button></div>`;
  tray.querySelectorAll("[data-pend]").forEach(inp=>inp.oninput=()=>{galeriePending[+inp.dataset.pend].caption=inp.value;});
  tray.querySelectorAll("[data-pendweg]").forEach(b=>b.onclick=()=>{galeriePending.splice(+b.dataset.pendweg,1);galerieTrayZeichnen();});
  $("#galerieTrayAbbrechen").onclick=()=>{galeriePending.forEach(p=>URL.revokeObjectURL(p.url));galeriePending=[];galerieTrayZeichnen();};
  $("#galerieTrayHochladen").onclick=galerieHochladen;
}
async function galerieHochladen(){
  const btn=$("#galerieTrayHochladen");btn.disabled=true;btn.textContent="Wird hochgeladen …";
  const basis=`sude/${galerieSudId}/galerie/foto`,anzahl=galeriePending.length;
  const neu=[];
  for(const p of galeriePending){
    try{
      const pfad=await Bilder.hochladen(basis,p.blobs);
      const {data,error}=await sb.from("sud_bilder").insert({sud_id:galerieSudId,pfad,bildunterschrift:p.caption.trim()||null,aufgenommen:p.aufgenommen||null}).select().single();
      if(error)throw error;
      neu.push(data);
    }catch(e){toast(fehlertext(e));}
    URL.revokeObjectURL(p.url);
  }
  galerie=galerie.concat(neu);galeriePending=[];
  galerieZeichnen();
  if(neu.length)toast(`${neu.length} Foto${neu.length===1?"":"s"} hochgeladen`);
}
/* --- Checkliste zum Brautag ---
   Schritte werden aus den Sud-Daten abgeleitet (Rasten, Hopfengaben, Kochzeit) – schritteAbleiten(), kein
   eigenes Datenmodell dafür. sud_schritte hält nur den Fortschritt: ein abgeleiteter Schritt (schluessel
   gesetzt) existiert als Zeile nur, solange er abgehakt ist (Abhaken=anlegen, Abwählen=löschen); ein eigener
   Zusatzschritt (schluessel NULL, text gesetzt) existiert dauerhaft ab dem Anlegen, mit eigenem erledigt-
   Status zum Umschalten. Nur Braumeister/Admin – reines Arbeitswerkzeug, wie die Fotogalerie. */
const PHASEN=[["schuettung","Schüttung"],["maischen","Maischen"],["laeutern","Läutern"],["kochen","Kochen"],["kuehlen","Kühlen & Anstellen"],["gaerung","Gärung"]];
function hopfenLabel(h){return[h.gramm!=null?Bz.fmtGramm(h.gramm):"",h.sorte].filter(Boolean).join(" ")||"Hopfengabe";}
function schritteAbleiten(b){
  const g={schuettung:[],maischen:[],laeutern:[],kochen:[],kuehlen:[],gaerung:[]};
  const total=malzSum(b);
  if(total)g.schuettung.push({schluessel:"schuettung",label:`Schüttung abwiegen (${fmtKg(total)})`});
  if(b.einmaischtemperatur!=null)g.maischen.push({schluessel:"einmaischen",label:`Einmaischen auf ${Bz.fmtZahl(b.einmaischtemperatur)} °C`});
  (b.rasten||[]).forEach((r,i)=>{if(r.temperatur==null&&r.zeit==null)return;
    g.maischen.push({schluessel:`rast-${i}`,label:`Rast ${i+1}${r.temperatur!=null?": "+Bz.fmtZahl(r.temperatur)+" °C":""}${r.zeit!=null?" · "+Bz.fmtZahl(r.zeit,0)+" min":""}`});});
  if(b.abmaischtemperatur!=null)g.maischen.push({schluessel:"abmaischen",label:`Abmaischen auf ${Bz.fmtZahl(b.abmaischtemperatur)} °C`});
  const hopfen=(b.hopfen||[]).map((h,i)=>({...hopfenNeu(h),i})).filter(h=>h.sorte||h.gramm);
  g.laeutern.push({schluessel:"laeutern",label:"Läutern"+(b.laeutern?" – "+b.laeutern:"")});
  hopfen.filter(h=>h.typ==="Vorderwuerze").forEach(h=>g.laeutern.push({schluessel:`hopfen-${h.i}`,label:`Vorderwürze zugeben: ${hopfenLabel(h)}`}));
  g.kochen.push({schluessel:"kochbeginn",label:"Kochbeginn"+(b.kochzeit!=null?` (${Bz.fmtZahl(b.kochzeit,0)} min)`:"")});
  hopfen.filter(h=>h.typ==="Kochen").sort((a,c)=>(c.zeit??-1)-(a.zeit??-1))
    .forEach(h=>g.kochen.push({schluessel:`hopfen-${h.i}`,label:`${hopfenLabel(h)} zugeben${h.zeit!=null?` (kocht noch ${Bz.fmtZahl(h.zeit,0)} min mit)`:""}`}));
  g.kochen.push({schluessel:"kochende",label:"Kochende"});
  hopfen.filter(h=>h.typ==="Whirlpool").forEach(h=>g.kochen.push({schluessel:`hopfen-${h.i}`,label:`Whirlpool: ${hopfenLabel(h)} zugeben`}));
  g.kuehlen.push({schluessel:"kuehlen",label:"Kühlen & Ausschlagen"+(b.wuerze!=null?` auf ${Bz.fmtZahl(b.wuerze)} l`:"")});
  g.kuehlen.push({schluessel:"hefe",label:"Hefe anstellen"+(b.hefe?": "+b.hefe:"")});
  hopfen.filter(h=>h.typ==="Stopfen").forEach(h=>g.gaerung.push({schluessel:`hopfen-${h.i}`,label:`Stopfhopfen zugeben: ${hopfenLabel(h)}`}));
  return PHASEN.map(([k,titel])=>({k,titel,schritte:g[k]})).filter(p=>p.schritte.length);
}
let checklisteSud=null,checklisteSchritte=[],checklisteGruppen=[];
async function zeigeChecklist(b){
  checklisteSud=b;checklisteGruppen=schritteAbleiten(b);
  $("#overview").hidden=true;$("#filter").hidden=true;$("#sudeActions").hidden=true;
  $("#list").innerHTML=`<p class="noprint"><a class="back" id="checklisteZurueck" href="index.html?sud=${esc(b.id)}">← ${esc(title(b))}</a></p>
    <article class="sud-blatt">
      <h2>Checkliste: ${esc(title(b))}</h2>
      <p class="hint" id="checklisteFortschritt"></p>
      <div id="checklisteBody"></div>
    </article>`;
  $("#checklisteZurueck").onclick=e=>{e.preventDefault();zeigeDetail(b);};
  const {data,error}=await sb.from("sud_schritte").select("*").eq("sud_id",b.id).order("angelegt");
  if(error)toast(fehlertext(error));
  checklisteSchritte=error?[]:(data||[]);
  checklisteZeichnen();
}
function checklisteZeichnen(){
  if(!checklisteGruppen.length){$("#checklisteFortschritt").textContent="";$("#checklisteBody").innerHTML=`<p class="empty">Für diesen Sud ergeben sich noch keine Schritte – trag zuerst Maischplan und/oder Hopfengaben ein.</p>`;return;}
  const erledigteSchluessel=new Set(checklisteSchritte.filter(s=>s.schluessel).map(s=>s.schluessel));
  const eigeneNachGruppe={};
  checklisteSchritte.filter(s=>!s.schluessel).forEach(c=>{(eigeneNachGruppe[c.gruppe]=eigeneNachGruppe[c.gruppe]||[]).push(c);});
  let gesamt=0,offen=0;
  const item=(schluessel,id,label,erl)=>{gesamt++;if(!erl)offen++;
    return`<div class="chk-item"><label class="chk-row${erl?" done":""}"><input type="checkbox" data-schluessel="${esc(schluessel||"")}" data-id="${esc(id||"")}"${erl?" checked":""}><span>${esc(label)}</span></label>${schluessel?"":`<button type="button" class="x" data-del-eigen="${esc(id)}" aria-label="Schritt entfernen">✕</button>`}</div>`;};
  const body=checklisteGruppen.map(p=>{
    const rows=p.schritte.map(s=>item(s.schluessel,null,s.label,erledigteSchluessel.has(s.schluessel)))
      .concat((eigeneNachGruppe[p.k]||[]).map(c=>item(null,c.id,c.text,c.erledigt)))
      .join("");
    return`<fieldset class="chk-gruppe" data-gruppe="${esc(p.k)}"><legend>${esc(p.titel)}</legend>${rows}<button type="button" class="add" data-eigen="${esc(p.k)}">+ Eigener Schritt</button></fieldset>`;
  }).join("");
  $("#checklisteBody").innerHTML=body;
  $("#checklisteFortschritt").textContent=`${gesamt-offen} von ${gesamt} erledigt`;
  $("#checklisteBody").querySelectorAll("input[type=checkbox]").forEach(cb=>cb.onchange=()=>checklisteUmschalten(cb));
  $("#checklisteBody").querySelectorAll("[data-del-eigen]").forEach(btn=>btn.onclick=()=>eigenenSchrittLoeschen(btn.dataset.delEigen));
  $("#checklisteBody").querySelectorAll("[data-eigen]").forEach(btn=>btn.onclick=()=>eigenerSchrittEingabe(btn));
}
async function checklisteUmschalten(cb){
  cb.disabled=true;
  const schluessel=cb.dataset.schluessel,id=cb.dataset.id,erl=cb.checked;
  if(schluessel){
    if(erl){
      const{data,error}=await sb.from("sud_schritte").insert({sud_id:checklisteSud.id,schluessel,erledigt:true,erledigt_am:new Date().toISOString(),erledigt_von:state.profile?.id}).select().single();
      if(error){toast(fehlertext(error));cb.checked=false;cb.disabled=false;return;}
      checklisteSchritte.push(data);
    }else{
      const{error}=await sb.from("sud_schritte").delete().eq("sud_id",checklisteSud.id).eq("schluessel",schluessel);
      if(error){toast(fehlertext(error));cb.checked=true;cb.disabled=false;return;}
      checklisteSchritte=checklisteSchritte.filter(s=>s.schluessel!==schluessel);
    }
  }else{
    const{error}=await sb.from("sud_schritte").update({erledigt:erl,erledigt_am:erl?new Date().toISOString():null,erledigt_von:erl?state.profile?.id:null}).eq("id",id);
    if(error){toast(fehlertext(error));cb.checked=!erl;cb.disabled=false;return;}
    const c=checklisteSchritte.find(s=>s.id===id);if(c)c.erledigt=erl;
  }
  checklisteZeichnen();
}
function eigenerSchrittEingabe(btn){
  const gruppe=btn.dataset.eigen,wrap=btn.closest("fieldset");
  btn.outerHTML=`<div class="chk-eigen-eingabe"><input type="text" placeholder="Eigener Schritt" maxlength="200" aria-label="Eigener Schritt"><button type="button" class="btn" data-abbrechen-eigen>Abbrechen</button><button type="button" class="btn primary" data-speichern-eigen>Hinzufügen</button></div>`;
  const row=wrap.querySelector(".chk-eigen-eingabe"),input=row.querySelector("input");
  input.focus();
  const abbrechen=()=>checklisteZeichnen();
  const speichern=async()=>{
    const text=input.value.trim();if(!text)return;
    row.querySelector("[data-speichern-eigen]").disabled=true;
    const{data,error}=await sb.from("sud_schritte").insert({sud_id:checklisteSud.id,text,gruppe,erledigt:false}).select().single();
    if(error){toast(fehlertext(error));abbrechen();return;}
    checklisteSchritte.push(data);checklisteZeichnen();
  };
  row.querySelector("[data-abbrechen-eigen]").onclick=abbrechen;
  row.querySelector("[data-speichern-eigen]").onclick=speichern;
  input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();speichern();}if(e.key==="Escape")abbrechen();});
}
function eigenenSchrittLoeschen(id){
  const c=checklisteSchritte.find(s=>s.id===id);if(!c)return;
  sheet("Schritt entfernen?",`<p>„${esc(c.text)}“ wird aus der Checkliste entfernt.</p>`,
    `<span class="spacer"></span><button class="btn" id="noDelSchritt">Abbrechen</button><button class="btn danger" id="yesDelSchritt">Ja, entfernen</button>`);
  $("#noDelSchritt").onclick=closeSheet;
  $("#yesDelSchritt").onclick=async()=>{
    $("#yesDelSchritt").disabled=true;
    const{error}=await sb.from("sud_schritte").delete().eq("id",id);
    if(error){toast(fehlertext(error));closeSheet();return;}
    checklisteSchritte=checklisteSchritte.filter(s=>s.id!==id);
    closeSheet();checklisteZeichnen();
  };
}
function confirmDelete(b){
  sheet("Sud löschen?",`<p>„${esc(title(b))}“ vom ${esc(fmtDate(b.datum))}${esc(b.datum?.slice(0,4)||"")} wird endgültig gelöscht.</p>`,
    `<span class="spacer"></span><button class="btn" id="noDel">Abbrechen</button><button class="btn danger" id="yesDel">Ja, löschen</button>`);
  $("#noDel").onclick=closeSheet;
  $("#yesDel").onclick=async()=>{$("#yesDel").disabled=true;
    const {data,error}=await sb.from("sude").delete().eq("id",b.id).select("id");
    if(error||!data||!data.length){toast(error?fehlertext(error):"Löschen ist nur dem Admin erlaubt.");closeSheet();return;}
    Bilder.loeschen(b.bild_foto);Bilder.loeschen(b.bild_etikett);
    state.brews=state.brews.filter(x=>x.id!==b.id);closeSheet();toast("Sud gelöscht");
    location.href="index.html";
  };
}
/* --- Editor --- */
const FIELDS=[
 ["Grunddaten",[["datum","Braudatum","date"],["stil","Stil / Name"],["etikett","Kronkorken","cap"],["bewertung","Bewertung (0–10, 10 = beste Note)","note"]]],
 ["Brauwasser",[["hauptguss","Hauptguss in Litern","number"],["nachguss","Nachguss in Litern","number"],["wasser","Wasserbehandlung (Milchsäure, pH)"]]],
 ["Läutern & Kochen",[["laeutern","Läutern"],["kochzeit","Kochzeit in Minuten","integer"],["wuerze","Würzemenge in Litern","number"],["stammwuerze","Stammwürze in °P","number"]]],
 ["Gärung",[["hefe","Hefesorte"],["hefemenge","Hefemenge"],["messungen","Messungen"],["restextrakt","Restextrakt in °P","number"]]],
 ["Abfüllung",[["ausschlag","Ausschlagwürze in Litern","number"],["biermenge","Biermenge in Litern","number"],["zucker","Speise / Zucker"],["flaschen","Flaschen","integer"],["alkohol","Alkohol in % vol","number"],["abgefuellt","Abgefüllt am","date"]]],
 ["Maischplan",[["einmaischtemperatur","Einmaischtemperatur in °C","number"],["abmaischtemperatur","Abmaischtemperatur in °C","number"]]],
];
function field([k,label,type],v){
  const id="f_"+k;
  if(type==="cap")return`<label class="f" for="${id}">${label}<select id="${id}" name="${k}"><option value="">Keiner</option>${Object.keys(CAPS).map(c=>`<option value="${c}"${v===c?" selected":""}>${CAP_LABEL[c]}</option>`).join("")}</select></label>`;
  if(type==="note")return`<label class="f" for="${id}">${label}<input id="${id}" name="${k}" type="number" min="0" max="10" step="0.1" inputmode="decimal" value="${esc(v??"")}"></label>`;
  const num=type==="number"||type==="integer";
  return`<label class="f" for="${id}">${label}<input id="${id}" name="${k}" type="${num?"number":(type||"text")}"${type==="number"?' step="any" inputmode="decimal"':""}${type==="integer"?' step="1" min="0" inputmode="numeric"':""} value="${esc(v??"")}"></label>`;
}
function rowsHTML(kind,items){
  if(kind==="malz")return items.map((m,i)=>`<div class="r"><input id="malz_s_${i}" placeholder="Malzsorte" value="${esc(m.sorte)}" aria-label="Malzsorte"><input id="malz_g_${i}" type="number" step="any" inputmode="decimal" placeholder="Gramm" value="${esc(m.gramm??"")}" aria-label="Menge in Gramm"><input id="malz_e_${i}" type="number" step="any" inputmode="decimal" placeholder="EBC" value="${esc(m.ebc??"")}" aria-label="Farbe in EBC"><button type="button" class="x" data-del="malz" data-i="${i}" aria-label="Zeile entfernen">✕</button></div>`).join("");
  if(kind==="hopfen")return items.map((h,i)=>`<div class="r"><input id="hop_s_${i}" placeholder="Sorte" value="${esc(h.sorte)}" aria-label="Hopfensorte"><input id="hop_g_${i}" type="number" step="any" inputmode="decimal" placeholder="Gramm" value="${esc(h.gramm??"")}" aria-label="Menge in Gramm"><input id="hop_a_${i}" type="number" step="any" inputmode="decimal" placeholder="% α" value="${esc(h.alpha??"")}" aria-label="Alphasäure in Prozent"><input id="hop_z_${i}" type="number" step="any" inputmode="numeric" placeholder="min" value="${esc(h.zeit??"")}" aria-label="Kochzeit der Gabe in Minuten"><select id="hop_t_${i}" aria-label="Art der Hopfengabe">${Object.entries(TYP).map(([k,l])=>`<option value="${k}"${h.typ===k?" selected":""}>${l}</option>`).join("")}</select><button type="button" class="x" data-del="hopfen" data-i="${i}" aria-label="Zeile entfernen">✕</button></div>${h.alt?`<small class="hint">vorher: ${esc(h.alt)}</small>`:""}`).join("");
  return items.map((r,i)=>`<div class="r"><input id="rast_t_${i}" type="number" step="any" inputmode="decimal" placeholder="°C" value="${esc(r.temperatur??"")}" aria-label="Temperatur der ${i+1}. Rast"><input id="rast_z_${i}" type="number" step="1" min="0" inputmode="numeric" placeholder="min" value="${esc(r.zeit??"")}" aria-label="Dauer der ${i+1}. Rast in Minuten"><button type="button" class="x" data-del="rasten" data-i="${i}" aria-label="Zeile entfernen">✕</button></div>`).join("");
}
let draft=null,editingId=null,bildBasis="",bearbeitenInline=false;
function openEditor(src,asCopy){
  if(!isBM())return;
  bearbeitenInline=false;
  const nextNr=Math.max(0,...state.brews.map(b=>+b.nr||0))+1;
  if(src&&src.ausRezept){draft=Object.assign({nr:nextNr,datum:todayIso(),oeffentlich:false},src.draft);editingId=null;}
  else if(!src){draft={nr:nextNr,datum:todayIso(),oeffentlich:false,malz:[{sorte:"",gramm:"",ebc:null}],rasten:[{temperatur:"",zeit:""}],hopfen:[hopfenNeu(null)]};editingId=null;}
  else if(asCopy){draft=JSON.parse(JSON.stringify(src));delete draft.id;delete draft.rezept_id;Object.assign(draft,{nr:nextNr,datum:todayIso(),bewertung:"",messungen:"",restextrakt:null,ausschlag:null,biermenge:null,flaschen:null,alkohol:null,abgefuellt:null,notizen:"",datum_geschaetzt:false,oeffentlich:false,bild_foto:null,bild_etikett:null});editingId=null;}
  else{draft=JSON.parse(JSON.stringify(src));editingId=src.id;}
  ["malz","rasten","hopfen"].forEach(k=>{if(!Array.isArray(draft[k]))draft[k]=[];});
  draft.hopfen=draft.hopfen.map(hopfenNeu);
  bildBasis=`sude/${editingId||"neu-"+crypto.randomUUID()}`;
  $("#sheetTitle").textContent=editingId?`Sud ${draft.nr} bearbeiten`:asCopy?`Neuer Sud nach Vorlage`:src&&src.ausRezept?`Neuer Sud nach „${src.name}“`:"Neuer Sud";
  drawForm("#sheetBody");
  $("#sheetFoot").innerHTML=`<span class="err" id="formErr"></span><span class="spacer"></span><button class="btn" id="cancelEdit">Abbrechen</button><button class="btn primary" id="saveBtn">${editingId?"Änderungen speichern":"Sud anlegen"}</button>`;
  $("#cancelEdit").onclick=closeSheet;
  $("#saveBtn").onclick=save;
  openSheet();$("#sheetBody").scrollTop=0;
}
/* Bestehenden Sud direkt auf seiner Detailseite bearbeiten, ohne Seitenblatt: das Formular ersetzt
   die Ansicht an Ort und Stelle (wie openEditor, aber ohne Sheet). Neuanlegen/Kopieren/Aus-Rezept
   bleiben beim Sheet, weil es dafür noch keine eigene Detailseite gibt. */
function editInline(b){
  if(!isBM())return;
  bearbeitenInline=true;
  draft=JSON.parse(JSON.stringify(b));editingId=b.id;
  ["malz","rasten","hopfen"].forEach(k=>{if(!Array.isArray(draft[k]))draft[k]=[];});
  draft.hopfen=draft.hopfen.map(hopfenNeu);
  bildBasis=`sude/${editingId}`;
  $("#list").innerHTML=`<p class="noprint"><a class="back" href="index.html">← Alle Sude</a></p>
    <article class="sud-blatt">
      <h2>Sud ${esc(draft.nr)} bearbeiten</h2>
      <div id="sudEditBody"></div>
      <div class="sheet-foot noprint" style="border-top:1px solid var(--line);margin-top:4px">
        <span class="err" id="formErr"></span><span class="spacer"></span>
        <button type="button" class="btn" id="cancelEdit">Abbrechen</button>
        <button type="button" class="btn primary" id="saveBtn">Änderungen speichern</button>
      </div>
    </article>`;
  drawForm("#sudEditBody");
  $("#cancelEdit").onclick=()=>zeigeDetail(b);
  $("#saveBtn").onclick=save;
  window.scrollTo({top:0,behavior:"smooth"});
}
function drawForm(ziel){
  ziel=ziel||"#sheetBody";
  const d=draft;const fs=(t,inner)=>`<fieldset><legend>${t}</legend>${inner}</fieldset>`;
  $(ziel).innerHTML=`<form id="form" novalidate>
    ${fs("Grunddaten",`<div class="grid2">${FIELDS[0][1].map(f=>field(f,d[f[0]])).join("")}</div>
      <label class="check"><input type="checkbox" id="f_oeffentlich" name="oeffentlich"${d.oeffentlich?" checked":""}><span><b>Öffentlich zeigen</b><br><span class="hint">Gäste sehen dann Werte, Schüttung, Hopfen und Hefe – Notizen und Bewertung bleiben intern.</span></span></label>`)}
    ${fs("Bilder",`<div class="grid2">${Bilder.feldHtml("bf_foto",d.bild_foto,{art:"frei",beschriftung:"Foto vom Sud"})}${Bilder.feldHtml("bf_etikett",d.bild_etikett,{art:"frei",beschriftung:"Etikett"})}</div><p class="hint">Beides freiwillig. Das Foto erscheint oben in der Ansicht, das Etikett als Vorschaubild in der Liste.</p>`)}
    ${fs("Schüttung",`<div class="rowlist m3" id="rl_malz">${rowsHTML("malz",d.malz)}</div><button type="button" class="add" data-add="malz">+ Malz</button>`)}
    ${fs("Brauwasser",`<div class="grid2">${FIELDS[1][1].map(f=>field(f,d[f[0]])).join("")}</div>`)}
    ${fs("Maischplan",`<div class="grid2">${FIELDS[5][1].map(f=>field(f,d[f[0]])).join("")}</div>${d.maischplan_alt&&d.maischplan_alt.length?`<p class="hint">Vorher (Freitext): ${esc(d.maischplan_alt.join(" · "))}</p>`:""}<div class="rowlist" id="rl_rasten">${rowsHTML("rasten",d.rasten)}</div><button type="button" class="add" data-add="rasten">+ Rast</button>`)}
    ${fs("Läutern & Kochen",`<div class="grid2">${FIELDS[2][1].map(f=>field(f,d[f[0]])).join("")}</div>`)}
    ${fs("Hopfen",`<label class="f" for="f_hopfensorten">Hopfensorten mit Alphasäure<input id="f_hopfensorten" name="hopfensorten" value="${esc(d.hopfensorten??"")}"></label><div class="rowlist h5" id="rl_hopfen">${rowsHTML("hopfen",d.hopfen)}</div><button type="button" class="add" data-add="hopfen">+ Hopfengabe</button><p class="hint">Zeit = Kochzeit der Gabe in Minuten; bei Stopfhopfen leer lassen.</p>`)}
    ${fs("Gärung",`<div class="grid2">${FIELDS[3][1].map(f=>field(f,d[f[0]])).join("")}</div>`)}
    ${fs("Abfüllung",`<div class="grid2">${FIELDS[4][1].map(f=>field(f,d[f[0]])).join("")}</div>`)}
    ${fs("Notizen (intern)",`<label class="f" for="f_notizen">Was ist aufgefallen?<textarea id="f_notizen" name="notizen">${esc(d.notizen??"")}</textarea></label>`)}
  </form>`;
  $("#form").onsubmit=e=>{e.preventDefault();save();};
  Bilder.feldVerdrahten("bf_foto",{art:"frei",basis:bildBasis+"/foto",titel:"Foto vom Sud",geaendert:p=>{draft.bild_foto=p;}});
  Bilder.feldVerdrahten("bf_etikett",{art:"frei",basis:bildBasis+"/etikett",titel:"Etikett",geaendert:p=>{draft.bild_etikett=p;}});
  const scrollTop=()=>bearbeitenInline?window.scrollY:$("#sheetBody").scrollTop;
  const scrollWiederherstellen=top=>{if(bearbeitenInline)window.scrollTo(0,top);else $("#sheetBody").scrollTop=top;};
  $("#form").querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{collect();const k=b.dataset.add;draft[k].push(k==="malz"?{sorte:"",gramm:"",ebc:null}:k==="hopfen"?hopfenNeu(null):k==="rasten"?{temperatur:"",zeit:""}:"");const top=scrollTop();drawForm(ziel);scrollWiederherstellen(top);});
  $("#form").querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{collect();draft[b.dataset.del].splice(+b.dataset.i,1);const top=scrollTop();drawForm(ziel);scrollWiederherstellen(top);});
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
  draft.rasten=draft.rasten.map((_,i)=>({temperatur:nz("#rast_t_"+i),zeit:nz("#rast_z_"+i)}));
}
async function save(){
  collect();
  const err=$("#formErr");
  if(!draft.datum){err.textContent="Bitte ein Braudatum eintragen.";$("#f_datum")?.focus();return;}
  if(draft.flaschen!=null&&!Number.isInteger(draft.flaschen)){err.textContent="Flaschen bitte als ganze Zahl eintragen.";$("#f_flaschen")?.focus();return;}
  if(draft.bewertung!=null&&(draft.bewertung<0||draft.bewertung>10)){err.textContent="Bitte eine Bewertung zwischen 0 und 10 eintragen.";$("#f_bewertung")?.focus();return;}
  const out={};WRITE_COLS.forEach(k=>{let v=draft[k];if(v==="")v=null;if(v!==undefined)out[k]=v;});
  out.malz=(draft.malz||[]).filter(m=>m.sorte||m.gramm);out.hopfen=(draft.hopfen||[]).filter(h=>h.sorte||h.gramm).map(({alt,...h})=>({...h,zeit:h.typ==="Stopfen"?null:h.zeit}));out.rasten=(draft.rasten||[]).filter(r=>r.temperatur!=null||r.zeit!=null);
  out.oeffentlich=!!draft.oeffentlich;out.datum_geschaetzt=!!draft.datum_geschaetzt;out.alkohol_geschaetzt=!!draft.alkohol_geschaetzt;
  if(editingId&&out.datum!==state.brews.find(b=>b.id===editingId)?.datum)out.datum_geschaetzt=false;
  if(editingId&&out.alkohol!==state.brews.find(b=>b.id===editingId)?.alkohol)out.alkohol_geschaetzt=false;
  const btn=$("#saveBtn");btn.disabled=true;err.textContent="";
  const q=editingId?sb.from("sude").update(out).eq("id",editingId):sb.from("sude").insert(out);
  const {data,error}=await q.select().single();
  if(error){btn.disabled=false;err.textContent=fehlertext(error);return;}
  const alt=editingId&&state.brews.find(b=>b.id===editingId);
  if(alt)["bild_foto","bild_etikett"].forEach(k=>{if(alt[k]&&alt[k]!==data[k])Bilder.loeschen(alt[k]);});
  state.brews=state.brews.filter(b=>b.id!==data.id).concat([data]);
  if(!bearbeitenInline)closeSheet();
  if(editingId&&aktuellerSud&&aktuellerSud.id===editingId){toast("Gespeichert");zeigeDetail(data);}
  else{toast(editingId?"Gespeichert":`Sud ${data.nr} angelegt`);location.href="index.html?sud="+data.id;}
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
    closeSheet();
    openWizard(r.name,draftAusRezept(u,r,ziel,mitAnl));
  };
}
function draftAusRezept(u,r,ziel,mitAnl){
  const t=v=>v==null?"":Bz.fmtZahl(v);
  const sorten=[...new Map((u.hopfen||[]).filter(h=>h.sorte).map(h=>[h.sorte,h.alpha])).entries()].map(([s,a])=>a!=null?`${s} ${t(a)} %`:s).join(", ");
  const ziele=[r.stammwuerze!=null?`${t(r.stammwuerze)} °P`:"",r.bittere!=null?`${t(r.bittere)} IBU`:"",r.farbe!=null?`${t(r.farbe)} EBC`:"",r.alkohol!=null?`${t(r.alkohol)} % Alkohol`:""].filter(Boolean).join(" · ");
  const gaer=[r.gaertemperatur?`Gärtemperatur ${r.gaertemperatur}${/°/.test(r.gaertemperatur)?"":" °C"}`:"",r.endvergaerungsgrad!=null?`EVG ${t(r.endvergaerungsgrad)} %`:"",r.karbonisierung!=null?`Karbonisierung ${t(r.karbonisierung)} g/l`:""].filter(Boolean).join(" · ");
  return{stil:r.name,rezept_id:r.id,
    hauptguss:u.hauptguss??null,nachguss:u.nachguss??null,
    einmaischtemperatur:u.einmaischtemperatur??null,abmaischtemperatur:u.abmaischtemperatur??null,
    rasten:(u.rasten||[]).map(x=>({temperatur:x.temperatur,zeit:x.zeit})),
    kochzeit:u.kochzeit??null,
    malz:(u.malze||[]).map(m=>({sorte:m.name,gramm:m.gramm,ebc:m.ebc??null})),
    hopfen:(u.hopfen||[]).map(h=>({sorte:h.sorte,gramm:h.gramm,alpha:h.alpha,zeit:h.zeit,typ:h.typ})),
    hopfensorten:sorten,hefe:r.hefe||"",
    notizen:`Nach Rezept „${r.name}“, umgerechnet auf ${t(ziel)} l Ausschlagwürze${mitAnl?" (Anlagenprofil)":""}.${ziele?"\nZiel: "+ziele:""}${gaer?"\n"+gaer:""}`};
}
/* Rückweg: aus einem Sud ein Rezept machen */
async function rezeptAusSud(b){
  const n=v=>v==null||v===""?null:Bz.zahl(v);
  const r={name:title(b),autor:"Koldingbräu",quelle:`aus Sud Nr. ${b.nr} (${fmtDate(b.datum)}${b.datum?b.datum.slice(0,4):""})`,aus_sud_id:b.id,
    ausschlag:n(b.ausschlag)??n(b.wuerze)??n(b.biermenge),stammwuerze:n(b.stammwuerze),alkohol:n(b.alkohol),
    hauptguss:n(b.hauptguss),nachguss:n(b.nachguss),kochzeit:n(b.kochzeit),einmaischtemperatur:n(b.einmaischtemperatur),abmaischtemperatur:n(b.abmaischtemperatur),
    rasten:(b.rasten||[]).map(x=>({temperatur:x.temperatur,zeit:x.zeit})),
    malze:(b.malz||[]).filter(m=>m.sorte||m.gramm).map(m=>({name:m.sorte,gramm:Bz.zahl(m.gramm),ebc:m.ebc!=null&&m.ebc!==""?Bz.zahl(m.ebc):Bz.malzEbc(m.sorte)})),
    hopfen:(b.hopfen||[]).map(hopfenNeu).filter(h=>h.sorte||h.gramm).map(({alt,...h})=>h),
    hefe:b.hefe||null,anmerkung:[b.hefemenge?`Hefemenge: ${b.hefemenge}`:"",b.wasser?`Wasser: ${b.wasser}`:"",b.laeutern?`Läutern: ${b.laeutern}`:"",b.notizen||""].filter(Boolean).join("\n")||null,oeffentlich:false};
  if(r.stammwuerze&&r.ausschlag){const kg=r.malze.reduce((a,m)=>a+(m.gramm||0),0)/1000;if(kg)r.sudhausausbeute=Bz.runde(r.ausschlag*r.stammwuerze/100*Bz.sgAusPlato(r.stammwuerze)/kg*100,1);}
  $("#rzBtn").disabled=true;
  const {data,error}=await sb.from("rezepte").insert(r).select("id").single();
  if(error){$("#rzBtn").disabled=false;toast(fehlertext(error));return;}
  toast("Rezept angelegt");location.href="rezepte.html?id="+data.id;
}
/* --- Braugang-Assistent ---
   Eigenständiges Werkzeug (siehe features/brews/README.md), getrennt von der Checkliste: die Checkliste hakt
   vorgegebene Aufgaben ab, der Assistent erfasst die tatsächlichen Werte eines aus einem Rezept gestarteten
   Braugangs, Schritt für Schritt. Es gibt kein eigenes Datenmodell dafür – jedes Feld schreibt direkt in die
   schon bestehende Spalte von public.sude (dieselben, die auch der normale Editor benutzt), nur Wasserhärte/
   Milchsäure/pH/Refraktometer und die Zwischenmessungen während der Gärung sind neu (Migration 08).
   Der Sud-Entwurf entsteht sofort bei Schritt 1 (Status "entwurf"), nicht erst am Ende – dadurch taucht er
   schon während des Brauens in der normalen Sudliste auf. Jedes Feld speichert für sich, mit kurzer
   Verzögerung (wizardQueueSave), damit ein versehentliches Neuladen nichts verliert: beim erneuten Öffnen
   wird einfach der zuletzt gespeicherte Stand aus Supabase geladen, kein eigener Zwischenspeicher im Browser
   nötig. "Gärung & Abfüllen" bleibt offen, bis bewusst auf "Sud abschließen" geklickt wird (Status "gaerung"
   → "dokumentiert") – bis dahin lässt sich jederzeit zurückkommen, um eine weitere Zwischenmessung einzutragen. */
const WIZARD_STEPS=[
  ["uebersicht","Rezept & Start"],["wasser","Wasser & Milchsäure"],["schuettung","Schüttung"],
  ["maischen","Maischen"],["laeutern","Läutern"],["kochen","Kochen"],["anstellen","Kühlen & Anstellen"],
  ["gaerung","Gärung"],["abfuellung","Abfüllung"],
];
// [Spalte, Beschriftung, Typ] je Schritt – dieselbe Form wie FIELDS oben, darum auch dieselbe field()-Funktion
const WIZARD_FIELDS={
  wasser:[["wasserhaerte","Wasserhärte in °dH","number"],["hauptguss","Hauptguss in Litern","number"],
    ["milchsaeure_hauptguss","Milchsäure Hauptguss in ml","number"],["nachguss","Nachguss in Litern","number"],
    ["milchsaeure_nachguss","Milchsäure Nachguss in ml","number"],["ph_vorher","pH-Wert vorher","number"],
    ["ph_nachher","pH-Wert nachher","number"],["wasser","Weitere Hinweise zum Brauwasser (frei)"]],
  laeutern:[["laeutern","Läutern"],["wuerze","Würzemenge vor dem Ausschlagen in Litern","number"]],
  kochen:[["kochzeit","Kochzeit in Minuten","integer"],["hopfensorten","Hopfensorten mit Alphasäure"]],
  anstellen:[["stammwuerze","Stammwürze gemessen in °P – Spindel","number"],["refraktometer_anstellen","Refraktometer-Wert in °Brix","number"],
    ["hefe","Hefesorte"],["hefemenge","Hefemenge"]],
  gaerung:[["restextrakt","Restextrakt, endgültig in °P – Spindel","number"],["refraktometer_restextrakt","Refraktometer, endgültig in °Brix","number"]],
  abfuellung:[["abgefuellt","Abfülldatum","date"],["biermenge","Biermenge in Litern","number"],
    ["karbonisierung","Gewünschte Karbonisierung in g/l","number"],["zucker","Speise / Zucker"],["flaschen","Flaschen","integer"],
    ["ausschlag","Ausschlagwürze in Litern","number"],["alkohol","Alkohol in % vol","number"]],
};
let wizard=null; // {sud, step, rezept, anlage, messungen}
let wizardTimer=null,wizardSaving=0,wizardPending={};
function wizardIndicator(){
  const el=$("#wzStatus");if(!el)return;
  if(wizardSaving>0){el.textContent="speichert …";el.classList.add("speichert");}
  else{el.textContent="gespeichert "+new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit",second:"2-digit"});el.classList.remove("speichert");}
}
/* Alle Änderungen sammeln sich in EINEM wizardPending, egal ob einzelnes Feld oder ganze Liste (malz/rasten/
   hopfen) – ein einziger gemeinsamer Timer, der gesammelt schreibt. Mit getrennten Timern pro Aufrufer würde
   eine spätere Änderung die kurz vorher angestoßene, noch nicht geschriebene überschreiben und verwerfen. */
function wizardQueueSave(patch){
  Object.assign(wizard.sud,patch);Object.assign(wizardPending,patch);
  if(!wizardTimer){wizardSaving++;wizardIndicator();} // mehrere Änderungen vor dem Schreiben zählen nur als EIN laufender Speichervorgang
  clearTimeout(wizardTimer);
  wizardTimer=setTimeout(wizardFlush,500);
}
async function wizardFlush(){
  wizardTimer=null;
  const patch=wizardPending;wizardPending={};
  const {error}=await sb.from("sude").update(patch).eq("id",wizard.sud.id);
  wizardSaving=Math.max(0,wizardSaving-1);
  if(error){toast(fehlertext(error));return;}
  wizardIndicator();
  const i=state.brews.findIndex(b=>b.id===wizard.sud.id);if(i>-1)state.brews[i]=Object.assign({},state.brews[i],patch);
}
/* Listen (malz/rasten/hopfen) bleiben lokal immer vollständig, auch mit einer gerade erst angelegten,
   noch leeren Zeile – nur die Version, die tatsächlich gespeichert wird, ist um leere Zeilen bereinigt
   (wie im normalen Sud-Editor bei save()). wizard.sud[kind] wird daher hier bewusst NICHT über wizardQueueSave
   (das würde es durch die bereinigte Fassung ersetzen) sondern direkt gesetzt. */
function wizardSaveRows(kind,arr){
  wizard.sud[kind]=arr;
  const limpieza={malz:a=>a.filter(m=>m.sorte||m.gramm),
    hopfen:a=>a.filter(h=>h.sorte||h.gramm).map(h=>({...h,zeit:h.typ==="Stopfen"?null:h.zeit})),
    rasten:a=>a.filter(r=>r.temperatur!=null||r.zeit!=null)}[kind];
  wizardPending[kind]=limpieza(arr);
  if(!wizardTimer){wizardSaving++;wizardIndicator();}
  clearTimeout(wizardTimer);
  wizardTimer=setTimeout(wizardFlush,500);
}
function wizardRowValue(kind,i){
  const nz=id=>{const el=$(id);return !el||el.value===""?null:Bz.zahl(el.value);};
  if(kind==="malz")return{sorte:($("#malz_s_"+i)?.value||"").trim(),gramm:nz("#malz_g_"+i),ebc:nz("#malz_e_"+i)};
  if(kind==="hopfen")return{sorte:($("#hop_s_"+i)?.value||"").trim(),gramm:nz("#hop_g_"+i),alpha:nz("#hop_a_"+i),zeit:nz("#hop_z_"+i),typ:$("#hop_t_"+i)?.value||"Kochen"};
  return{temperatur:nz("#rast_t_"+i),zeit:nz("#rast_z_"+i)};
}
function wizardCollectRows(kind){return wizard.sud[kind].map((_,i)=>wizardRowValue(kind,i));}
function wizardWireRowlist(kind,selector){
  const wrap=$(selector);if(!wrap)return;
  wrap.addEventListener("input",()=>{wizard.sud[kind]=wizardCollectRows(kind);wizardSaveRows(kind,wizard.sud[kind]);});
  wrap.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{
    wizard.sud[kind]=wizardCollectRows(kind);wizard.sud[kind].splice(+b.dataset.i,1);wizardSaveRows(kind,wizard.sud[kind]);wizardRenderStep();});
  const add=document.querySelector(`[data-wz-add="${kind}"]`);
  if(add)add.onclick=()=>{
    wizard.sud[kind]=wizardCollectRows(kind);
    wizard.sud[kind].push(kind==="malz"?{sorte:"",gramm:"",ebc:null}:kind==="hopfen"?hopfenNeu(null):{temperatur:"",zeit:""});
    wizardSaveRows(kind,wizard.sud[kind]);wizardRenderStep();
  };
}
/* Alkohol automatisch aus Stammwürze (Anstellen-Schritt) + Restextrakt (Gärung-Schritt) berechnen, sobald
   beide vorliegen – genauer als die Rezept-Schätzung über einen angenommenen Endvergärungsgrad, weil hier
   zwei echte Messwerte verrechnet werden (Bz.alkoholAusMessung). Überschreibt NICHT, wenn schon ein von Hand
   eingetragener/gemessener Wert steht (alkohol_geschaetzt === false) – das wäre sonst ein versehentliches
   Zurücksetzen einer echten Messung. Beim Abfüllen bleibt das Feld ohnehin frei überschreibbar; eine manuelle
   Änderung dort setzt die Markierung zurück (siehe wizardWireFields unten), wie beim normalen Editor/save().*/
function wizardAlkoholAutoberechnen(stammwuerze,restextrakt){
  if(stammwuerze==null||restextrakt==null)return;
  if(wizard.sud.alkohol!=null&&wizard.sud.alkohol_geschaetzt===false)return;
  const berechnet=Bz.runde(Bz.alkoholAusMessung(stammwuerze,restextrakt),1);
  wizardQueueSave({alkohol:berechnet,alkohol_geschaetzt:true});
}
function wizardWireFields(felder){
  felder.forEach(([k,,type])=>{
    const el=$("#f_"+k);if(!el)return;
    el.addEventListener("input",()=>{
      let v;
      if(type==="number")v=el.value===""?null:Bz.zahl(el.value);
      else if(type==="integer")v=el.value===""?null:parseInt(el.value,10)||null;
      else if(type==="date")v=el.value||null;
      else v=el.value;
      const patch={[k]:v};
      if(k==="alkohol")patch.alkohol_geschaetzt=false; // von Hand eingetragen/korrigiert: nicht mehr automatisch überschreiben
      wizardQueueSave(patch);
      if(k==="restextrakt")wizardAlkoholAutoberechnen(wizard.sud.stammwuerze,v);
      if(k==="stammwuerze")wizardAlkoholAutoberechnen(v,wizard.sud.restextrakt);
    });
    // Beim Alkohol-Feld zusätzlich beim Verlassen (nicht bei jedem Tastendruck, sonst verliert das Feld
    // mitten im Tippen den Fokus) den Schritt neu zeichnen, damit der Abweichungs-Hinweis/Zurücksetzen-Knopf
    // erscheint bzw. wieder verschwindet.
    if(k==="alkohol")el.addEventListener("change",()=>wizardRenderStep());
  });
}
/* "Eigene Angabe" je Schritt: offenes Zusatzfeld für alles, was in keine feste Spalte passt (wizard_notizen). */
/* Dieselben Klassen (.rowlist/.r/.x/.add) wie bei Malz/Hopfen/Rasten – NICHT nur ".r" ohne ".rowlist"-Hülle
   (das war der Fehler bisher: ohne die Hülle griff weder das Spalten-Raster noch die gemeinsame Feld-Optik
   .rowlist input aus core/base.css, darum sahen diese Zeilen anders aus als alle übrigen Felder). */
function wizardExtraHtml(stepKey){
  const liste=(wizard.sud.wizard_notizen||[]).map((n,i)=>n.schritt===stepKey?{...n,_i:i}:null).filter(Boolean);
  return `<div class="wz-extra"><div class="rowlist">${liste.map(n=>`<div class="r"><input placeholder="Bezeichnung" value="${esc(n.label)}" data-wz-extra-label="${n._i}" aria-label="Bezeichnung"><input placeholder="Wert" value="${esc(n.wert)}" data-wz-extra-wert="${n._i}" aria-label="Wert"><button type="button" class="x" data-wz-extra-del="${n._i}" aria-label="Entfernen">✕</button></div>`).join("")}</div>
    <button type="button" class="add" data-wz-extra-add="${esc(stepKey)}">+ eigene Angabe</button></div>`;
}
function wizardWireExtra(stepKey){
  $(`[data-wz-extra-add="${stepKey}"]`).onclick=()=>{
    wizard.sud.wizard_notizen=(wizard.sud.wizard_notizen||[]).concat([{schritt:stepKey,label:"",wert:""}]);
    wizardQueueSave({wizard_notizen:wizard.sud.wizard_notizen});wizardRenderStep();
  };
  document.querySelectorAll("[data-wz-extra-label],[data-wz-extra-wert]").forEach(el=>el.addEventListener("input",()=>{
    const i=+(el.dataset.wzExtraLabel??el.dataset.wzExtraWert);
    wizard.sud.wizard_notizen[i][el.dataset.wzExtraLabel!=null?"label":"wert"]=el.value;
    wizardQueueSave({wizard_notizen:wizard.sud.wizard_notizen});
  }));
  document.querySelectorAll("[data-wz-extra-del]").forEach(b=>b.onclick=()=>{
    wizard.sud.wizard_notizen.splice(+b.dataset.wzExtraDel,1);
    wizardQueueSave({wizard_notizen:wizard.sud.wizard_notizen});wizardRenderStep();
  });
}
/* --- Zwischenmessungen während der Gärung (eigene Tabelle, beliebig viele, über Tage/Wochen) --- */
async function wizardMessungenLaden(){
  const {data,error}=await sb.from("sud_messungen").select("*").eq("sud_id",wizard.sud.id).order("angelegt");
  wizard.messungen=error?[]:data;
}
function wizardMessungenHtml(){
  const rows=(wizard.messungen||[]).map((m,i)=>`<div class="r"><input placeholder="z. B. Tag 4" value="${esc(m.bezeichnung)}" data-mz-bez="${i}" aria-label="Bezeichnung"><input type="number" step="0.1" inputmode="decimal" placeholder="°P" value="${esc(m.plato??"")}" data-mz-plato="${i}" aria-label="Grad Plato"><input type="number" step="0.1" inputmode="decimal" placeholder="°Brix" value="${esc(m.refraktometer??"")}" data-mz-refr="${i}" aria-label="Refraktometer"><button type="button" class="x" data-mz-del="${i}" aria-label="Messung entfernen">✕</button></div>`).join("");
  return `<div class="rowlist m3" id="rl_messungen">${rows}</div><button type="button" class="add" id="btnMessungHinzufuegen">+ Zwischenmessung</button>`;
}
function wizardWireMessungen(){
  const speichern=async(i)=>{
    const m=wizard.messungen[i];
    const bez=($("[data-mz-bez='"+i+"']")?.value||"").trim();
    const plato=$("[data-mz-plato='"+i+"']")?.value;const refr=$("[data-mz-refr='"+i+"']")?.value;
    const patch={bezeichnung:bez,plato:plato===""?null:Bz.zahl(plato),refraktometer:refr===""?null:Bz.zahl(refr)};
    if(!bez)return; // ohne Bezeichnung nicht speichern (Pflichtfeld in der DB)
    if(m.id){wizardSaving++;wizardIndicator();const{error}=await sb.from("sud_messungen").update(patch).eq("id",m.id);wizardSaving--;wizardIndicator();if(error)toast(fehlertext(error));else Object.assign(m,patch);}
    else{wizardSaving++;wizardIndicator();const{data,error}=await sb.from("sud_messungen").insert({...patch,sud_id:wizard.sud.id}).select().single();wizardSaving--;wizardIndicator();if(error)toast(fehlertext(error));else wizard.messungen[i]=data;}
  };
  $("#rl_messungen")?.querySelectorAll("[data-mz-bez]").forEach(el=>{let t=null;el.oninput=()=>{clearTimeout(t);t=setTimeout(()=>speichern(+el.dataset.mzBez),500);};});
  $("#rl_messungen")?.querySelectorAll("[data-mz-plato]").forEach(el=>{let t=null;el.oninput=()=>{clearTimeout(t);t=setTimeout(()=>speichern(+el.dataset.mzPlato),500);};});
  $("#rl_messungen")?.querySelectorAll("[data-mz-refr]").forEach(el=>{let t=null;el.oninput=()=>{clearTimeout(t);t=setTimeout(()=>speichern(+el.dataset.mzRefr),500);};});
  $("#btnMessungHinzufuegen").onclick=()=>{wizard.messungen.push({bezeichnung:"",plato:null,refraktometer:null});wizardRenderStep();};
  $("#rl_messungen")?.querySelectorAll("[data-mz-del]").forEach(b=>b.onclick=()=>{
    const i=+b.dataset.mzDel,m=wizard.messungen[i];
    if(!m.id){wizard.messungen.splice(i,1);wizardRenderStep();return;}
    sheet("Zwischenmessung entfernen?",`<p>„${esc(m.bezeichnung)}“ wird entfernt.</p>`,
      `<span class="spacer"></span><button class="btn" id="noDelMz">Abbrechen</button><button class="btn danger" id="yesDelMz">Ja, entfernen</button>`);
    $("#noDelMz").onclick=closeSheet;
    $("#yesDelMz").onclick=async()=>{const{error}=await sb.from("sud_messungen").delete().eq("id",m.id);if(error){toast(fehlertext(error));closeSheet();return;}
      wizard.messungen.splice(i,1);closeSheet();wizardRenderStep();};
  });
}
/* --- Wasserhärte-Rechner: vereinfachte Beispielformel (Härte × Wassermenge × Faktor), keine geprüfte
   brautechnische Berechnung – dient nur als grobe Orientierung, Ergebnis bleibt frei überschreibbar. */
function wizardWasserRechner(){
  const hInp=$("#f_wasserhaerte"),hgInp=$("#f_hauptguss"),ngInp=$("#f_nachguss");
  if(!hInp)return;
  const FAKTOR=0.09;
  const rechne=()=>{
    const h=Bz.zahl(hInp.value)||0,hg=Bz.zahl(hgInp.value)||0,ng=Bz.zahl(ngInp.value)||0;
    const rHg=h*hg*FAKTOR,rNg=h*ng*FAKTOR;
    $("#wzRecHg").textContent=h&&hg?Bz.fmtZahl(rHg,1)+" ml":"–";
    $("#wzRecNg").textContent=h&&ng?Bz.fmtZahl(rNg,1)+" ml":"–";
    return {rHg,rNg};
  };
  [hInp,hgInp,ngInp].forEach(el=>el.addEventListener("input",rechne));
  // Wichtig: .value bei einem <input type="number"> braucht einen Punkt als Dezimaltrennzeichen (HTML-Vorgabe,
  // unabhängig von der Spracheinstellung) – Bz.fmtZahl() liefert ein Komma (deutsches Format) und wurde hier
  // früher versehentlich direkt als .value gesetzt; der Browser verwirft das dann stillschweigend, ohne
  // Fehlermeldung, nur beim erneuten Rendern (z. B. nach Zurück/Vor) erschien der – korrekt gespeicherte –
  // Wert dann wieder, weil field() den rohen Zahlenwert nutzt statt der formatierten Anzeige.
  $("#wzUebernehmenHg").onclick=()=>{const {rHg}=rechne();const g=Bz.runde(rHg,1);$("#f_milchsaeure_hauptguss").value=g;wizardQueueSave({milchsaeure_hauptguss:g});};
  $("#wzUebernehmenNg").onclick=()=>{const {rNg}=rechne();const g=Bz.runde(rNg,1);$("#f_milchsaeure_nachguss").value=g;wizardQueueSave({milchsaeure_nachguss:g});};
}
/* Zucker-Rechner im Abfüllung-Schritt: wie viel Haushaltszucker je Liter Bier für die gewünschte Karbonisierung
   nötig ist (Brau.primingZucker, siehe lib/brau.js) – bewusst eine Dosierung pro Liter statt einer Gesamtmenge
   für die ganze Biermenge, braucht darum auch keine Biermenge als Eingabe. Hängt nicht von Stammwürze/Restextrakt
   ab (siehe Kommentar bei Brau.primingZucker) – nur von Ziel- und Restkohlensäure. Für "Speise" gibt es bewusst
   KEINEN Rechner – die dafür übliche Formel (Narziss) ergab bei einer Gegenprobe mit Beispielwerten ein
   unplausibles Ergebnis, darum lieber kein Wert als ein möglicherweise falscher. */
function wizardZuckerRechner(){
  const kInp=$("#f_karbonisierung");
  if(!kInp)return;
  const rechne=()=>{
    const ziel=Bz.zahl(kInp.value);
    const g=Bz.primingZucker(ziel);
    $("#wzRecZucker").textContent=g!=null?Bz.fmtZahl(g,1)+" g/l":"–";
    return g;
  };
  kInp.addEventListener("input",rechne);
  $("#wzZuckerUebernehmen").onclick=()=>{
    const g=rechne();if(g==null)return;
    const text=`${Bz.fmtZahl(g,1)} g/l Haushaltszucker (errechnet für ${Bz.fmtZahl(Bz.zahl(kInp.value))} g/l Ziel-Karbonisierung)`;
    $("#f_zucker").value=text;wizardQueueSave({zucker:text});
  };
}
/* Fußleiste wie beim Verkostungs-Bewertungsbogen: ganz kleine Punkte + "n / total", Zurück/Weiter. Die Punkte
   sind zusätzlich (anders als beim Bewertungsbogen) anklickbar, um direkt zu einem Schritt zu springen – im
   Braugang-Assistenten ausdrücklich gewünscht (frei zwischen den Schritten wechseln). */
function wizardFussHtml(){
  const n=wizard.step+1,total=WIZARD_STEPS.length,letzte=wizard.step===total-1;
  return `<div class="bogen-fuss noprint">
    <div class="fortschritt">
      <span class="punkte">${WIZARD_STEPS.map(([,titel],i)=>`<button type="button" class="punkt" data-wz-goto="${i}" aria-label="Schritt ${i+1}: ${esc(titel)}"><i class="${i<=wizard.step?"ab":""}"></i></button>`).join("")}</span>
      <span class="zahl num">${n} / ${total}</span>
    </div>
    <div class="bogen-knoepfe">${wizard.step>0?`<button type="button" class="btn" id="wzBack" aria-label="Zurück">←</button>`:""}${letzte?"":`<button type="button" class="btn primary" id="wzNext">Weiter</button>`}</div>
  </div>`;
}
function wizardPlanHinweis(){
  if(!wizard.rezept)return"";
  const r=wizard.rezept,u=wizard.rezeptUmgerechnet;
  const ziele=[u.hauptguss!=null?`Hauptguss ${Bz.fmtZahl(u.hauptguss)} l`:"",u.nachguss!=null?`Nachguss ${Bz.fmtZahl(u.nachguss)} l`:"",
    u.kochzeit!=null?`Kochzeit ${Bz.fmtZahl(u.kochzeit,0)} min`:"",r.stammwuerze!=null?`Stammwürze ${Bz.fmtZahl(r.stammwuerze)} °P`:""].filter(Boolean).join(" · ");
  return `<p class="hint">Geplant laut Rezept <a href="rezepte.html?id=${esc(r.id)}">${esc(r.name)}</a>: ${esc(ziele)}</p>`;
}
function wizardRenderStep(){
  const[key,titel]=WIZARD_STEPS[wizard.step],d=wizard.sud;
  const fs=inner=>`<fieldset>${inner}</fieldset>`;
  let body="";
  if(key==="uebersicht"){
    body=`${wizardPlanHinweis()}<div class="grid2">${field(["datum","Braudatum","date"],d.datum)}<label class="f">Sud-Nr.<input value="${esc(d.nr)}" disabled></label></div><p class="hint">Status: ${esc({entwurf:"Entwurf",gaerung:"Gärung läuft",dokumentiert:"Dokumentiert"}[d.status])} – erscheint damit schon in der normalen Sudliste.</p>`;
  } else if(key==="schuettung"){
    body=`<div class="rowlist m3" id="rl_malz">${rowsHTML("malz",d.malz)}</div><button type="button" class="add" data-wz-add="malz">+ Malz</button>`;
  } else if(key==="maischen"){
    body=`<div class="grid2">${field(["einmaischtemperatur","Einmaischtemperatur in °C","number"],d.einmaischtemperatur)}${field(["abmaischtemperatur","Abmaischtemperatur in °C","number"],d.abmaischtemperatur)}</div>
      <div class="rowlist" id="rl_rasten">${rowsHTML("rasten",d.rasten)}</div><button type="button" class="add" data-wz-add="rasten">+ Rast</button>`;
  } else if(key==="wasser"){
    body=`<p class="hint">Richtwert pH 5,2–5,6 im Hauptguss. Die Empfehlung ist eine vereinfachte Beispielrechnung – als grobe Orientierung, kein geprüfter Brauwert.</p>
      <div class="grid2">${field(["wasserhaerte","Wasserhärte in °dH","number"],d.wasserhaerte)}${field(["ph_vorher","pH-Wert vorher","number"],d.ph_vorher)}</div>
      <div class="grid2">${field(["hauptguss","Hauptguss in Litern","number"],d.hauptguss)}${field(["milchsaeure_hauptguss","Milchsäure Hauptguss in ml","number"],d.milchsaeure_hauptguss)}</div>
      <p class="hint" style="margin:-8px 0 14px">Empfehlung Hauptguss: <b id="wzRecHg">–</b> <button type="button" class="linkbtn" id="wzUebernehmenHg">übernehmen</button></p>
      <div class="grid2">${field(["nachguss","Nachguss in Litern","number"],d.nachguss)}${field(["milchsaeure_nachguss","Milchsäure Nachguss in ml","number"],d.milchsaeure_nachguss)}</div>
      <p class="hint" style="margin:-8px 0 14px">Empfehlung Nachguss: <b id="wzRecNg">–</b> <button type="button" class="linkbtn" id="wzUebernehmenNg">übernehmen</button></p>
      <div class="grid2">${field(["ph_nachher","pH-Wert nachher","number"],d.ph_nachher)}${field(["wasser","Weitere Hinweise zum Brauwasser (frei)"],d.wasser)}</div>`;
  } else if(key==="kochen"){
    body=`<div class="grid2">${WIZARD_FIELDS.kochen.map(f=>field(f,d[f[0]])).join("")}</div>
      <div class="rowlist h5" id="rl_hopfen">${rowsHTML("hopfen",d.hopfen)}</div><button type="button" class="add" data-wz-add="hopfen">+ Hopfengabe</button>`;
  } else if(key==="gaerung"){
    body=`<p class="hint">Dieser Schritt lässt sich beliebig oft erneut besuchen, solange die Gärung läuft – für weitere Zwischenmessungen über Tage/Wochen.</p>
      <div class="grid2">${WIZARD_FIELDS.gaerung.map(f=>field(f,d[f[0]])).join("")}</div>
      <h3 style="font-size:.8rem;text-transform:uppercase;letter-spacing:.09em;color:var(--amber);margin:18px 0 10px">Zwischenmessungen</h3>
      ${wizardMessungenHtml()}`;
  } else if(key==="abfuellung"){
    const refAlk=Bz.alkoholAusRefraktometer(d.refraktometer_anstellen,d.refraktometer_restextrakt);
    const zuckerGl=Bz.primingZucker(d.karbonisierung);
    const alkBerechnet=Bz.alkoholAusMessung(d.stammwuerze,d.restextrakt);
    const alkAbweichend=d.alkohol_geschaetzt===false&&alkBerechnet!=null&&Math.abs((d.alkohol??0)-alkBerechnet)>0.05;
    body=`<div class="grid2">${WIZARD_FIELDS.abfuellung.map(f=>field(f,d[f[0]])).join("")}</div>
      <div class="kws" style="grid-template-columns:1fr;max-width:260px;margin:4px 0">
        <div class="kw"><span>Zucker-Empfehlung je Liter</span><b id="wzRecZucker">${zuckerGl!=null?esc(Bz.fmtZahl(zuckerGl,1))+" g/l":"–"}</b></div>
      </div>
      <button type="button" class="btn ghost" id="wzZuckerUebernehmen">Empfehlung ins Speise/Zucker-Feld übernehmen</button>
      <p class="hint">Rechnet mit einer angenommenen Restkohlensäure von ca. ${esc(Bz.fmtZahl(Bz.REST_CO2_STANDARD_GL))} g/l (Richtwert für ca. 18–20 °C Gärtemperatur) – bei deutlich wärmer oder kälter vergorenem Bier von Hand anpassen. Hängt nur von Ziel- und Restkohlensäure ab, nicht von Stammwürze/Restextrakt – darum reicht die Angabe je Liter, unabhängig von der Biermenge. Für Speise (unvergorene Würze statt Zucker) gibt es bewusst keine automatische Berechnung – die dafür übliche, von Stammwürze/Restextrakt abhängige Formel ließ sich nicht zuverlässig gegenprüfen.</p>
      ${d.alkohol_geschaetzt?`<p class="hint">Alkohol automatisch aus Stammwürze und Restextrakt (Spindel) berechnet – lässt sich hier jederzeit durch einen gemessenen Wert ersetzen.</p>`
        :alkAbweichend?`<p class="hint" style="color:var(--warn)">Von Hand geändert – weicht von der Berechnung (${esc(Bz.fmtZahl(Bz.runde(alkBerechnet,1)))} % vol) ab. <button type="button" class="linkbtn" id="wzAlkoholZuruecksetzen">↺ Auf Berechnung zurücksetzen</button></p>`:""}
      ${refAlk!=null?`<p class="hint">Zum Vergleich aus den Refraktometer-Werten geschätzt (korrigiert nach der verbreiteten „Sean-Terrill“-Näherungsformel, da Alkohol das Refraktometer sonst verfälscht): ${esc(Bz.fmtZahl(Bz.runde(refAlk,1)))} % vol. Auch das ist nur eine Orientierung, kein Laborwert.</p>`:""}
      <button type="button" class="btn primary" id="wzAbschliessen" style="margin-top:18px">Sud abschließen ✓</button>
      <p class="hint">Erst wenn wirklich abgefüllt wurde – bis dahin bleibt der Sud auf „Gärung läuft“.</p>`;
  } else {
    body=`<div class="grid2">${WIZARD_FIELDS[key].map(f=>field(f,d[f[0]])).join("")}</div>`;
  }
  $("#wzBody").innerHTML=fs(body)+wizardExtraHtml(key);
  if(key==="schuettung")wizardWireRowlist("malz","#rl_malz");
  else if(key==="maischen"){wizardWireFields([["einmaischtemperatur",0,"number"],["abmaischtemperatur",0,"number"]]);wizardWireRowlist("rasten","#rl_rasten");}
  else if(key==="kochen"){wizardWireFields(WIZARD_FIELDS.kochen);wizardWireRowlist("hopfen","#rl_hopfen");}
  else if(key==="gaerung"){wizardWireFields(WIZARD_FIELDS.gaerung);wizardWireMessungen();}
  else if(key==="abfuellung"){
    wizardWireFields(WIZARD_FIELDS.abfuellung);wizardZuckerRechner();$("#wzAbschliessen").onclick=wizardAbschliessen;
    const zur=$("#wzAlkoholZuruecksetzen");
    if(zur)zur.onclick=()=>{const w=Bz.alkoholAusMessung(d.stammwuerze,d.restextrakt);wizardQueueSave({alkohol:Bz.runde(w,1),alkohol_geschaetzt:true});wizardRenderStep();};
  }
  else if(key==="wasser"){wizardWireFields(WIZARD_FIELDS.wasser);wizardWasserRechner();}
  else if(key==="uebersicht")wizardWireFields([["datum",0,"date"]]);
  else wizardWireFields(WIZARD_FIELDS[key]); // laeutern, anstellen: reine Feldschritte ohne Rowlist/Rechner
  wizardWireExtra(key);
  $("#wzStepTitel").textContent=titel;
  $("#wzFuss").innerHTML=wizardFussHtml();
  const backBtn=$("#wzBack");if(backBtn)backBtn.onclick=()=>{if(wizard.step>0){wizard.step--;wizardRenderStep();}};
  const nextBtn=$("#wzNext");if(nextBtn)nextBtn.onclick=()=>{
    if(WIZARD_STEPS[wizard.step][0]==="anstellen"&&wizard.sud.status==="entwurf")wizardQueueSave({status:"gaerung"});
    if(wizard.step<WIZARD_STEPS.length-1){wizard.step++;wizardRenderStep();}
  };
  document.querySelectorAll("[data-wz-goto]").forEach(b=>b.onclick=()=>{wizard.step=+b.dataset.wzGoto;wizardRenderStep();});
}
function wizardAnzeigen(){
  kopfzeileZeigen(false);
  $("#overview").hidden=true;$("#filter").hidden=true;$("#sudeActions").hidden=true;
  $("#list").innerHTML=`<p class="noprint"><a class="back" id="wzZurueck" href="index.html?sud=${esc(wizard.sud.id)}">← ${esc(title(wizard.sud))}</a></p>
    <article class="sud-blatt wz">
      <div class="wz-kopf"><p class="kicker">${esc(title(wizard.sud))}</p><span class="num" id="wzStatus">gespeichert</span></div>
      <h2 id="wzStepTitel" class="wz-schritt-titel"></h2>
      <div id="wzBody"></div>
      <div id="wzFuss"></div>
    </article>`;
  $("#wzZurueck").onclick=e=>{e.preventDefault();zeigeDetail(wizard.sud);};
  wizardRenderStep();
}
async function wizardAbschliessen(){
  $("#wzAbschliessen").disabled=true;
  const {error}=await sb.from("sude").update({status:"dokumentiert"}).eq("id",wizard.sud.id);
  if(error){toast(fehlertext(error));$("#wzAbschliessen").disabled=false;return;}
  wizard.sud.status="dokumentiert";
  const i=state.brews.findIndex(b=>b.id===wizard.sud.id);if(i>-1)state.brews[i]=Object.assign({},state.brews[i],{status:"dokumentiert"});
  toast("Sud abgeschlossen");
  zeigeDetail(wizard.sud);
}
/* Rezept-Plan zum Vergleich laden (nur Anzeige, read-only) */
async function wizardRezeptLaden(){
  if(!wizard.sud.rezept_id)return;
  const [rz,an]=await Promise.all([sb.from("rezepte").select("*").eq("id",wizard.sud.rezept_id).maybeSingle(),sb.from("anlagen").select("*").order("id").limit(1).maybeSingle()]);
  if(!rz.data)return;
  wizard.rezept=rz.data;wizard.anlage=an.data;
  const ziel=wizard.sud.ausschlag||wizard.sud.wuerze||an.data?.standard_menge||rz.data.ausschlag;
  wizard.rezeptUmgerechnet=Bz.umrechnen(rz.data,{ziel,anlage:an.data&&rz.data.sudhausausbeute?an.data:null});
  wizardRenderStep();
}
/* Neuen Braugang aus einem Rezept anlegen: Sud-Entwurf sofort in Supabase, dann den Assistenten öffnen –
   anders als die übrigen "Neuer Sud"-Wege (leer/Kopie), die weiterhin den normalen Editor (Sheet) benutzen. */
async function openWizard(name,draftData){
  if(!isBM())return;
  const nextNr=Math.max(0,...state.brews.map(b=>+b.nr||0))+1;
  const out=Object.assign({nr:nextNr,datum:todayIso(),oeffentlich:false,status:"entwurf"},draftData);
  out.malz=(out.malz||[]).filter(m=>m.sorte||m.gramm);out.hopfen=(out.hopfen||[]).map(hopfenNeu);out.rasten=(out.rasten||[]).filter(r=>r.temperatur!=null||r.zeit!=null);
  const {data,error}=await sb.from("sude").insert(out).select().single();
  if(error){toast(fehlertext(error));return;}
  state.brews=state.brews.concat([data]);
  wizard={sud:data,step:0,messungen:[],rezept:null,anlage:null,rezeptUmgerechnet:null};
  history.replaceState(null,"","index.html?sud="+data.id);
  await wizardMessungenLaden();
  wizardAnzeigen();
  wizardRezeptLaden();
}
let einstieg=true;
function einstiegVerarbeiten(){
  if(!einstieg)return;einstieg=false;
  const p=new URLSearchParams(location.search);
  if(p.get("ausRezept")&&isBM()){
    history.replaceState(null,"",location.pathname);
    let x=null;try{x=JSON.parse(sessionStorage.getItem("kb_sud_aus_rezept")||"null");sessionStorage.removeItem("kb_sud_aus_rezept");}catch(_){}
    if(x&&x.rezept){openWizard(x.name,draftAusRezept(x.rezept,{...x.rezept,id:x.rezept_id,name:x.name},x.ziel,x.anlage));}
  }
}
/* --- CSV-Export --- */
function toCSV(){
  const cols=["nr","datum","stil","etikett","bewertung","hauptguss","nachguss","wasser","malz","einmaischtemperatur","rasten","abmaischtemperatur","laeutern","kochzeit","wuerze","stammwuerze","hopfensorten","hopfen","hefe","hefemenge","messungen","restextrakt","ausschlag","biermenge","zucker","flaschen","alkohol","alkohol_geschaetzt","abgefuellt","notizen","oeffentlich"];
  const v=(b,c)=>c==="malz"?(b.malz||[]).map(m=>`${m.sorte} ${m.gramm??""}g`).join(" | "):c==="hopfen"?(b.hopfen||[]).map(h=>h.sorte===undefined?`${h.menge} (${h.zeit})`:`${h.gramm??""}g ${h.sorte}${h.alpha!=null?" "+h.alpha+"%":""} (${TYP[h.typ]||h.typ}${h.zeit!=null?" "+h.zeit+" min":""})`).join(" | "):c==="rasten"?(b.rasten||[]).map(r=>`${r.temperatur??""}°C ${r.zeit??""}min`).join(" | "):c==="oeffentlich"||c==="alkohol_geschaetzt"?(b[c]?"ja":"nein"):(b[c]??"");
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
  async laden(){
    if(!await loadBrews())return;
    const sudId=new URLSearchParams(location.search).get("sud");
    if(sudId){
      const b=state.brews.find(x=>x.id===sudId);
      if(b&&isBM()&&b.status!=="dokumentiert"){
        wizard={sud:b,step:b.status==="gaerung"?WIZARD_STEPS.findIndex(s=>s[0]==="gaerung"):0,messungen:[],rezept:null,anlage:null,rezeptUmgerechnet:null};
        await wizardMessungenLaden();wizardAnzeigen();wizardRezeptLaden();
      }
      else if(b)zeigeDetail(b);
      else{$("#overview").hidden=true;$("#filter").hidden=true;$("#sudeActions").hidden=true;$("#list").innerHTML=`<p class="noprint"><a class="back" href="index.html">← Alle Sude</a></p><p class="empty">Diesen Sud gibt es nicht oder er ist nicht öffentlich.</p>`;}
      return;
    }
    renderAll();einstiegVerarbeiten();
  },
};
})();
