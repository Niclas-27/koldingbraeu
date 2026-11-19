/* Koldingbräu – Verkostungen: Gäste-Ansicht (?v=<code>): beitreten, bewerten, Live-Zwischenstand, Biere vorschlagen */
"use strict";
const gastKey = () => "kb_gast_"+code;
function gast(){ try{ return JSON.parse(lsGet(gastKey())||"null"); }catch(_){ return null; } }
let gData = null;
const MAX_FOTOS = 9; // muss zu MAX_BILDER in supabase/functions/galerie-hochladen passen (bis 10.11.2026: 3)
// Persönlicher Zugangslink (…?v=<code>&t=<schlüssel>, siehe zugangsLink in common.js): Schlüssel übernehmen und aus
// der Adresszeile entfernen, damit er nicht in Lesezeichen/Verlauf landet.
(function zugangUebernehmen(){
  try{
    const u = new URL(location.href), t = u.searchParams.get("t");
    if(!t || !/^[0-9a-f-]{36}$/i.test(t) || !u.searchParams.get("v")) return;
    lsSet("kb_gast_"+u.searchParams.get("v").trim().toLowerCase(), JSON.stringify({token: t}));
    u.searchParams.delete("t"); history.replaceState(null, "", u.pathname + u.search + u.hash);
  }catch(_){}
})();

async function gastLaden(still){
  const g = gast();
  const {data, error} = await sb.rpc("vk_laden", {p_code: code, p_token: g ? g.token : null});
  if(error){ stopTimer(); main().innerHTML = `<div class="vk-head"><h2>Verkostung</h2></div><p class="empty">${esc(fehlertext(error))}</p><p class="empty"><a href="verkostung.html">Zur Übersicht</a></p>`; return; }
  if(g && !data.ich){ lsSet(gastKey(), null); eigeneGespeichert.clear(); }   // Schlüssel passt nicht (mehr) – neu beitreten
  gData = data;
  // Aufgedeckt: alle springen von selbst auf die volle Ergebnisseite (Rangliste, Bier antippen → Details). Die eigenen
  // Noten nehmen wir je Bier mit, damit die Ergebnisseite „deine Note“ zeigen kann (schema/15 liefert dafür id + bier_id).
  if(data.verkostung.status === "abgeschlossen" && data.verkostung.id){
    stopTimer();
    const bierVon = new Map(data.proben.map(p => [p.id, p.bier_id]));
    const meine = {}; (data.ich?.bewertungen||[]).forEach(b => { const id = bierVon.get(b.probe_id); if(id) meine[id] = b.note; });
    if(Object.keys(meine).length) lsSet("kb_meine_"+data.verkostung.id, JSON.stringify(meine));
    // … und die eigene Lage auf der Geschmackskarte ([suesse, bitter]) für den grünen Punkt in der Punktwolke
    const meineK = {}; (data.ich?.bewertungen||[]).forEach(b => { const id = bierVon.get(b.probe_id), m = b.merkmale || {};
      if(id && typeof m.suesse === "number" && typeof m.bitter === "number") meineK[id] = [m.suesse, m.bitter]; });
    if(Object.keys(meineK).length) lsSet("kb_meine_k_"+data.verkostung.id, JSON.stringify(meineK));
    // Schlüssel für die Fotos vom Abend auf der Ergebnisseite (die kennt den Code nicht)
    if(data.ich && g) lsSet("kb_gast_e_"+data.verkostung.id, g.token);
    // „&ehrung=1“: die Ergebnisseite beginnt direkt nach dem Aufdecken mit der Siegerehrung (seit 14.11.2026)
    location.replace("verkostung.html?e="+encodeURIComponent(data.verkostung.id)+"&ehrung=1");
    return;
  }
  gastZeigen();
  if(data.verkostung.status !== "abgeschlossen") { if(!timer) startTimer(()=>gastLaden(true)); } else stopTimer();
}

function gastZeigen(){
  const d = gData, v = d.verkostung, ich = d.ich, offen = !v.blind || v.status === "abgeschlossen";
  const meine = ich ? meineBewertungen() : new Map();   // inkl. eben gespeicherter, auch wenn gData noch alt ist
  let h = `<div class="vk-head">
      <div><p class="kicker">Verkostung</p><h2>${esc(v.titel)}</h2>
      <p class="hint">${esc([fmtDateLong(v.datum), v.ort].filter(Boolean).join(" · "))}${v.blind?" · blind":""} · ${d.teilnehmer} Teilnehmer</p></div>
      ${statusTag(v.status)}
    </div>${v.bild_titel?`<img class="titelbild" src="${esc(Bilder.url(v.bild_titel))}" alt="Titelbild der Verkostung">`:""}`;

  // Mitmachen erst, wenn die Verkostung läuft (seit 07.11.2026; serverseitig über vk_beitreten, schema/13 Teil B)
  // Seit 19.11.2026 als Einladung: erst was wartet, dann die eine Frage, Knopf über die volle Breite, der Hinweis zum
  // Namen kurz darunter statt fünf Zeilen vor dem Feld.
  if(!ich && v.status === "laeuft"){
    const n = d.proben.length, t = d.teilnehmer || 0;
    const titel = n > 1 ? `${n} Biere warten auf dich` : n === 1 ? "Ein Bier wartet auf dich" : "Mach mit";
    h += `<form id="joinForm" class="vk-card stack mitmachen" novalidate>
        <div><h3>${titel}</h3>${t ? `<p class="hint">${t === 1 ? "Eine Person ist" : t + " sind"} schon dabei.</p>` : ""}</div>
        <label class="f" for="j_name">Wie heißt du?<input id="j_name" maxlength="40" autocomplete="given-name" placeholder="Vorname oder Spitzname" required></label>
        <span class="err" id="joinErr"></span>
        <button class="btn primary" type="submit" id="joinBtn">Mitmachen</button>
        <p class="hint mm-klein">Kein Konto nötig. Dein Name gilt nur für diesen Abend und steht nach dem Abschluss in der Teilnehmerliste; deine Kommentare erscheinen dort ohne Namen.</p>
      </form>`;
  } else if(ich){
    h += `<p class="hint">Du bist dabei als <b>${esc(ich.name)}</b>. <button class="linkbtn" id="notMe">Nicht du?</button></p>`;
  }

  if(v.status === "vorbereitung"){
    h += `<div class="vk-card"><h3>Bald geht’s los</h3><p class="hint">Sobald die Braumeister die Verkostung starten, kannst du hier mitmachen und die Biere bewerten. Die Seite aktualisiert sich von selbst.</p>
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
        <span class="pg">${m?`<span class="vh">deine Note </span><span class="grade ${gradeCls(m.note)}">${m.note}</span><span class="aendern" aria-hidden="true">ändern</span>`
          : entwurfDa(p.id) ? "weitermachen" : "bewerten"}</span>
      </button>`;}).join("")}</div>${fertig && fertig === d.proben.length
        ? `<p class="hint alle-bewertet">Alle bewertet – wenn die Braumeister aufdecken, springt diese Seite von selbst zur Siegerehrung.</p>` : ""}`);
  }

  // Zwischenstand erst nach dem Aufdecken: ein Live-Ranking beeinflusst die eigene Bewertung. Die Noten
  // kommen seit schema/12 für Gäste auch gar nicht mehr vorher aus der Datenbank.
  if(v.status === "abgeschlossen" && d.proben.length){
    const zeilen = d.proben.map(p=>({id:p.id, nummer:p.nummer, titel: offen ? p.bier.name : "Probe "+p.nummer,
      unter: offen ? bierZeile(p.bier) : "", schnitt:p.schnitt, anzahl:p.anzahl, nochmal:p.nochmal, bild: offen ? Bilder.bier(p.bier) : ""}));
    h += sec("Ergebnis", rangTabelle(zeilen));
  }
  if(v.status === "abgeschlossen" && !ich) h += `<p class="hint">Diese Verkostung ist abgeschlossen.</p>`;
  // Fotos vom Abend: hochladen (max. MAX_FOTOS) und – seit 10.11.2026 – alle Fotos sehen, nur für Teilnehmer.
  const darf = ich && v.status !== "abgeschlossen" && (ich.bilder||0) < MAX_FOTOS;
  const kannLoeschen = ich && v.status !== "abgeschlossen" && (ich.bilder||0) > 0;
  const ggAnfrage = ich ? {code, token: gast().token} : null;
  if(ich && v.status !== "abgeschlossen") h += sec("Fotos vom Abend", (darf
      ? `<button type="button" class="btn foto-knopf" id="fotoBtn">${fotoKnopfHtml(ich.bilder||0)}</button><span class="err" id="fotoErr"></span><p class="hint foto-hinweis">Nur Fotos, mit denen alle Abgebildeten einverstanden sind.</p>`
      : `<p class="hint">Du hast alle ${MAX_FOTOS} Fotos hochgeladen – danke!</p>`)
      + (kannLoeschen ? `<button type="button" class="linkbtn" id="fotoLoeschBtn">Zuletzt hochgeladenes Foto entfernen</button><span class="err" id="fotoLoeschErr"></span>` : "")
      + `<div id="gastGalerie">${(() => { const c = gastGalerieAusCache(ggAnfrage); return c ? gastGalerieHtml(c) : `<p class="hint">Fotos werden geladen …</p>`; })()}</div>`);
  main().innerHTML = h;
  if(ggAnfrage && v.status !== "abgeschlossen") galerieAuffrischen(ggAnfrage, false);

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
  // Seit 19.11.2026 mit Rückfrage: Austragen nimmt dem Handy den Schlüssel – die eigenen Bewertungen sind hier danach
  // nicht mehr zu sehen, und wer neu beitritt, wird ein zweiter Teilnehmer.
  const nm = $("#notMe");
  if(nm) nm.onclick = () => bestaetigen(`Du bist nicht ${ich.name}?`,
    `Dann trägst du dich auf diesem Handy aus und kannst mit deinem eigenen Namen mitmachen. Die Bewertungen von ${ich.name} bleiben gespeichert, sind hier aber nicht mehr zu sehen.`,
    "Ja, austragen", () => { entwuerfeLoeschen(); eigeneGespeichert.clear(); lsSet(gastKey(), null); gastLaden(); });
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

/* Entwürfe des Bewertungsbogens (bogenZeigen, form.js) hängen am Schlüssel des Gastes – ein anderer Gast auf demselben
   Handy sieht sie also nie. Beim Austragen werden sie mit entfernt. */
const entwurfPrefix = () => { const g = gast(); return g ? "kb_entwurf_"+g.token+"_" : null; };
// Angefangener, noch nicht gespeicherter Bogen: in der Liste „weitermachen“ statt „bewerten“ (seit 19.11.2026)
const entwurfDa = probeId => { const pre = entwurfPrefix(); return !!(pre && lsGet(pre + probeId)); };
function entwuerfeLoeschen(){
  const pre = entwurfPrefix(); if(!pre) return;
  try{ Object.keys(localStorage).filter(k => k.startsWith(pre)).forEach(k => localStorage.removeItem(k)); }catch(_){}
}

/* Eben gespeicherte Bewertungen dieses Gastes, gemerkt bis zum Verlassen der Seite (seit 19.11.2026).
   Nach dem Speichern lädt gastLaden() den Stand neu – „Weiter zu …“ öffnet das nächste Bier aber sofort. Bei langsamem
   Netz war gData dann noch alt: Ein gerade bewertetes Bier galt als offen, und nach dem letzten Bier sprang der Bogen
   zurück zu einem schon bewerteten statt zum Abschluss. Darum zählen hier immer auch die lokal gespeicherten mit. */
const eigeneGespeichert = new Map();
function meineBewertungen(){
  const m = new Map((gData?.ich?.bewertungen||[]).map(b => [b.probe_id, b]));
  eigeneGespeichert.forEach((b, id) => m.set(id, b));
  return m;
}

// Abschlussansicht (seit 19.11.2026): jede Note dort antippen öffnet das Bier direkt auf „Dein Urteil“ – der Text sagt
// ja „Bis dahin kannst du jede Note noch ändern“. Ein Fänger für die ganze Seite, weil die Ansicht im Blatt entsteht.
document.addEventListener("click", e => { const z = e.target.closest(".ende-noten .en-zeile[data-p]"); if(z) bogen(z.dataset.p); });

function bogen(probeId){
  const d = gData, p = d.proben.find(x=>x.id===probeId); if(!p) return;
  const offen = !d.verkostung.blind || d.verkostung.status === "abgeschlossen";
  const pre = entwurfPrefix();
  bogenZeigen({
    entwurf: pre ? pre + probeId : null,
    titel: offen ? `${p.nummer}. ${p.bier.name}` : `Probe ${p.nummer}`,
    hint: offen ? bierZeile(p.bier) : "",
    alt: meineBewertungen().get(probeId) || {},
    startAmUrteil: meineBewertungen().has(probeId),   // schon bewertet: zum Ändern gleich die Note zeigen
    speichern: async f => {
      const r = await sb.rpc("vk_bewerten", {p_code: code, p_token: gast().token, p_probe: probeId, ...f});
      if(!r.error) eigeneGespeichert.set(probeId, {probe_id: probeId, note: f.p_note, merkmale: f.p_merkmale, geruch: f.p_geruch,
        fehler: f.p_fehler, nochmal: f.p_nochmal, kommentar: f.p_kommentar});
      return r;
    },
    fertig: () => gastLaden(),
    geschlossen: () => { if(gData && $(".proben")) gastZeigen(); },   // Liste zeigt angefangene Entwürfe sofort als „weitermachen“
    // Nach dem Speichern „Weiter zu Probe X“: das nächste noch nicht bewertete Bier (in Reihenfolge, danach von vorn)
    naechste: () => {
      const bewertet = new Set(meineBewertungen().keys()); bewertet.add(probeId);
      const sortiert = d.proben.slice().sort((a,b)=>a.nummer-b.nummer), i = sortiert.findIndex(x=>x.id===probeId);
      const n = [...sortiert.slice(i+1), ...sortiert.slice(0,i)].find(x=>!bewertet.has(x.id));
      return n ? {label: offen ? `Weiter zu ${n.nummer}. ${n.bier.name}` : `Weiter zu Probe ${n.nummer}`, oeffnen: () => bogen(n.id)} : null;
    },
    // Alle Biere bewertet (seit 19.11.2026): Kronkorken-Reihe, die eigenen Noten und was als Nächstes passiert –
    // vorher schloss sich das Blatt nur mit einem Toast, und Gäste wussten nicht, ob sie fertig sind.
    // Nach dem Speichern, wenn noch Biere offen sind (seit 19.11.2026): „1 von 3 bewertet“ als Kronkorken-Reihe – bewertete
    // Kronkorken voll, offene blass, der eben bewertete landet. Darunter die eigene Note in der Notenampel-Farbe.
    zwischenstand: note => {
      const bewertet = new Set(meineBewertungen().keys()); bewertet.add(probeId);
      const sortiert = d.proben.slice().sort((a,b)=>a.nummer-b.nummer);
      return `<div class="bogen-zwischen">
        <div class="zw-reihe" aria-hidden="true">${sortiert.map(x => `<span class="zw-deckel${bewertet.has(x.id) ? " an" : ""}${x.id === probeId ? " neu" : ""}">${offen ? Bilder.bier(x.bier) : `<span class="pn num">${x.nummer}</span>`}</span>`).join("")}</div>
        <h3>${bewertet.size} von ${sortiert.length} bewertet</h3>
        <p class="hint">Deine Note für ${offen ? esc(p.bier.name) : "Probe "+p.nummer}: <span class="grade ${gradeCls(note)}">${note}</span></p>
      </div>`;
    },
    abschlussTitel: d.verkostung.titel,
    abschluss: note => {
      const noten = new Map([...meineBewertungen()].map(([id, b]) => [id, b.note])); noten.set(probeId, note);
      const sortiert = d.proben.slice().sort((a,b)=>a.nummer-b.nummer);
      const name = x => offen ? `${x.nummer}. ${esc(x.bier.name)}` : "Probe "+x.nummer;
      return `<div class="bogen-ende">
        <div class="ende-reihe" aria-hidden="true">${sortiert.map((x,i)=>`<span class="ende-deckel" style="--i:${i}">${offen ? Bilder.bier(x.bier) : `<span class="pn num">${x.nummer}</span>`}</span>`).join("")}</div>
        <h3>${sortiert.length === 1 ? "Bewertet" : `Alle ${sortiert.length} bewertet`} – prost!</h3>
        <ul class="ende-noten">${sortiert.map(x=>{ const n = noten.get(x.id);
          return `<li><button type="button" class="en-zeile" data-p="${esc(x.id)}" aria-label="${name(x)}, deine Note ${n ?? '–'}, ändern"><span class="en-name">${name(x)}</span>${n == null ? "" : `<span class="en-rechts"><span class="grade ${gradeCls(n)}">${n}</span><span class="aendern" aria-hidden="true">ändern</span></span>`}</button></li>`; }).join("")}</ul>
        <p class="hint">Wenn die Braumeister aufdecken, springt diese Seite von selbst zur Siegerehrung. Lass sie einfach offen. Bis dahin kannst du jede Note noch ändern.</p>
      </div>`;
    },
  });
}

async function bmHinweis(){
  const {data} = await sb.from("verkostungen").select("id").eq("code", code).maybeSingle();
  if(data){ const n = $("#notice"); n.hidden = false; n.innerHTML = `Du bist als Braumeister angemeldet. <a href="verkostung.html?id=${esc(data.id)}">Zur Verwaltung dieser Verkostung</a>`; }
}

/* Galerie in der Gästeansicht nachladen (höchstens einmal pro Minute, nach eigenem Hochladen/Löschen sofort) */
async function galerieAuffrischen(anfrage, erzwingen){
  const d = await gastGalerieLaden(anfrage, erzwingen), box = $("#gastGalerie");
  if(!box) return;
  if(!d){ box.innerHTML = `<p class="hint">Die Fotos konnten gerade nicht geladen werden.</p>`; return; }
  box.innerHTML = gastGalerieHtml(d); gastGalerieVerdrahten(box, d);
}

/* Gast lädt ein Foto für die Galerie hoch – über die Edge Function „galerie-hochladen“ (prüft Code, Schlüssel, max. 9).
   Seit 10.11.2026 ohne den zweiten Zuschnitt-Schritt (Vorschau-Quadrat wird mittig gesetzt). */
/* Foto-Knopf (seit 19.11.2026 ein richtiger Knopf mit Kamera statt „+ Foto hinzufügen“ gestrichelt): Fotos gehören zum
   Ritual und sollen nicht wie Kleingedrucktes aussehen. Der Hinweis, wer die Fotos sieht, steht jetzt im Auswahl-Dialog. */
const KAMERA_SVG = `<svg class="kamera" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3.5 8.5a2 2 0 0 1 2-2h2.2l1.5-2h5.6l1.5 2h2.2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.8" r="3.6"/></svg>`;
const fotoKnopfHtml = n => `${KAMERA_SVG}<span>Foto hinzufügen</span><small class="foto-zahl">${n} von ${MAX_FOTOS}</small>`;

async function gastFoto(){
  const erg = await Bilder.waehlen({form: "frei", titel: "Foto vom Abend", ohneVorschau: true,
    hinweis: "Sehen können das Foto nur die Teilnehmer dieser Verkostung und die Braumeister."});
  if(!erg) return;
  const btn = $("#fotoBtn"), err = $("#fotoErr");
  btn.disabled = true; btn.innerHTML = `${KAMERA_SVG}<span>Wird hochgeladen …</span>`; err.textContent = "";
  const fd = new FormData();
  fd.append("code", code); fd.append("token", gast().token);
  fd.append("gross", erg.gross, "foto.jpg"); fd.append("klein", erg.klein, "foto_t.jpg");
  // Für „Ausschnitt ändern“ durch die Braumeister: Zuschnitt + (nur wenn wirklich beschnitten) das ganze Foto.
  fd.append("ausschnitt", JSON.stringify(erg.ausschnitt));
  const r = erg.ausschnitt.rahmen, ganz = r.x < 0.002 && r.y < 0.002 && r.w > 0.998 && r.h > 0.998;
  if(erg.basis && !ganz) fd.append("basis", erg.basis, "foto_b.jpg");
  const {error} = await sb.functions.invoke("galerie-hochladen", {body: fd});
  if(error){
    let msg = "Hochladen fehlgeschlagen."; try{ const j = await error.context.json(); if(j && j.fehler) msg = j.fehler; }catch(_){}
    btn.disabled = false; btn.innerHTML = fotoKnopfHtml(gData?.ich?.bilder || 0); err.textContent = msg; return;
  }
  toast("Foto hochgeladen"); await gastGalerieLaden({code, token: gast().token}, true); gastLaden();
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
  toast("Foto entfernt"); await gastGalerieLaden({code, token: gast().token}, true); gastLaden();
}
