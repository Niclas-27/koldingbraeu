/* Koldingbräu – Verkostungen: Braumeister-Ansicht (?id=<uuid>): vorbereiten, QR-Code, Biere, Status, Live-Auswertung, Korrekturen durch den Admin */
"use strict";
function vkForm(v){
  sheet(v ? "Verkostung bearbeiten" : "Neue Verkostung", `<form id="vkForm" class="stack" novalidate>
      <label class="f" for="v_titel">Titel<input id="v_titel" maxlength="100" value="${esc(v?.titel||"")}" placeholder="z. B. Herbstverkostung 2026" required></label>
      <div class="grid2"><label class="f" for="v_datum">Datum<input id="v_datum" type="date" value="${esc(v?.datum||KB.todayIso())}"></label>
      <label class="f" for="v_uhrzeit">Uhrzeit (freiwillig)<input id="v_uhrzeit" type="time" value="${esc((v?.uhrzeit||"").slice(0,5))}"></label></div>
      <label class="f" for="v_ort">Ort<input id="v_ort" maxlength="100" value="${esc(v?.ort||"")}"></label>
      <label class="f" for="v_text">Einladungstext (freiwillig)<textarea id="v_text" maxlength="1000" rows="3" placeholder="z. B. Bringt Hunger mit, es gibt Flammkuchen.">${esc(v?.einladungstext||"")}</textarea></label>
      <p class="hint">Steht in der Einladung und auf der Ankündigungsseite. Beides ist für jeden mit dem Link lesbar – also keine Privatadresse.</p>
      <label class="check"><input type="checkbox" id="v_blind"${v?.blind?" checked":""}><span><b>Blind verkosten</b><br><span class="hint">Gäste sehen nur Probennummern; die Biere werden beim Abschließen aufgedeckt.</span></span></label>
      <span class="err" id="vErr"></span>
    </form>`,
    `<span class="spacer"></span><button class="btn" id="vAbbr">Abbrechen</button><button class="btn primary" id="vSave" form="vkForm" type="submit">${v?"Speichern":"Anlegen"}</button>`);
  $("#vAbbr").onclick = closeSheet;
  $("#vkForm").onsubmit = async e => { e.preventDefault();
    const out = {titel: $("#v_titel").value.trim(), datum: $("#v_datum").value || KB.todayIso(), uhrzeit: $("#v_uhrzeit").value || null, ort: $("#v_ort").value.trim() || null, einladungstext: $("#v_text").value.trim() || null, blind: $("#v_blind").checked};
    if(!out.titel){ $("#vErr").textContent = "Bitte einen Titel eingeben."; return; }
    $("#vSave").disabled = true;
    const q = v ? sb.from("verkostungen").update(out).eq("id", v.id) : sb.from("verkostungen").insert(out);
    const {data, error} = await q.select("id").single();
    if(error){ $("#vSave").disabled = false; $("#vErr").textContent = fehlertext(error); return; }
    closeSheet();
    if(v){ toast("Gespeichert"); detailLaden(); } else location.href = "verkostung.html?id="+data.id;
  };
}


let D = null; // {v, proben, teilnehmer, bewertungen, vorschlaege}

async function detailLaden(){
  if(!isBM()){ stopTimer(); main().innerHTML = `<p class="empty">Diese Ansicht ist nur für angemeldete Braumeister.</p><p class="empty"><a href="verkostung.html">Zur Übersicht</a></p>`; return; }
  const [v, pr, tn, vs, gb] = await Promise.all([
    sb.from("verkostungen").select("*").eq("id", detailId).maybeSingle(),
    sb.from("proben").select("id,nummer,bier_id,biere(id,name,brauerei,eigen,alkohol,stil_id,sud_id,bild_kronkorken,bild_flasche,bierstile(name))").eq("verkostung_id", detailId).order("nummer"),
    sb.from("teilnehmer").select("id,name,angelegt").eq("verkostung_id", detailId).order("angelegt"),
    sb.from("vorschlaege").select("*").eq("verkostung_id", detailId).order("angelegt"),
    sb.from("verkostung_bilder").select("id,pfad,teilnehmer_id,bildunterschrift,aufgenommen,angelegt").eq("verkostung_id", detailId).order("angelegt"),
  ]);
  if(v.error || !v.data){ stopTimer(); main().innerHTML = `<p class="empty">${v.error?esc(fehlertext(v.error)):"Diese Verkostung gibt es nicht (mehr)."}</p><p class="empty"><a href="verkostung.html">Zur Übersicht</a></p>`; return; }
  const ids = (pr.data||[]).map(p=>p.id);
  const bw = ids.length ? await sb.from("bewertungen").select("*").in("probe_id", ids) : {data: []};
  D = {v: v.data, proben: (pr.data||[]).map(p=>({...p, bier: {...p.biere, stil: p.biere?.bierstile?.name}})), teilnehmer: tn.data||[], bewertungen: bw.data||[], vorschlaege: vs.data||[], galerie: gb.data||[]};
  detailZeigen();
  if(D.v.status === "laeuft") { if(!timer) startTimer(() => { if(!(galerieM && galerieM.beschaeftigt())) detailLaden(); }); } else stopTimer();
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
      <p class="hint">${esc([fmtDateLong(v.datum)+(v.uhrzeit?`, ${v.uhrzeit.slice(0,5)} Uhr`:""), v.ort, v.blind?"blind":"offen", teilnehmer.length+" Teilnehmer"].filter(Boolean).join(" · "))}</p></div>
      ${statusTag(v.status)}</div>
    <div class="top-actions">${aktion}${v.status==="abgeschlossen"?`<a class="btn" href="verkostung.html?e=${esc(v.id)}">Ergebnisseite</a>`:""}<button class="btn" id="vkEdit">Bearbeiten</button>${isAdmin()?`<button class="btn danger" id="vkDel">Löschen</button>`:""}</div>
    <div class="vk-grid">
      ${v.status!=="abgeschlossen"?`<section class="vk-card einladen"><h3>Gäste einladen</h3>
        <p class="hint">Die Einladung führt auf eine Ankündigungsseite – ohne Code. Mitmachen geht erst am Abend.</p>
        <pre class="einladung-vorschau">${esc(einladungsNachricht(v))}</pre>
        <div class="top-actions"><button class="btn primary" id="einladungTeilen">Einladung teilen</button><a class="btn" href="verkostung.html?a=${esc(v.id)}" target="_blank" rel="noopener">Ankündigung ansehen</a></div>
        ${!v.uhrzeit||!v.einladungstext?`<p class="hint">${!v.uhrzeit?"Noch keine Uhrzeit. ":""}${!v.einladungstext?"Noch kein Einladungstext. ":""}Beides unter „Bearbeiten“.</p>`:""}
      </section>`:""}
      <section class="vk-card qrbox"><h3>${v.status==="abgeschlossen"?"Link zur Verkostung":"Mitmachen am Abend"}</h3>
        <div class="qr" id="qrKlein">${QR.svg(link)}</div>
        <p class="num linktext">${esc(link)}</p>
        <div class="vk-codezeile"><span class="hint">Code zum Durchsagen oder Eintippen</span><b class="vk-code num" id="vkCode">${esc(v.code)}</b></div>
        <div class="top-actions"><button class="btn" id="qrGross">Groß zeigen</button><button class="btn" id="copyLink">Link kopieren</button><button class="btn" id="copyCode">Code kopieren</button><a class="btn" href="${esc(link)}" target="_blank" rel="noopener">Selbst mitbewerten</a></div>
        <p class="hint">${v.status==="vorbereitung"?"Diesen QR-Code bzw. Code erst am Abend zeigen. Mitmachen geht, sobald du die Verkostung startest. ":""}${v.status==="abgeschlossen"?"Die Verkostung ist abgeschlossen – über den Link sieht man jetzt das Ergebnis.":"Der Code gilt nur für diese Verkostung. Nach dem Abschließen kann niemand mehr beitreten oder bewerten."}</p>
      </section>
      <section class="vk-card"><h3>Biere (${proben.length})</h3>
        ${proben.length?`<ol class="plist">${proben.map((p,i)=>{const n=bewertungen.filter(b=>b.probe_id===p.id).length;return `<li>
          <span class="pn num">${p.nummer}</span>${Bilder.bier(p.bier)}
          <span class="pt"><b>${esc(p.bier.name)}</b><small>${esc(bierZeile(p.bier))}${p.bier.eigen&&!/kolding/i.test(p.bier.brauerei||"")?" · selbst gebraut":""}</small></span>
          <span class="pa">${n?`<small class="hint">${n} Bew.</small>`:""}
            ${v.status==="vorbereitung"?`<button class="x" data-up="${i}" aria-label="Nach oben"${i===0?" disabled":""}>↑</button><button class="x" data-down="${i}" aria-label="Nach unten"${i===proben.length-1?" disabled":""}>↓</button>`:""}<button class="x" data-raus="${esc(p.id)}" aria-label="Aus der Verkostung nehmen">✕</button></span>
        </li>`;}).join("")}</ol>`:`<p class="hint">Noch keine Biere. Etwa sechs sind ideal.</p>`}
        <button type="button" class="add" id="addBier">+ Bier hinzufügen</button>
        ${offeneVs.length?`<div class="vs"><h4>Vorschläge von Gästen</h4>${offeneVs.map(x=>`<div class="vs-row"><span><b>${esc(x.name)}</b><small class="hint">${esc([x.brauerei,x.stil,"von "+tnName(x.teilnehmer_id)].filter(Boolean).join(" · "))}</small></span>
          <span><button class="btn" data-vs-ok="${esc(x.id)}">Übernehmen</button><button class="btn ghost" data-vs-no="${esc(x.id)}">Ablehnen</button></span></div>`).join("")}</div>`:""}
      </section>
    </div>`;

  const zeilen = proben.map(p=>{const a=auswertung(p.id);return {id:p.id, nummer:p.nummer, titel:p.bier.name, unter:["Nr. "+p.nummer, bierZeile(p.bier)].filter(Boolean).join(" · "), bild:Bilder.bier(p.bier), schnitt:a.schnitt, anzahl:a.anzahl, nochmal:a.nochmal};});
  h += sec(v.status==="abgeschlossen" ? "Ergebnis" : v.status==="laeuft" ? "Zwischenstand (live)" : "Auswertung", (bewertungen.length ? rangTabelle(zeilen,{klick:true}) + `<p class="hint">Ein Bier auswählen zeigt alle Bewertungen und das Geschmacksprofil.${v.status==="laeuft"?" Aktualisiert sich alle 15 Sekunden.":""}</p>` : `<p class="hint">Noch keine Bewertungen.</p>`));
  h += sec("Fotos", `<div class="fotos-admin">${Bilder.feldHtml("titelFeld", v.bild_titel, {art:"frei", beschriftung:"Titelbild"})}</div>
    <h4 class="sub">Galerie (${D.galerie.length})</h4><p class="hint">Nur für Braumeister und Admin sichtbar.</p>
    <div id="galerieBox"></div>`);
  if(teilnehmer.length) h += sec("Teilnehmer", `<div class="tn">${teilnehmer.map(t=>{const n=bewertungen.filter(b=>b.teilnehmer_id===t.id).length;
    return `<span class="tag tn-tag">${esc(t.name)} · ${n} von ${proben.length} bewertet${isAdmin()?`<button type="button" class="tn-x" data-tn-del="${esc(t.id)}" aria-label="${esc(t.name)} entfernen">✕</button>`:""}</span>`;}).join("")}</div>`);
  main().innerHTML = h;

  const setStatus = async s => { const {error} = await sb.from("verkostungen").update({status: s}).eq("id", v.id); if(error){ toast(fehlertext(error)); return; } toast({laeuft:"Verkostung läuft",abgeschlossen:"Abgeschlossen – Ergebnis ist aufgedeckt",vorbereitung:"Zurück in Vorbereitung"}[s]);
    if(s === "abgeschlossen") { stopTimer(); location.href = "verkostung.html?e="+encodeURIComponent(v.id); return; }  // wie bei den Gästen: direkt aufs Ergebnis
    detailLaden(); };
  $("#stStart") && ($("#stStart").onclick = () => setStatus("laeuft"));
  $("#stEnde") && ($("#stEnde").onclick = () => bestaetigen("Verkostung abschließen?", "Danach kann niemand mehr bewerten, und das Ergebnis erscheint öffentlich in der Liga und bei den Verkostungen.", "Abschließen", () => setStatus("abgeschlossen")));
  $("#stWieder") && ($("#stWieder").onclick = () => bestaetigen("Wieder öffnen?", "Die Gäste können dann wieder bewerten. Das Ergebnis verschwindet so lange aus der öffentlichen Liga.", "Wieder öffnen", () => setStatus("laeuft")));
  $("#vkEdit").onclick = () => vkForm(v);
  $("#vkDel") && ($("#vkDel").onclick = () => bestaetigen("Verkostung löschen?", `„${v.titel}“ mit allen ${bewertungen.length} Bewertungen wird endgültig gelöscht. Die Biere selbst bleiben erhalten.`, "Endgültig löschen", async () => {
    const {data, error} = await sb.from("verkostungen").delete().eq("id", v.id).select("id");
    if(error || !data?.length){ toast(error ? fehlertext(error) : "Löschen ist nur dem Admin erlaubt."); return; }
    await Promise.all([v.bild_titel].filter(Boolean).map(p => Bilder.loeschen(p)));
    await Promise.all(D.galerie.map(g => Bilder.galerieLoeschen(g.pfad)));
    location.href = "verkostung.html";
  }, true));
  $("#qrGross").onclick = () => {
    sheet(v.titel, `<div class="qr gross">${QR.svg(link)}</div><p class="num linktext" style="text-align:center">${esc(link)}</p><p class="hint" style="text-align:center">Mit der Handykamera scannen und mitmachen.</p>`, `<span class="spacer"></span><button class="btn" id="qrZu">Schließen</button>`);
    $("#qrZu").onclick = closeSheet;
  };
  if($("#einladungTeilen")) $("#einladungTeilen").onclick = () => einladungTeilen(v);
  $("#copyCode").onclick = async () => { try{ await navigator.clipboard.writeText(v.code); toast("Code kopiert"); }catch(_){ toast("Kopieren ging nicht – bitte den Code markieren"); } };
  $("#copyLink").onclick = async () => { try{ await navigator.clipboard.writeText(link); toast("Link kopiert"); }catch(_){ toast("Kopieren ging nicht – bitte den Link markieren"); } };
  $("#addBier").onclick = () => bierWaehlen();
  Bilder.feldVerdrahten("titelFeld", {art:"frei", basis:`verkostungen/${v.id}/titel`, titel:"Titelbild", geaendert: async p => {
    const {error} = await sb.from("verkostungen").update({bild_titel: p}).eq("id", v.id);
    if(error){ toast(fehlertext(error)); return; }
    if(v.bild_titel && v.bild_titel !== p) Bilder.loeschen(v.bild_titel);
    v.bild_titel = p; toast(p ? "Titelbild gespeichert" : "Titelbild entfernt");
  }});
  galerieZeigen(v);
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
  main().querySelectorAll("[data-tn-del]").forEach(b => b.onclick = () => {
    const t = teilnehmer.find(x=>x.id===b.dataset.tnDel), n = bewertungen.filter(x=>x.teilnehmer_id===t.id).length;
    bestaetigen(`„${t.name}“ entfernen?`, n ? `Dabei gehen ${n} Bewertungen von ${t.name} verloren.` : `${t.name} hat noch nicht bewertet.`, "Entfernen", async () => {
      const {error} = await sb.rpc("vk_admin_teilnehmer_loeschen", {p_teilnehmer: t.id});
      if(error){ toast(fehlertext(error)); return; }
      toast("Teilnehmer entfernt"); detailLaden();
    }, true);
  });
  main().querySelectorAll("[data-vs-ok]").forEach(b => b.onclick = () => { const x = vorschlaege.find(y=>y.id===b.dataset.vsOk); bierForm(null, {name:x.name, brauerei:x.brauerei, stilName:x.stil, vorschlag:x.id}); });
  main().querySelectorAll("[data-vs-no]").forEach(b => b.onclick = async () => { const {error} = await sb.from("vorschlaege").update({status:"abgelehnt"}).eq("id", b.dataset.vsNo); if(error) toast(fehlertext(error)); detailLaden(); });
  main().querySelectorAll(".rank li[data-id]").forEach(li => { const f = () => probeDetail(li.dataset.id); li.onclick = f; li.onkeydown = e => { if(e.key==="Enter"||e.key===" "){ e.preventDefault(); f(); } }; });
}

/* Galerie (privater Bucket „verkostung-galerie“): Raster, Ablage für mehrere Fotos, Drag & Drop, Bildunterschrift,
   Datum und Zuschnitt – auch für Fotos der Gäste – über Bilder.galerieModul (lib/bilder.js). Während Ablage oder
   Bearbeiten offen sind, setzt das Live-Neuladen (alle 15 s) aus, damit nichts verloren geht. */
let galerieM = null;
function galerieZeigen(v){
  const box = $("#galerieBox"); if(!box) return;
  const name = id => (D.teilnehmer.find(t=>t.id===id)||{}).name;
  galerieM = Bilder.galerieModul({el: box, bucket: "verkostung-galerie", zeilen: D.galerie,
    leer: "Noch keine Fotos. Teilnehmer können bis zu drei Fotos pro Person hochladen, solange die Verkostung nicht abgeschlossen ist.",
    info: z => z.teilnehmer_id ? `von ${name(z.teilnehmer_id) || "einem Gast"}` : "",
    basis: () => `verkostungen/${v.id}/galerie/${crypto.randomUUID()}`,
    einfuegen: async f => { const {data, error} = await sb.from("verkostung_bilder").insert({verkostung_id: v.id, ...f}).select("id,pfad,teilnehmer_id,bildunterschrift,aufgenommen,angelegt").single(); if(error) throw error; D.galerie.push(data); galerieZahl(); return data; },
    aendern: async (z, patch) => (await sb.from("verkostung_bilder").update(patch).eq("id", z.id)).error,
    entfernen: async z => { const {error} = await sb.from("verkostung_bilder").delete().eq("id", z.id); if(!error){ D.galerie = D.galerie.filter(x=>x.id!==z.id); galerieZahl(); } return error; },
  });
}
function galerieZahl(){ const h = $("#galerieBox")?.previousElementSibling?.previousElementSibling; if(h && h.classList.contains("sub")) h.textContent = `Galerie (${D.galerie.length})`; }

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
    ${Bilder.bierFotos(p.bier)}
    <div class="stats mini"><div class="stat"><b class="num ${gradeCls(a.schnitt)}">${note(a.schnitt)}</b><span>Ø Gesamtnote</span></div><div class="stat"><b class="num">${a.anzahl}</b><span>Bewertungen</span></div><div class="stat"><b class="num">${a.anzahl?Math.round(a.nochmal/a.anzahl*100):0} %</b><span>würden nochmal</span></div></div>
    ${sec("Geschmacksprofil", profil)}
    ${sec("Geruch", zaehle("geruch"))}
    ${sec("Fehlaromen", zaehle("fehler"))}
    ${sec("Einzelne Bewertungen", alle.length ? `<div class="bw">${alle.map(b=>`<div class="bw-row${b.ausgeblendet?" aus":""}">
      <span class="grade ${gradeCls(b.note)}">${b.note}</span>
      <span class="bw-t"><b>${esc(tn(b.teilnehmer_id))}</b>${b.nochmal===true?" · nochmal: ja":b.nochmal===false?" · nochmal: nein":""}${vermerk(b)}${b.kommentar?`<span class="note">${esc(b.kommentar)}</span>`:""}</span>
      <span class="bw-a">${isAdmin()?`<button class="btn ghost" data-ed="${esc(b.teilnehmer_id)}">Bearbeiten</button>`:""}<button class="btn ghost" data-aus="${esc(b.id)}">${b.ausgeblendet?"Einblenden":"Ausblenden"}</button></span></div>`).join("")}</div>
      <p class="hint">Ausgeblendete Bewertungen zählen nicht fürs Ranking und die Liga.</p>` : "")}
    ${isAdmin()?`<button type="button" class="add" id="nachtragen">+ Bewertung nachtragen</button>`:""}`;
  sheet(`${p.nummer}. ${p.bier.name}`, body, `<span class="spacer"></span><button class="btn" id="pdZu">Schließen</button>`);
  $("#pdZu").onclick = closeSheet;
  Bilder.bierFotosVerdrahten($("#sheetBody"));
  $("#sheetBody").querySelectorAll("[data-ed]").forEach(btn => btn.onclick = () => adminBogen(probeId, btn.dataset.ed));
  const nt = $("#nachtragen"); if(nt) nt.onclick = () => adminBogen(probeId, null);
  $("#sheetBody").querySelectorAll("[data-aus]").forEach(btn => btn.onclick = async () => {
    const b = D.bewertungen.find(x=>x.id===btn.dataset.aus);
    btn.disabled = true;
    const {error} = await sb.from("bewertungen").update({ausgeblendet: !b.ausgeblendet}).eq("id", b.id);
    if(error){ btn.disabled = false; toast(fehlertext(error)); return; }
    b.ausgeblendet = !b.ausgeblendet; probeDetail(probeId); detailZeigen();
  });
}

function vermerk(b){
  if(!b.admin_geaendert) return "";
  const wann = new Date(b.admin_geaendert).toLocaleDateString("de-DE");
  if(b.nachgetragen) return `<small class="vermerk">vom Admin nachgetragen am ${esc(wann)}</small>`;
  return `<small class="vermerk">vom Admin geändert am ${esc(wann)}${b.original_note!=null&&b.original_note!==b.note?` · ursprünglich ${b.original_note}`:""}</small>`;
}

/* Admin: Bewertung ändern (teilnehmerId gesetzt) oder nachtragen (null) */
function adminBogen(probeId, teilnehmerId){
  if(!isAdmin()) return;
  const p = D.proben.find(x=>x.id===probeId); if(!p) return;
  const zurueck = () => { detailLaden().then(() => probeDetail(probeId)); };
  if(teilnehmerId){
    const t = D.teilnehmer.find(x=>x.id===teilnehmerId);
    bogenZeigen({
      titel: `${p.nummer}. ${p.bier.name}`,
      hint: `Bewertung von ${t?.name||"Gast"} ändern. Die ursprüngliche Note bleibt intern vermerkt.`,
      alt: D.bewertungen.find(b=>b.probe_id===probeId && b.teilnehmer_id===teilnehmerId) || {},
      speichern: f => sb.rpc("vk_admin_bewerten", {p_probe: probeId, p_teilnehmer: teilnehmerId, ...f}),
      fertig: zurueck,
    });
    return;
  }
  const ohne = D.teilnehmer.filter(t => !D.bewertungen.some(b=>b.probe_id===probeId && b.teilnehmer_id===t.id));
  bogenZeigen({
    titel: `${p.nummer}. ${p.bier.name}`,
    hint: "Bewertung nachtragen. Sie wird intern als nachgetragen vermerkt.",
    oben: `<div class="grid2"><label class="f" for="nt_wer">Für wen?<select id="nt_wer">${ohne.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("")}<option value="neu">+ Neuer Teilnehmer …</option></select></label>
      <label class="f" for="nt_name" id="nt_nameWrap"${ohne.length?" hidden":""}>Name<input id="nt_name" maxlength="40"></label></div>`,
    alt: {},
    speichern: async f => {
      let wer = $("#nt_wer").value;
      if(wer === "neu"){
        const n = $("#nt_name").value.trim();
        if(!n) return {error: {code: "P0001", message: "Bitte den Namen des neuen Teilnehmers eingeben."}};
        const r = await sb.rpc("vk_admin_teilnehmer", {p_verkostung: D.v.id, p_name: n});
        if(r.error) return r;
        wer = r.data; $("#nt_wer").insertAdjacentHTML("afterbegin", `<option value="${esc(wer)}" selected>${esc(n)}</option>`); $("#nt_nameWrap").hidden = true;
      }
      return sb.rpc("vk_admin_bewerten", {p_probe: probeId, p_teilnehmer: wer, ...f});
    },
    fertig: zurueck,
  });
  $("#nt_wer").onchange = () => { $("#nt_nameWrap").hidden = $("#nt_wer").value !== "neu"; };
}

/* Bier zur Verkostung hinzufügen: Suche + Filter (lib/bierform.js), sortiert nach „zuletzt verkostet“, oder neu anlegen */
async function bierWaehlen(){
  let biere;
  try{ biere = await BierForm.laden(); }catch(e){ toast(fehlertext(e)); return; }
  const schon = new Set(D.proben.map(p=>p.bier_id));
  const liste = biere.filter(b=>!schon.has(b.id));
  const zeile = b => `<button class="pick" data-b="${esc(b.id)}">${Bilder.bier(b)}<span><b>${esc(b.name)}</b><small>${esc([BierForm.zeile(b), b.letzte ? "zuletzt "+fmtDateLong(b.letzte) : "noch nie verkostet"].filter(Boolean).join(" · "))}</small></span></button>`;
  sheet("Bier hinzufügen", `${liste.length ? `<div id="bFilter" class="bf-leiste"></div><div class="picklist" id="pickList"></div>` : `<p class="hint">Die Bierliste ist leer – oder alle Biere sind schon dabei.</p>`}`,
    `<button class="btn" id="neuesBier">+ Neues Bier</button><span class="spacer"></span><button class="btn" id="bwZu">Abbrechen</button>`);
  $("#bwZu").onclick = closeSheet;
  $("#neuesBier").onclick = () => bierForm(null, {});
  if(liste.length) BierForm.filter($("#bFilter"), liste, gef => {
    $("#pickList").innerHTML = gef.length ? gef.map(zeile).join("") : `<p class="hint">Kein Bier passt. Mit „+ Neues Bier“ unten anlegen.</p>`;
    $("#pickList").querySelectorAll(".pick").forEach(p => p.onclick = async () => { p.disabled = true; await probeAnlegen(p.dataset.b); closeSheet(); detailLaden(); });
  }, {merken: "verkostung", fokus: true});
}
async function probeAnlegen(bierId){
  const nr = Math.max(0, ...D.proben.map(p=>p.nummer)) + 1;
  const {error} = await sb.from("proben").insert({verkostung_id: D.v.id, bier_id: bierId, nummer: nr});
  if(error) toast(error.code==="23505" ? "Dieses Bier ist schon dabei." : fehlertext(error)); else toast("Bier hinzugefügt");
}

/* Bier anlegen oder bearbeiten – Formular aus lib/bierform.js. vorgabe: {name, brauerei, stilName, vorschlag} */
async function bierForm(bier, vorgabe, nachher){
  const hinzufuegen = !bier && D && !nachher;
  await BierForm.oeffnen(bier, {vorgabe, stile: await ladeStile(), knopf: hinzufuegen ? "Anlegen und hinzufügen" : "Anlegen",
    gespeichert: async (id, neu) => {
      if(hinzufuegen){
        await probeAnlegen(id);
        if(vorgabe.vorschlag) await sb.from("vorschlaege").update({status: "uebernommen"}).eq("id", vorgabe.vorschlag);
        closeSheet(); detailLaden(); return;
      }
      toast(neu ? "Bier angelegt" : "Gespeichert");
      if(nachher) nachher(); else closeSheet();
    }});
}

