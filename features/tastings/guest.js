/* Koldingbräu – Verkostungen: Gäste-Ansicht (?v=<code>): beitreten, bewerten, Live-Zwischenstand, Biere vorschlagen */
"use strict";
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
    </div>${v.bild_titel?`<img class="titelbild" src="${esc(Bilder.url(v.bild_titel))}" alt="Titelbild der Verkostung">`:""}`;

  if(!ich && v.status !== "abgeschlossen"){
    h += `<form id="joinForm" class="vk-card stack" novalidate>
        <h3>Mitmachen</h3>
        <p class="hint">Gib deinen Vornamen oder Spitznamen ein. Er gilt nur für diesen Abend und erscheint nach dem Abschluss in der Teilnehmerliste der Ergebnisseite; deine Kommentare werden dort ohne Namen gezeigt.</p>
        <label class="f" for="j_name">Dein Name<input id="j_name" maxlength="40" autocomplete="given-name" required></label>
        <span class="err" id="joinErr"></span>
        <button class="btn primary" type="submit" id="joinBtn" style="align-self:flex-start">Los geht’s</button>
      </form>`;
  } else if(ich){
    h += `<p class="hint">Du bist dabei als <b>${esc(ich.name)}</b>. <button class="linkbtn" id="notMe">Nicht du?</button></p>`;
  }

  if(v.status === "vorbereitung"){
    h += `<div class="vk-card"><h3>Bald geht’s los</h3><p class="hint">Sobald die Braumeister die Verkostung starten, kannst du hier die Biere bewerten. Die Seite aktualisiert sich von selbst.</p>
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
        ${offen?Bilder.bier(p.bier):`<span class="pn num">${p.nummer}</span>`}
        <span class="pt"><b>${offen?esc(p.bier.name):"Probe "+p.nummer}</b><small>${offen?esc(bierZeile(p.bier)):"blind"}</small></span>
        <span class="pg">${m?`<b class="num ${gradeCls(m.note)}">${m.note}</b>`:"bewerten"}</span>
      </button>`;}).join("")}</div>`);
  }

  if(v.status !== "vorbereitung" && d.proben.length){
    const zeilen = d.proben.map(p=>({id:p.id, nummer:p.nummer, titel: offen ? p.bier.name : "Probe "+p.nummer,
      unter: offen ? bierZeile(p.bier) : "", schnitt:p.schnitt, anzahl:p.anzahl, nochmal:p.nochmal, bild: offen ? Bilder.bier(p.bier) : ""}));
    h += sec(v.status==="abgeschlossen" ? "Ergebnis" : "Zwischenstand (live)", rangTabelle(zeilen)
      + (v.status==="laeuft" ? `<p class="hint">Aktualisiert sich alle 15 Sekunden.${v.blind?" Die Namen werden am Ende aufgedeckt.":""}</p>` : ""));
  }
  if(v.status === "abgeschlossen" && !ich) h += `<p class="hint">Diese Verkostung ist abgeschlossen.</p>`;
  const darf = ich && v.status !== "abgeschlossen" && (ich.bilder||0) < 3;
  const kannLoeschen = ich && v.status !== "abgeschlossen" && (ich.bilder||0) > 0;
  if(ich && v.status !== "abgeschlossen") h += sec("Fotos vom Abend", (darf
      ? `<button type="button" class="add" id="fotoBtn">+ Foto hinzufügen (${ich.bilder||0} von 3)</button><span class="err" id="fotoErr"></span><p class="hint">Bitte nur Fotos, mit denen alle Abgebildeten einverstanden sind. Sie sind nur für die Braumeister sichtbar.</p>`
      : `<p class="hint">Du hast deine drei Fotos hochgeladen – danke! Sie sind nur für die Braumeister sichtbar.</p>`)
      + (kannLoeschen ? `<button type="button" class="linkbtn" id="fotoLoeschBtn">Zuletzt hochgeladenes Foto entfernen</button><span class="err" id="fotoLoeschErr"></span>` : ""));
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
  const tb = main().querySelector(".titelbild"); if(tb) tb.onclick = () => Bilder.zeigen(v.bild_titel);
  const fb = $("#fotoBtn"); if(fb) fb.onclick = gastFoto;
  const flb = $("#fotoLoeschBtn"); if(flb) flb.onclick = gastFotoLoeschen;
}

function bogen(probeId){
  const d = gData, p = d.proben.find(x=>x.id===probeId); if(!p) return;
  const offen = !d.verkostung.blind || d.verkostung.status === "abgeschlossen";
  bogenZeigen({
    titel: offen ? `${p.nummer}. ${p.bier.name}` : `Probe ${p.nummer}`,
    hint: offen ? bierZeile(p.bier) : "",
    alt: (d.ich.bewertungen||[]).find(b=>b.probe_id===probeId) || {},
    speichern: f => sb.rpc("vk_bewerten", {p_code: code, p_token: gast().token, p_probe: probeId, ...f}),
    fertig: () => gastLaden(),
  });
}

async function bmHinweis(){
  const {data} = await sb.from("verkostungen").select("id").eq("code", code).maybeSingle();
  if(data){ const n = $("#notice"); n.hidden = false; n.innerHTML = `Du bist als Braumeister angemeldet. <a href="verkostung.html?id=${esc(data.id)}">Zur Verwaltung dieser Verkostung</a>`; }
}

/* Gast lädt ein Foto für die Galerie hoch – über die Edge Function „galerie-hochladen“ (prüft Code, Schlüssel, max. 3) */
async function gastFoto(){
  const erg = await Bilder.waehlen({form: "frei", titel: "Foto vom Abend"});
  if(!erg) return;
  const btn = $("#fotoBtn"), err = $("#fotoErr");
  btn.disabled = true; btn.textContent = "Wird hochgeladen …"; err.textContent = "";
  const fd = new FormData();
  fd.append("code", code); fd.append("token", gast().token);
  fd.append("gross", erg.gross, "foto.jpg"); fd.append("klein", erg.klein, "foto_t.jpg");
  const {error} = await sb.functions.invoke("galerie-hochladen", {body: fd});
  if(error){
    let msg = "Hochladen fehlgeschlagen."; try{ const j = await error.context.json(); if(j && j.fehler) msg = j.fehler; }catch(_){}
    btn.disabled = false; btn.textContent = "+ Foto hinzufügen"; err.textContent = msg; return;
  }
  toast("Foto hochgeladen"); gastLaden();
}

/* Gast entfernt sein zuletzt hochgeladenes Foto wieder – über die Edge Function „galerie-loeschen“ */
async function gastFotoLoeschen(){
  const btn = $("#fotoLoeschBtn"), err = $("#fotoLoeschErr");
  btn.disabled = true; err.textContent = "";
  const {error} = await sb.functions.invoke("galerie-loeschen", {body: {code, token: gast().token}});
  if(error){
    let msg = "Löschen fehlgeschlagen."; try{ const j = await error.context.json(); if(j && j.fehler) msg = j.fehler; }catch(_){}
    btn.disabled = false; err.textContent = msg; return;
  }
  toast("Foto entfernt"); gastLaden();
}
