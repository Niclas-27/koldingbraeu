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
  // Eigene Lage auf der Geschmackskarte je Bier ([suesse, bitter]) – ebenfalls nur auf diesem Gerät (guest.js)
  let meineK = {}; try{ meineK = JSON.parse(lsGet("kb_meine_k_"+ergebnisId)||"{}") || {}; }catch(_){}
  document.title = v.titel + " · Koldingbräu";
  // Plätze vergeben (gleicher Schnitt und gleiche Nochmal-Zahl = gleicher Platz)
  let platz = 0, vorher = null;
  proben.forEach((p,i) => { const k = p.schnitt==null ? null : `${p.schnitt}|${p.nochmal}`; if(k!==vorher){ platz = i+1; vorher = k; } p.platz = p.schnitt==null ? null : platz; });
  // Bei Blindverkostungen steht die ehemalige Probennummer als Kreis am Kronkorken – so finden die Gäste beim
  // Aufdecken ihren Favoriten vom Abend wieder (seit 10.11.2026).
  const bild = p => v.blind ? `<span class="bb-nr">${Bilder.bier(p)}<span class="probe-nr num" title="Probe ${p.nummer}" aria-label="Probe ${p.nummer}">${p.nummer}</span></span>` : Bilder.bier(p);

  const noten = p => `<div class="dots" aria-label="Einzelnoten: ${esc(p.noten.join(", "))}">${Array.from({length:11},(_,i)=>`<span class="tick${i%5===0?" lab":""}">${i%5===0?i:""}</span>`).join("")}
      ${(() => { const c = new Map(); return p.noten.map(n => { const k = c.get(n) || 0; c.set(n, k+1); return `<i style="left:${n*10}%;bottom:${10+k*12}px" title="Note ${n}"></i>`; }).join(""); })()}</div>`;
  // Geschmackskarte (seit 13.11.2026): je Gast ein Punkt (p.kreis = [[suesse, bitter], …], schema/16), Kreuz = Schnitt.
  // Ohne p.kreis (Datenbank noch nicht erweitert) bleibt nur der Schnitt aus merkmale.
  const kSchnitt = p => {
    if(p.kreis && p.kreis.length) return [p.kreis.reduce((a,k) => a + k[0], 0) / p.kreis.length, p.kreis.reduce((a,k) => a + k[1], 0) / p.kreis.length];
    const m = p.merkmale || {}; return m.suesse && m.bitter ? [m.suesse.wert, m.bitter.wert] : null;
  };
  const kWorte = ([s,b]) => kreisText({x: (s-5)/5, y: (b-5)/5});
  const karte = p => {
    const ds = kSchnitt(p); if(!ds) return "";
    const n = (p.kreis||[]).length, du = meineK[p.bier_id];
    const punkte = (p.kreis||[]).map(([s,b]) => `<i class="k-gast" style="${kartePos(s,b)}"></i>`).join("")
      + (du ? `<i class="k-gast du" style="${kartePos(du[0],du[1])}" title="deine Wahl"></i>` : "")
      + `<i class="k-schnitt" style="${kartePos(ds[0],ds[1])}" title="Schnitt"></i>`;
    return `<div><h4>Geschmacksbild${n?` · ${n} ${n===1?"Stimme":"Stimmen"}`:""}</h4>
      ${karteHtml({klein: true, ecken: false, attr: ` role="img" aria-label="Geschmackskarte: im Schnitt ${esc(kWorte(ds).toLowerCase())}"`, innen: punkte})}
      <p class="k-zus">Ø ${esc(kWorte(ds).toLowerCase())}${du?` · du: ${esc(kWorte(du).toLowerCase())}`:""}</p>
      ${n?`<p class="k-legende"><span><i class="lg-g"></i>Gäste</span>${du?`<span><i class="lg-d"></i>deine Wahl</span>`:""}<span><i class="lg-s"></i>Schnitt</span></p>`:""}</div>`;
  };
  const profil = p => MERKMALE.flatMap(([,l])=>l).filter(([k]) => p.merkmale[k] && !(kSchnitt(p) && (k === "bitter" || k === "suesse"))).map(([k,label,l,r]) =>
      `<div class="pf"><span class="pf-l">${esc(l)}</span><span class="pf-t"><i style="left:${p.merkmale[k].wert*10}%"></i></span><span class="pf-r">${esc(r)}</span><small class="pf-n">${esc(label)}</small></div>`).join("");
  const tags = o => Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([t,n])=>`<span class="tag">${esc(eindruck(t))}${n>1?` ${n}×`:""}</span>`).join(" ");

  const detail = p => `${meinTxt(p)?`<p class="meine-detail">Ø ${note(p.schnitt)} · <b>${meinTxt(p)}</b></p>`:""}${Bilder.bierFotos(p)}
        ${p.noten.length?`<div><h4>Einzelnoten</h4>${noten(p)}</div>`:""}
        ${p.kommentare.length?`<div><h4>Gesagt wurde</h4><ul class="zitate">${p.kommentare.map(k=>`<li>${esc(k)}</li>`).join("")}</ul></div>`:""}
        ${karte(p)}
        ${profil(p)?`<div><h4>Geschmacksprofil</h4>${profil(p)}</div>`:""}
        ${(() => { const g = Object.fromEntries(Object.entries(p.geruch).filter(([t]) => !istGeschmack(t))), s = Object.fromEntries(Object.entries(p.geruch).filter(([t]) => istGeschmack(t)));
          return (Object.keys(g).length?`<div><h4>Geruch</h4><p>${tags(g)}</p></div>`:"") + (Object.keys(s).length?`<div><h4>Geschmack</h4><p>${tags(s)}</p></div>`:""); })()}
        ${Object.keys(p.fehler).length?`<div><h4>Fehlaromen</h4><p>${tags(p.fehler)}</p></div>`:""}
        <p><a href="liga.html?bier=${esc(p.bier_id)}">In der Liga ansehen →</a></p>`;
  // Alle Biere auf einer Karte: je Bier sein Kronkorken mit der Probennummer vom Abend (wie in der Rangliste bei
  // Blindverkostungen) am Schnittpunkt; bewusst ohne Notenfarbe – Grün sah nach Rangfolge aus. Liste nach Probennummer.
  const alleKarte = () => {
    const mit = proben.map(p => ({p, ds: kSchnitt(p)})).filter(x => x.ds).sort((a,b) => a.p.nummer - b.p.nummer);
    if(mit.length < 2) return "";
    return `<section class="sec"><h3>Alle Biere auf einer Karte</h3><p class="hint">So lagen die Biere im Schnitt – die Zahl am Kronkorken ist die Probennummer.</p>
      ${karteHtml({klein: true, ecken: false, attr: ` role="img" aria-label="Alle Biere auf der Geschmackskarte, Namen in der Liste darunter"`,
        innen: mit.map(({p, ds}) => `<span class="k-bier" style="${kartePos(ds[0],ds[1])}" title="Probe ${p.nummer}: ${esc(p.name)}">${Bilder.bier(p)}<span class="probe-nr num" aria-hidden="true">${p.nummer}</span></span>`).join("")})
        .replace('class="karte klein"', 'class="karte klein alle"')}
      <dl class="alle-liste">${mit.map(({p, ds}) => `<dt><span class="probe-nr num">${p.nummer}</span></dt><dd><b>${esc(p.name)}</b> · ${esc(kWorte(ds).toLowerCase())}${p.platz?` · Platz ${p.platz}`:""}</dd>`).join("")}</dl></section>`;
  };
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
        <small class="mt">${p.anzahl} Bew.${meinTxt(p)?` · <b class="meine">${meinTxt(p)}</b>`:""}</small>
        <span class="bar"><i class="${gradeCls(p.schnitt)}" style="width:${p.schnitt==null?0:Math.round(p.schnitt*10)}%"></i></span>
      </summary>
      <div class="erg-detail">
        ${detail(p)}
      </div></details></li>`;}).join("")}</ol>
      <p class="hint">Ein Bier auswählen zeigt Einzelnoten, Kommentare und Geschmacksprofil.</p></section>`:""}
    ${alleKarte()}
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

