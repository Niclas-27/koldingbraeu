/* Koldingbräu – Verkostungen: Braumeister-Ansicht (?id=<uuid>): vorbereiten, QR-Code, Biere, Status, Live-Auswertung, Korrekturen durch den Admin */
"use strict";
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


let D = null; // {v, proben, teilnehmer, bewertungen, vorschlaege}

async function detailLaden(){
  if(!isBM()){ stopTimer(); main().innerHTML = `<p class="empty">Diese Ansicht ist nur für angemeldete Braumeister.</p><p class="empty"><a href="verkostung.html">Zur Übersicht</a></p>`; return; }
  const [v, pr, tn, vs, gb] = await Promise.all([
    sb.from("verkostungen").select("*").eq("id", detailId).maybeSingle(),
    sb.from("proben").select("id,nummer,bier_id,zusammenfassung,biere(id,name,brauerei,eigen,alkohol,stil_id,sud_id,bild_kronkorken,bild_flasche,bierstile(name))").eq("verkostung_id", detailId).order("nummer"),
    sb.from("teilnehmer").select("id,name,angelegt").eq("verkostung_id", detailId).order("angelegt"),
    sb.from("vorschlaege").select("*").eq("verkostung_id", detailId).order("angelegt"),
    sb.from("verkostung_bilder").select("id,pfad,teilnehmer_id,angelegt").eq("verkostung_id", detailId).order("angelegt"),
  ]);
  if(v.error || !v.data){ stopTimer(); main().innerHTML = `<p class="empty">${v.error?esc(fehlertext(v.error)):"Diese Verkostung gibt es nicht (mehr)."}</p><p class="empty"><a href="verkostung.html">Zur Übersicht</a></p>`; return; }
  const ids = (pr.data||[]).map(p=>p.id);
  const bw = ids.length ? await sb.from("bewertungen").select("*").in("probe_id", ids) : {data: []};
  D = {v: v.data, proben: (pr.data||[]).map(p=>({...p, bier: {...p.biere, stil: p.biere?.bierstile?.name}})), teilnehmer: tn.data||[], bewertungen: bw.data||[], vorschlaege: vs.data||[], galerie: gb.data||[]};
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
    <div class="top-actions">${aktion}${v.status==="abgeschlossen"?`<a class="btn" href="verkostung.html?e=${esc(v.id)}">Ergebnisseite</a>`:""}${v.status==="abgeschlossen"&&isAdmin()?`<button class="btn" id="zfBtn">${proben.some(p=>p.zusammenfassung)?"Zusammenfassungen erneuern":"Zusammenfassungen erstellen"}</button>`:""}<button class="btn" id="vkEdit">Bearbeiten</button>${isAdmin()?`<button class="btn danger" id="vkDel">Löschen</button>`:""}</div>
    <div class="vk-grid">
      <section class="vk-card qrbox"><h3>Einladung</h3>
        <div class="qr" id="qrKlein">${QR.svg(link)}</div>
        <p class="num linktext">${esc(link)}</p>
        <div class="top-actions"><button class="btn" id="qrGross">Groß zeigen</button><button class="btn" id="copyLink">Link kopieren</button><a class="btn" href="${esc(link)}" target="_blank" rel="noopener">Selbst mitbewerten</a></div>
        <p class="hint">${v.status==="abgeschlossen"?"Die Verkostung ist abgeschlossen – über den Link sieht man jetzt das Ergebnis.":"Der Code gilt nur für diese Verkostung. Nach dem Abschließen kann niemand mehr beitreten oder bewerten."}</p>
      </section>
      <section class="vk-card"><h3>Biere (${proben.length})</h3>
        ${proben.length?`<ol class="plist">${proben.map((p,i)=>{const n=bewertungen.filter(b=>b.probe_id===p.id).length;return `<li>
          <span class="pn num">${p.nummer}</span>${Bilder.bier(p.bier)}
          <span class="pt"><b>${esc(p.bier.name)}</b><small>${esc(bierZeile(p.bier))}${p.bier.eigen&&!/kolding/i.test(p.bier.brauerei||"")?" · selbst gebraut":""}</small></span>
          <span class="pa">${n?`<small class="hint">${n} Bew.</small>`:""}
            <button class="x" data-up="${i}" aria-label="Nach oben"${i===0?" disabled":""}>↑</button><button class="x" data-down="${i}" aria-label="Nach unten"${i===proben.length-1?" disabled":""}>↓</button><button class="x" data-raus="${esc(p.id)}" aria-label="Aus der Verkostung nehmen">✕</button></span>
        </li>`;}).join("")}</ol>`:`<p class="hint">Noch keine Biere. Etwa sechs sind ideal.</p>`}
        <button type="button" class="add" id="addBier">+ Bier hinzufügen</button>
        ${offeneVs.length?`<div class="vs"><h4>Vorschläge von Gästen</h4>${offeneVs.map(x=>`<div class="vs-row"><span><b>${esc(x.name)}</b><small class="hint">${esc([x.brauerei,x.stil,"von "+tnName(x.teilnehmer_id)].filter(Boolean).join(" · "))}</small></span>
          <span><button class="btn" data-vs-ok="${esc(x.id)}">Übernehmen</button><button class="btn ghost" data-vs-no="${esc(x.id)}">Ablehnen</button></span></div>`).join("")}</div>`:""}
      </section>
    </div>`;

  const zeilen = proben.map(p=>{const a=auswertung(p.id);return {id:p.id, nummer:p.nummer, titel:`${p.nummer}. ${p.bier.name}`, unter:bierZeile(p.bier), bild:Bilder.bier(p.bier), schnitt:a.schnitt, anzahl:a.anzahl, nochmal:a.nochmal};});
  h += sec(v.status==="abgeschlossen" ? "Ergebnis" : v.status==="laeuft" ? "Zwischenstand (live)" : "Auswertung", (bewertungen.length ? rangTabelle(zeilen,{klick:true}) + `<p class="hint">Antippen zeigt alle Bewertungen und das Geschmacksprofil.${v.status==="laeuft"?" Aktualisiert sich alle 15 Sekunden.":""}</p>` : `<p class="hint">Noch keine Bewertungen.</p>`));
  h += sec("Fotos", `<div class="fotos-admin">${Bilder.feldHtml("titelFeld", v.bild_titel, {art:"frei", beschriftung:"Titelbild"})}</div>
    <h4 class="sub">Galerie (${D.galerie.length})</h4>
    ${D.galerie.length ? Bilder.galerieHtml(D.galerie.map(g=>g.pfad), {loeschbar:true}) : `<p class="hint">Noch keine Fotos. Gäste können bis zu drei Fotos pro Person hochladen, solange die Verkostung nicht abgeschlossen ist.</p>`}
    <button type="button" class="add" id="fotoAdd">+ Foto hinzufügen</button>`);
  if(teilnehmer.length) h += sec("Teilnehmer", `<div class="tn">${teilnehmer.map(t=>{const n=bewertungen.filter(b=>b.teilnehmer_id===t.id).length;
    return `<span class="tag tn-tag">${esc(t.name)} · ${n}/${proben.length}${isAdmin()?`<button type="button" class="tn-x" data-tn-del="${esc(t.id)}" aria-label="${esc(t.name)} entfernen">✕</button>`:""}</span>`;}).join("")}</div>`);
  main().innerHTML = h;

  const setStatus = async s => { const {error} = await sb.from("verkostungen").update({status: s}).eq("id", v.id); if(error){ toast(fehlertext(error)); return; } toast({laeuft:"Verkostung läuft",abgeschlossen:"Abgeschlossen – Ergebnis ist aufgedeckt",vorbereitung:"Zurück in Vorbereitung"}[s]); detailLaden(); };
  $("#stStart") && ($("#stStart").onclick = () => setStatus("laeuft"));
  $("#stEnde") && ($("#stEnde").onclick = () => bestaetigen("Verkostung abschließen?", "Danach kann niemand mehr bewerten, und das Ergebnis erscheint öffentlich in der Liga und bei den Verkostungen.", "Abschließen", () => setStatus("abgeschlossen")));
  $("#stWieder") && ($("#stWieder").onclick = () => bestaetigen("Wieder öffnen?", "Die Gäste können dann wieder bewerten. Das Ergebnis verschwindet so lange aus der öffentlichen Liga.", "Wieder öffnen", () => setStatus("laeuft")));
  $("#vkEdit").onclick = () => vkForm(v);
  $("#zfBtn") && ($("#zfBtn").onclick = async () => {
    const btn = $("#zfBtn"); btn.disabled = true; btn.textContent = "Wird erstellt …";
    const { data, error } = await sb.functions.invoke("verkostung-zusammenfassen", { body: { verkostung_id: v.id } });
    if (error || data?.fehler) { toast((error ? fehlertext(error) : data.fehler) || "Zusammenfassung fehlgeschlagen."); btn.disabled = false; btn.textContent = "Zusammenfassungen erstellen"; return; }
    toast(data?.anzahl ? `${data.anzahl} Zusammenfassung${data.anzahl===1?"":"en"} erstellt` : (data?.hinweis || "Keine Kommentare zum Zusammenfassen."));
    detailLaden();
  });
  $("#vkDel") && ($("#vkDel").onclick = () => bestaetigen("Verkostung löschen?", `„${v.titel}“ mit allen ${bewertungen.length} Bewertungen wird endgültig gelöscht. Die Biere selbst bleiben erhalten.`, "Endgültig löschen", async () => {
    const {data, error} = await sb.from("verkostungen").delete().eq("id", v.id).select("id");
    if(error || !data?.length){ toast(error ? fehlertext(error) : "Löschen ist nur dem Admin erlaubt."); return; }
    await Promise.all([v.bild_titel, ...D.galerie.map(g=>g.pfad)].filter(Boolean).map(p => Bilder.loeschen(p)));
    location.href = "verkostung.html";
  }, true));
  $("#qrGross").onclick = () => {
    sheet(v.titel, `<div class="qr gross">${QR.svg(link)}</div><p class="num linktext" style="text-align:center">${esc(link)}</p><p class="hint" style="text-align:center">Mit der Handykamera scannen und mitmachen.</p>`, `<span class="spacer"></span><button class="btn" id="qrZu">Schließen</button>`);
    $("#qrZu").onclick = closeSheet;
  };
  $("#copyLink").onclick = async () => { try{ await navigator.clipboard.writeText(link); toast("Link kopiert"); }catch(_){ toast("Kopieren ging nicht – bitte den Link markieren"); } };
  $("#addBier").onclick = () => bierWaehlen();
  Bilder.feldVerdrahten("titelFeld", {art:"frei", basis:`verkostungen/${v.id}/titel`, titel:"Titelbild", geaendert: async p => {
    const {error} = await sb.from("verkostungen").update({bild_titel: p}).eq("id", v.id);
    if(error){ toast(fehlertext(error)); return; }
    if(v.bild_titel && v.bild_titel !== p) Bilder.loeschen(v.bild_titel);
    v.bild_titel = p; toast(p ? "Titelbild gespeichert" : "Titelbild entfernt");
  }});
  const gal = main().querySelector(".galerie");
  if(gal) Bilder.galerieVerdrahten(gal, D.galerie.map(g=>g.pfad), i => {
    const g = D.galerie[i];
    bestaetigen("Foto löschen?", "Das Foto wird endgültig gelöscht.", "Löschen", async () => {
      const {error} = await sb.from("verkostung_bilder").delete().eq("id", g.id);
      if(error){ toast(fehlertext(error)); return; }
      await Bilder.loeschen(g.pfad); toast("Foto gelöscht"); detailLaden();
    }, true);
  });
  $("#fotoAdd").onclick = async () => {
    const erg = await Bilder.waehlen({form:"frei", titel:"Foto hinzufügen"}); if(!erg) return;
    try{
      const pfad = await Bilder.hochladen(`verkostungen/${v.id}/galerie/${crypto.randomUUID()}`, erg);
      const {error} = await sb.from("verkostung_bilder").insert({verkostung_id: v.id, pfad});
      if(error) throw error;
      toast("Foto hinzugefügt"); detailLaden();
    }catch(e){ toast("Hochladen fehlgeschlagen: " + fehlertext(e)); }
  };
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
    ${Bilder.bierFotos(p.bier)}
    ${p.zusammenfassung?sec("Zusammengefasst", `<p class="zusammenfassung">${esc(p.zusammenfassung)}</p>`):""}
    <div class="stats mini"><div class="stat"><b class="num">${note(a.schnitt)}</b><span>Ø Gesamtnote</span></div><div class="stat"><b class="num">${a.anzahl}</b><span>Bewertungen</span></div><div class="stat"><b class="num">${a.anzahl?Math.round(a.nochmal/a.anzahl*100):0} %</b><span>würden nochmal</span></div></div>
    ${sec("Geschmacksprofil", profil)}
    ${sec("Geruch", zaehle("geruch"))}
    ${sec("Fehlaromen", zaehle("fehler"))}
    ${sec("Einzelne Bewertungen", alle.length ? `<div class="bw">${alle.map(b=>`<div class="bw-row${b.ausgeblendet?" aus":""}">
      <span class="grade">${b.note}</span>
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

/* Bier zur Verkostung hinzufügen: aus der Bierliste wählen oder neu anlegen */
async function bierWaehlen(){
  const {data, error} = await sb.from("biere").select("id,name,brauerei,eigen,alkohol,bild_kronkorken,bild_flasche,bierstile(name)").order("name");
  if(error){ toast(fehlertext(error)); return; }
  const schon = new Set(D.proben.map(p=>p.bier_id));
  const liste = (data||[]).filter(b=>!schon.has(b.id));
  const zeile = b => `<button class="pick" data-b="${esc(b.id)}" data-s="${esc((b.name+" "+(b.brauerei||"")+" "+(b.bierstile?.name||"")).toLowerCase())}">${Bilder.bier({...b, stil:b.bierstile?.name})}<span><b>${esc(b.name)}</b><small>${esc(bierZeile({...b, stil:b.bierstile?.name}))}</small></span></button>`;
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
  const b = bier || {name: vorgabe.name||"", brauerei: vorgabe.brauerei||"", eigen: false, stil_id: (stile.find(s=>s.name.toLowerCase()===(vorgabe.stilName||"").toLowerCase())||{}).id ?? null, alkohol: null, sud_id: null, notiz: "", bild_kronkorken: null, bild_flasche: null};
  const bildBasis = `biere/${bier?.id || "neu-" + crypto.randomUUID()}`;
  const bierVorschau = {name: b.name, stil: (stile.find(s=>s.id===b.stil_id)||{}).name};
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
      <div class="grid2 bildfelder">
        ${Bilder.feldHtml("bi_kk", b.bild_kronkorken, {art:"rund", bier:bierVorschau, beschriftung:"Kronkorken"})}
        ${Bilder.feldHtml("bi_fl", b.bild_flasche, {art:"hoch", bier:bierVorschau, beschriftung:"Flasche"})}
      </div>
      <p class="hint">Beide Bilder sind freiwillig. Gibt es nur eins, wird es überall gezeigt.</p>
      <label class="f" for="bi_notiz">Notiz (intern)<textarea id="bi_notiz" maxlength="1000">${esc(b.notiz||"")}</textarea></label>
      <span class="err" id="biErr"></span>
    </form>`,
    `<span class="spacer"></span><button class="btn" id="biAbbr">Abbrechen</button><button class="btn primary" id="biSave" form="bierForm" type="submit">${bier?"Speichern":D&&!nachher?"Anlegen und hinzufügen":"Anlegen"}</button>`);
  const fKK = Bilder.feldVerdrahten("bi_kk", {art:"rund", basis:bildBasis+"/kronkorken", titel:"Kronkorken", bier:bierVorschau});
  const fFL = Bilder.feldVerdrahten("bi_fl", {art:"hoch", basis:bildBasis+"/flasche", titel:"Flasche", bier:bierVorschau});
  $("#biAbbr").onclick = closeSheet;
  $("#bi_eigen").onchange = () => { $("#sudWrap").hidden = !$("#bi_eigen").checked; if($("#bi_eigen").checked && !$("#bi_br").value.trim()) $("#bi_br").value = "Koldingbräu"; };
  $("#bi_stil").onchange = () => { $("#neuStilWrap").hidden = $("#bi_stil").value !== "neu"; };
  $("#bierForm").onsubmit = async e => { e.preventDefault();
    const err = $("#biErr"), alk = $("#bi_alk").value;
    const out = {name: $("#bi_name").value.trim(), brauerei: $("#bi_br").value.trim() || null, eigen: $("#bi_eigen").checked,
      alkohol: alk === "" ? null : +alk, sud_id: $("#bi_eigen").checked ? ($("#bi_sud").value || null) : null, notiz: $("#bi_notiz").value.trim() || null,
      bild_kronkorken: fKK.wert(), bild_flasche: fFL.wert()};
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
    if(bier) for(const k of ["bild_kronkorken","bild_flasche"]) if(bier[k] && bier[k] !== out[k]) Bilder.loeschen(bier[k]);
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
  const {data, error} = await sb.from("biere").select("id,name,brauerei,eigen,alkohol,stil_id,sud_id,notiz,bild_kronkorken,bild_flasche,bierstile(name),proben(count)").order("name");
  if(error){ toast(fehlertext(error)); return; }
  sheet("Biere", `<p class="hint">Jedes Bier gibt es nur einmal – so zählen seine Bewertungen aus allen Verkostungen zusammen in der Liga.</p>
    ${data.length ? `<div class="picklist">${data.map(b=>`<div class="pick row">${Bilder.bier({...b, stil:b.bierstile?.name})}<span class="pt"><b>${esc(b.name)}</b><small>${esc(bierZeile({...b, stil:b.bierstile?.name}))} · ${b.proben[0]?.count||0} Verkostungen</small></span>
      <span><button class="btn ghost" data-ed="${esc(b.id)}">Bearbeiten</button>${isAdmin()?`<button class="btn ghost danger" data-del="${esc(b.id)}">Löschen</button>`:""}</span></div>`).join("")}</div>` : `<p class="hint">Noch keine Biere. Biere legst du direkt in einer Verkostung an.</p>`}`,
    `<span class="spacer"></span><button class="btn" id="kZu">Schließen</button>`);
  $("#kZu").onclick = closeSheet;
  $("#sheetBody").querySelectorAll("[data-ed]").forEach(btn => btn.onclick = () => bierForm(data.find(b=>b.id===btn.dataset.ed), {}, bierKatalog));
  $("#sheetBody").querySelectorAll("[data-del]").forEach(btn => btn.onclick = () => {
    const b = data.find(x=>x.id===btn.dataset.del);
    if(b.proben[0]?.count){ toast("Das Bier ist in einer Verkostung – erst dort herausnehmen."); return; }
    bestaetigen(`„${b.name}“ löschen?`, "Das Bier wird endgültig aus dem Katalog und der Liga entfernt.", "Endgültig löschen", async () => {
      const r = await sb.from("biere").delete().eq("id", b.id).select("id");
      if(r.error || !r.data?.length){ toast(r.error ? fehlertext(r.error) : "Löschen ist nur dem Admin erlaubt."); return; }
      await Promise.all(["bild_kronkorken","bild_flasche"].map(k => b[k] && Bilder.loeschen(b[k])));
      toast("Bier gelöscht"); bierKatalog();
    }, true);
  });
}

