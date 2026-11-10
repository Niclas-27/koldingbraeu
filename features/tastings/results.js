/* Koldingbräu – Verkostungen: öffentliche Ergebnisseite einer abgeschlossenen Verkostung (?e=<uuid>) */
"use strict";
async function ergebnisLaden(){
  stopTimer();
  const {data, error} = await sb.rpc("vk_ergebnis", {p_id: ergebnisId});
  if(error){ main().innerHTML = `<p><a class="back" href="verkostung.html">← Alle Verkostungen</a></p><p class="empty">${esc(fehlertext(error))}</p>`; return; }
  const v = data.verkostung, proben = rangfolge(data.proben);
  // Eigene Noten (nur auf dem Gerät des Gastes, von der Gästeseite beim Aufdecken mitgegeben)
  let meine = {}; try{ meine = JSON.parse(lsGet("kb_meine_"+ergebnisId)||"{}") || {}; }catch(_){}
  const meinTxt = p => meine[p.bier_id] != null ? `deine Note ${meine[p.bier_id]}` : "";
  document.title = v.titel + " · Koldingbräu";
  // Plätze vergeben (gleicher Schnitt und gleiche Nochmal-Zahl = gleicher Platz)
  let platz = 0, vorher = null;
  proben.forEach((p,i) => { const k = p.schnitt==null ? null : `${p.schnitt}|${p.nochmal}`; if(k!==vorher){ platz = i+1; vorher = k; } p.platz = p.schnitt==null ? null : platz; });
  // Bei Blindverkostungen steht die ehemalige Probennummer als Kreis am Kronkorken – so finden die Gäste beim
  // Aufdecken ihren Favoriten vom Abend wieder (seit 10.11.2026).
  const bild = p => v.blind ? `<span class="bb-nr">${Bilder.bier(p)}<span class="probe-nr num" title="Probe ${p.nummer}" aria-label="Probe ${p.nummer}">${p.nummer}</span></span>` : Bilder.bier(p);

  const noten = p => `<div class="dots" aria-label="Einzelnoten: ${esc(p.noten.join(", "))}">${Array.from({length:11},(_,i)=>`<span class="tick${i%5===0?" lab":""}">${i%5===0?i:""}</span>`).join("")}
      ${(() => { const c = new Map(); return p.noten.map(n => { const k = c.get(n) || 0; c.set(n, k+1); return `<i style="left:${n*10}%;bottom:${10+k*12}px" title="Note ${n}"></i>`; }).join(""); })()}</div>`;
  const profil = p => MERKMALE.flatMap(([,l])=>l).filter(([k]) => p.merkmale[k]).map(([k,label,l,r]) =>
      `<div class="pf"><span class="pf-l">${esc(l)}</span><span class="pf-t"><i style="left:${p.merkmale[k].wert*10}%"></i></span><span class="pf-r">${esc(r)}</span><small class="pf-n">${esc(label)}</small></div>`).join("");
  const tags = o => Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([t,n])=>`<span class="tag">${esc(t)}${n>1?` ${n}×`:""}</span>`).join(" ");

  const detail = p => `${meinTxt(p)?`<p class="meine-detail">Ø ${note(p.schnitt)} · <b>${meinTxt(p)}</b></p>`:""}${Bilder.bierFotos(p)}
        ${p.noten.length?`<div><h4>Einzelnoten</h4>${noten(p)}</div>`:""}
        ${p.kommentare.length?`<div><h4>Gesagt wurde</h4><ul class="zitate">${p.kommentare.map(k=>`<li>${esc(k)}</li>`).join("")}</ul></div>`:""}
        ${profil(p)?`<div><h4>Geschmacksprofil</h4>${profil(p)}</div>`:""}
        ${Object.keys(p.geruch).length?`<div><h4>Geruch</h4><p>${tags(p.geruch)}</p></div>`:""}
        ${Object.keys(p.fehler).length?`<div><h4>Fehlaromen</h4><p>${tags(p.fehler)}</p></div>`:""}
        <p><a href="liga.html?bier=${esc(p.bier_id)}">In der Liga ansehen →</a></p>`;
  // Seit 10.11.2026 kein Podest mehr: alle Biere in einer einheitlichen Rangliste von Platz 1 bis zum letzten.
  let h = `<p><a class="back" href="verkostung.html">← Alle Verkostungen</a></p>
    <div class="vk-head"><div><p class="kicker">Verkostung</p><h2>${esc(v.titel)}</h2>
      <p class="hint">${esc([fmtDateLong(v.datum), v.ort, proben.length+" Biere", v.blind?"blind verkostet":""].filter(Boolean).join(" · "))}</p>
      ${data.teilnehmer.length?`<p class="hint">Mit ${esc(data.teilnehmer.join(", "))}</p>`:""}</div>
      ${isBM()?`<a class="btn" href="verkostung.html?id=${esc(v.id)}">Verwalten</a>`:""}</div>
    ${v.bild_titel?`<img class="titelbild" id="titelbild" src="${esc(Bilder.url(v.bild_titel))}" alt="Titelbild der Verkostung">`:""}
    ${Object.keys(meine).length?`<p class="hint">Tippe auf ein Bier für Einzelnoten, Kommentare und Geschmacksprofil – deine eigene Note steht jeweils dabei.</p>`:""}
    ${proben.length?`<section class="sec"><h3>Rangliste</h3>${v.blind?`<p class="hint">Die Zahl am Kronkorken ist die Probennummer vom Abend.</p>`:""}<ol class="rank erg">${proben.map(p => {
      const offen = p.kommentare.length || Object.keys(p.merkmale).length || Object.keys(p.geruch).length || Object.keys(p.fehler).length || p.noten.length || p.bild_kronkorken || p.bild_flasche;
      return `<li>
      <details${offen?"":" class=\"leer\""}><summary>
        <span class="pl num">${p.platz?p.platz+".":"–"}</span>
        <span class="nm mit-bild">${bild(p)}<span><b>${esc(p.name)}</b><small>${esc(bierZeile(p))}${p.eigen&&!/kolding/i.test(p.brauerei||"")?" · selbst gebraut":""}</small></span></span>
        <span class="sc"><b class="num ${gradeCls(p.schnitt)}">${note(p.schnitt)}</b></span>
        <small class="mt">${p.anzahl} Bew.${p.anzahl?` · ${Math.round(p.nochmal/p.anzahl*100)} % empfehlen`:""}${meinTxt(p)?` · <b class="meine">${meinTxt(p)}</b>`:""}</small>
        <span class="bar"><i class="${gradeCls(p.schnitt)}" style="width:${p.schnitt==null?0:Math.round(p.schnitt*10)}%"></i></span>
      </summary>
      <div class="erg-detail">
        ${detail(p)}
      </div></details></li>`;}).join("")}</ol>
      <p class="hint">Ein Bier auswählen zeigt Einzelnoten, Kommentare und Geschmacksprofil.</p></section>`:""}
    <div id="gastGalerie"></div>`;
  main().innerHTML = h;
  Bilder.bierFotosVerdrahten(main());
  const tb = $("#titelbild"); if(tb) tb.onclick = () => Bilder.zeigen(v.bild_titel);
  ergebnisGalerie(v.id);
}

/* Fotos vom Abend – nur für Teilnehmer dieser Verkostung (seit 10.11.2026). Der Browser schickt alle bei sich
   gespeicherten Gast-Schlüssel; „galerie-ansehen“ prüft, ob einer zu dieser Verkostung gehört. Ohne Treffer bleibt
   der Abschnitt einfach weg – Besucher ohne Teilnahme sehen keinen Hinweis auf die Galerie. */
function gastSchluessel(vid){
  const t = new Set(); const e = lsGet("kb_gast_e_"+vid); if(e) t.add(e);
  try{
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(!k || !k.startsWith("kb_gast_") || k.startsWith("kb_gast_e_")) continue;
      try{ const g = JSON.parse(localStorage.getItem(k)); if(g && g.token) t.add(g.token); }catch(_){}
    }
  }catch(_){}
  return [...t].slice(0, 20);
}
async function ergebnisGalerie(vid){
  const tokens = gastSchluessel(vid);
  if(!tokens.length) return;
  const d = await gastGalerieLaden({verkostung_id: vid, tokens});
  const box = $("#gastGalerie");
  if(!d || !box || ergebnisId !== vid) return;
  lsSet("kb_gast_e_"+vid, d.token);
  box.innerHTML = `<section class="sec"><h3>Fotos vom Abend</h3><p class="hint">Nur für die Teilnehmer dieser Verkostung sichtbar.</p>${gastGalerieHtml(d)}</section>`;
  gastGalerieVerdrahten(box, d);
}

