/* Koldingbräu – Verkostungen: Übersicht (ohne Parameter): bisherige Verkostungen als Karten, für Braumeister zusätzlich laufende/geplante */
"use strict";
async function listeLaden(){
  stopTimer();
  const archiv = await sb.rpc("vk_archiv");
  let h = `<div class="vk-head"><div><h2>Verkostungen</h2><p class="hint">Biere nebeneinander probieren, bewerten und am Ende das Ranking aufdecken.</p></div>
    ${isBM()?`<div class="top-actions"><button class="btn" id="bierBtn">Biere</button><button class="btn primary" id="neuBtn">+ Neue Verkostung</button></div>`:""}</div>
    <form id="codeForm" class="vk-card codebox" novalidate>
      <label class="f" for="c_code">Code von der Einladung<input id="c_code" autocomplete="one-time-code" autocapitalize="off" spellcheck="false" placeholder="z. B. k7m2p9qx4a"></label>
      <button class="btn" type="submit">Mitmachen</button>
    </form>`;
  if(isBM()){
    const {data, error} = await sb.from("verkostungen").select("id,titel,datum,ort,blind,status").neq("status","abgeschlossen").order("datum",{ascending:false}).order("angelegt",{ascending:false});
    if(error) h += `<p class="empty">${esc(fehlertext(error))}</p>`;
    else if(data.length){
      const ids = data.map(v=>v.id);
      // Zählen ohne PostgREST-Aggregatfunktion (die ist standardmäßig gesperrt): einfach die Zeilen laden und zählen.
      const [pr, tn] = await Promise.all([
        sb.from("proben").select("verkostung_id").in("verkostung_id", ids),
        sb.from("teilnehmer").select("verkostung_id").in("verkostung_id", ids),
      ]);
      const zaehlen = (rows, id) => (rows||[]).filter(r=>r.verkostung_id===id).length;
      h += sec("In Vorbereitung und laufend", `<div class="vk-list">${data.map(v=>`<a class="vk-item" href="verkostung.html?id=${esc(v.id)}">
        <span class="d num">${esc(fmtDateLong(v.datum))}</span>
        <span class="t"><b>${esc(v.titel)}</b><small>${esc([v.ort, zaehlen(pr.data,v.id)+" Biere", zaehlen(tn.data,v.id)+" Teilnehmer", v.blind?"blind":""].filter(Boolean).join(" · "))}</small></span>
        ${statusTag(v.status)}</a>`).join("")}</div>`);
    }
  } else {
    // Öffentliche Ankündigung für nicht angemeldete Gäste: zeigt an, dass etwas kommt, ohne Code oder Teilnehmernamen zu verraten.
    const {data, error} = await sb.rpc("vk_angekuendigt");
    if(!error && data && data.length){
      h += sec("Demnächst", `<div class="ankuendigungen">${data.map(v => `<div class="vk-card">
          ${v.bild_titel ? `<div class="ank-bild"><img src="${esc(Bilder.url(v.bild_titel, true))}" alt="" loading="lazy"></div>` : (v.blind ? `<div class="ank-bild">${Bilder.titelPlatzhalter()}</div>` : "")}
          <div class="ank-inhalt">
            <div class="vk-head"><div><b>${esc(v.titel)}</b><p class="hint">${esc([fmtDateLong(v.datum), v.ort].filter(Boolean).join(" · "))}</p></div>${statusTag(v.status)}</div>
            <p class="hint">${v.status==="laeuft" ? "Läuft schon – mit dem Code oder QR-Link von den Braumeistern kannst du noch mitmachen." : "Bald geht’s los – mit dem Code oder QR-Link von den Braumeistern bist du dabei."}</p>
            ${v.blind
              ? `<p class="hint">${v.anzahlProben} ${v.anzahlProben===1?"Bier steht":"Biere stehen"} bereit – welche, wird erst am Ende verraten.</p>`
              : (v.proben.length ? `<ul class="plain">${v.proben.map(p=>`<li><b>${p.nummer}.</b> ${esc(p.name)} <small class="hint">${esc(bierZeile(p))}</small></li>`).join("")}</ul>` : "")}
          </div>
        </div>`).join("")}</div>`);
    }
  }
  if(archiv.error) h += `<p class="empty">${esc(fehlertext(archiv.error))}</p>`;
  else if(!archiv.data.length) h += `<p class="empty">${isBM()?"Noch keine abgeschlossene Verkostung. Leg mit „+ Neue Verkostung“ eine an.":"Noch keine abgeschlossenen Verkostungen."}</p>`;
  else h += sec("Bisherige Verkostungen", `<div class="vk-cards">${archiv.data.map(v => {
      const sieger = v.proben.find(p => p.schnitt != null);
      const inhalt = `<span class="d">${esc([fmtDateLong(v.datum), v.ort].filter(Boolean).join(" · "))}</span>
        <b class="t">${esc(v.titel)}</b>
        <span class="m">${v.proben.length} ${v.proben.length===1?"Bier":"Biere"}${(v.namen||[]).length ? " · mit "+esc(v.namen.join(", ")) : ""}</span>
        ${sieger?`<span class="w">${Bilder.bier(sieger)}<span>${esc(sieger.name)}</span><b class="num ${gradeCls(sieger.schnitt)}">${note(sieger.schnitt)}</b></span>`:""}`;
      return v.bild_titel
        ? `<a class="vk-tile mit-titel" href="verkostung.html?e=${esc(v.id)}">
        <img class="vt-bild" src="${esc(Bilder.url(v.bild_titel, true))}" alt="" loading="lazy">
        <div class="vt-body">${inhalt}</div>
      </a>`
        : `<a class="vk-tile" href="verkostung.html?e=${esc(v.id)}">${inhalt}</a>`;
      }).join("")}</div>`);
  main().innerHTML = h;
  $("#codeForm").onsubmit = e => { e.preventDefault(); const c = $("#c_code").value.trim().toLowerCase().replace(/.*[?&]v=/, "").replace(/[^a-z0-9]/g, ""); if(c) location.href = "verkostung.html?v="+encodeURIComponent(c); };
  if(isBM()){ $("#neuBtn").onclick = () => vkForm(null); $("#bierBtn").onclick = bierKatalog; }
}

