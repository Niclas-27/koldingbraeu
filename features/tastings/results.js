/* Koldingbräu – Verkostungen: öffentliche Ergebnisseite einer abgeschlossenen Verkostung (?e=<uuid>) */
"use strict";
async function ergebnisLaden(){
  stopTimer();
  const {data, error} = await sb.rpc("vk_ergebnis", {p_id: ergebnisId});
  if(error){ main().innerHTML = `<p><a class="back" href="verkostung.html">← Alle Verkostungen</a></p><p class="empty">${esc(fehlertext(error))}</p>`; return; }
  const v = data.verkostung, proben = rangfolge(data.proben);
  document.title = v.titel + " · Koldingbräu";
  // Plätze vergeben (gleicher Schnitt und gleiche Nochmal-Zahl = gleicher Platz)
  let platz = 0, vorher = null;
  proben.forEach((p,i) => { const k = p.schnitt==null ? null : `${p.schnitt}|${p.nochmal}`; if(k!==vorher){ platz = i+1; vorher = k; } p.platz = p.schnitt==null ? null : platz; });
  const podium = proben.filter(p => p.platz && p.platz <= 3).slice(0,3);
  const stufe = p => `<div class="stufe s${p.platz}"><span class="medaille" aria-hidden="true">${["🥇","🥈","🥉"][p.platz-1]}</span>${Bilder.bier(p,"flasche","gross")}
      <b>${esc(p.name)}</b><small>${esc([p.brauerei, p.stil].filter(Boolean).join(" · "))}</small><span class="num">${note(p.schnitt)}</span></div>`;
  const ordnung = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;

  const noten = p => `<div class="dots" aria-label="Einzelnoten: ${esc(p.noten.join(", "))}">${Array.from({length:11},(_,i)=>`<span class="tick${i%5===0?" lab":""}">${i%5===0?i:""}</span>`).join("")}
      ${(() => { const c = new Map(); return p.noten.map(n => { const k = c.get(n) || 0; c.set(n, k+1); return `<i style="left:${n*10}%;bottom:${10+k*12}px" title="Note ${n}"></i>`; }).join(""); })()}</div>`;
  const profil = p => MERKMALE.flatMap(([,l])=>l).filter(([k]) => p.merkmale[k]).map(([k,label,l,r]) =>
      `<div class="pf"><span class="pf-l">${esc(l)}</span><span class="pf-t"><i style="left:${p.merkmale[k].wert*10}%"></i></span><span class="pf-r">${esc(r)}</span><small class="pf-n">${esc(label)}</small></div>`).join("");
  const tags = o => Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([t,n])=>`<span class="tag">${esc(t)}${n>1?` ${n}×`:""}</span>`).join(" ");

  let h = `<p><a class="back" href="verkostung.html">← Alle Verkostungen</a></p>
    <div class="vk-head"><div><p class="kicker">Verkostung</p><h2>${esc(v.titel)}</h2>
      <p class="hint">${esc([fmtDateLong(v.datum), v.ort, proben.length+" Biere", v.blind?"blind verkostet":""].filter(Boolean).join(" · "))}</p>
      ${data.teilnehmer.length?`<p class="hint">Mit ${esc(data.teilnehmer.join(", "))}</p>`:""}</div>
      ${isBM()?`<a class="btn" href="verkostung.html?id=${esc(v.id)}">Verwalten</a>`:""}</div>
    ${v.bild_titel?`<img class="titelbild" id="titelbild" src="${esc(Bilder.url(v.bild_titel))}" alt="Titelbild der Verkostung">`:""}
    ${podium.length?`<div class="podium">${ordnung.map(stufe).join("")}</div>`:""}
    <section class="sec"><h3>Rangliste</h3><ol class="rank erg">${proben.map(p => {
      const offen = p.kommentare.length || Object.keys(p.merkmale).length || Object.keys(p.geruch).length || Object.keys(p.fehler).length || p.noten.length;
      return `<li class="${p.platz&&p.platz<=3?"top p"+p.platz:""}">
      <details${offen?"":" class=\"leer\""}><summary>
        <span class="pl num">${p.platz?p.platz+".":"–"}</span>
        <span class="nm mit-bild">${Bilder.bier(p,"kronkorken")}<span><b>${esc(p.name)}</b><small>${esc(bierZeile(p))}${p.eigen&&!/kolding/i.test(p.brauerei||"")?" · selbst gebraut":""}</small></span></span>
        <span class="sc"><b class="num">${note(p.schnitt)}</b></span>
        <small class="mt">${p.anzahl} Bew.${p.anzahl?` · ${Math.round(p.nochmal/p.anzahl*100)} % nochmal`:""}</small>
        <span class="bar"><i style="width:${p.schnitt==null?0:Math.round(p.schnitt*10)}%"></i></span>
      </summary>
      <div class="erg-detail">
        ${p.noten.length?`<div><h4>Einzelnoten</h4>${noten(p)}</div>`:""}
        ${p.kommentare.length?`<div><h4>Gesagt wurde</h4><ul class="zitate">${p.kommentare.map(k=>`<li>${esc(k)}</li>`).join("")}</ul></div>`:""}
        ${profil(p)?`<div><h4>Geschmacksprofil</h4>${profil(p)}</div>`:""}
        ${Object.keys(p.geruch).length?`<div><h4>Geruch</h4><p>${tags(p.geruch)}</p></div>`:""}
        ${Object.keys(p.fehler).length?`<div><h4>Fehlaromen</h4><p>${tags(p.fehler)}</p></div>`:""}
        <p><a href="liga.html#bier=${esc(p.bier_id)}">In der Liga ansehen →</a></p>
      </div></details></li>`;}).join("")}</ol>
      <p class="hint">Antippen zeigt Einzelnoten, Kommentare und Geschmacksprofil.</p></section>`;
  if(data.galerie.length) h += sec(`Fotos vom Abend (${data.galerie.length})`, Bilder.galerieHtml(data.galerie));
  main().innerHTML = h;
  Bilder.galerieVerdrahten(main(), data.galerie);
  const tb = $("#titelbild"); if(tb) tb.onclick = () => Bilder.zeigen(v.bild_titel);
}

