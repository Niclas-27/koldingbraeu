/* Koldingbräu – Rezepte: Rezept anlegen und bearbeiten
   Zutaten sind Freitext mit Werten; Vorschläge kommen aus allen bisherigen Rezepten und Suden. */
"use strict";
let rDraft = null, rEditId = null, vorschlaege = null;

async function ladeVorschlaege(){
  if(vorschlaege) return vorschlaege;
  const [rz, sd, st] = await Promise.all([
    sb.from("rezepte").select("malze,hopfen,hefe,stil"),
    sb.from("sude").select("malz,hopfen,hefe"),
    sb.from("bierstile").select("name").order("reihenfolge"),
  ]);
  const malz = new Map(), hopfen = new Set(), hefe = new Set(), stile = new Set((st.data || []).map(s => s.name));
  (rz.data || []).forEach(r => { (r.malze || []).forEach(m => m.name && malz.set(m.name, m.ebc ?? malz.get(m.name) ?? null)); (r.hopfen || []).forEach(h => h.sorte && hopfen.add(h.sorte)); r.hefe && hefe.add(r.hefe); r.stil && stile.add(r.stil); });
  (sd.data || []).forEach(s => { (s.malz || []).forEach(m => m.sorte && !malz.has(m.sorte) && malz.set(m.sorte, m.ebc ?? null)); (s.hopfen || []).forEach(h => h.sorte && hopfen.add(h.sorte)); s.hefe && hefe.add(s.hefe); });
  vorschlaege = { malz, hopfen: [...hopfen].sort(), hefe: [...hefe].sort(), stile: [...stile] };
  return vorschlaege;
}
const leer = () => ({ name: "", stil: "", autor: "Koldingbräu", quelle: "eigenes Rezept", beschreibung: "", anmerkung: "", ausschlag: anlage?.standard_menge || 20,
  sudhausausbeute: anlage?.sudhausausbeute || null, stammwuerze: null, bittere: null, farbe: null, alkohol: null,
  malze: [{name: "", gramm: null, ebc: null}], maischform: "infusion", hauptguss: null, nachguss: null, einmaischtemperatur: null, abmaischtemperatur: 78,
  rasten: [{temperatur: null, zeit: null}], kochzeit: 60, hopfen: [{sorte: "", gramm: null, alpha: null, zeit: 60, typ: "Kochen"}], weitere: [],
  hefe: "", gaertemperatur: "", endvergaerungsgrad: null, karbonisierung: null, oeffentlich: false });

async function rezeptForm(r){
  const v = await ladeVorschlaege();
  rDraft = JSON.parse(JSON.stringify(r || leer()));
  rEditId = r ? r.id : null;
  ["malze", "rasten", "hopfen", "weitere"].forEach(k => { if(!Array.isArray(rDraft[k])) rDraft[k] = []; });
  $("#sheetTitle").textContent = r ? "Rezept bearbeiten" : "Neues Rezept";
  rFormZeichnen(v);
  $("#sheetFoot").innerHTML = `<span class="err" id="rzErr"></span><span class="spacer"></span><button class="btn" id="rzAbbr">Abbrechen</button><button class="btn primary" id="rzSave">${r ? "Speichern" : "Anlegen"}</button>`;
  $("#rzAbbr").onclick = closeSheet;
  $("#rzSave").onclick = rSpeichern;
  KB.openSheet(); $("#sheetBody").scrollTop = 0;
}

function rFormZeichnen(v){
  v = v || vorschlaege;
  const d = rDraft, fs = (t, inner) => `<fieldset><legend>${t}</legend>${inner}</fieldset>`;
  const inp = (k, label, typ, extra) => `<label class="f" for="r_${k}">${label}<input id="r_${k}" data-k="${k}"${typ === "number" ? ' type="number" step="any" inputmode="decimal"' : ""} value="${esc(d[k] ?? "")}"${extra || ""}></label>`;
  const typSel = (i, t) => `<select data-l="hopfen" data-i="${i}" data-f="typ" aria-label="Art der Hopfengabe">${Object.entries(TYP_LABEL).map(([k, l]) => `<option value="${k}"${t === k ? " selected" : ""}>${l}</option>`).join("")}</select>`;
  const zelle = (l, i, f, val, ph, num, list) => `<input data-l="${l}" data-i="${i}" data-f="${f}" placeholder="${ph}" aria-label="${ph}" value="${esc(val ?? "")}"${num ? ' type="number" step="any" inputmode="decimal"' : ""}${list ? ` list="${list}"` : ""}>`;
  const weg = (l, i) => `<button type="button" class="x" data-weg="${l}" data-i="${i}" aria-label="Zeile entfernen">✕</button>`;
  $("#sheetBody").innerHTML = `<form id="rzForm" novalidate>
    <datalist id="dl_malz">${[...v.malz.keys()].sort().map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    <datalist id="dl_hopfen">${v.hopfen.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    <datalist id="dl_hefe">${v.hefe.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    <datalist id="dl_stil">${v.stile.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    ${fs("Grunddaten", `<div class="grid2">${inp("name", "Name *")}${inp("stil", "Bierstil", "", ' list="dl_stil"')}${inp("autor", "Autor")}${inp("quelle", "Quelle")}</div>
      <label class="f" for="r_beschreibung">Kurzbeschreibung<textarea id="r_beschreibung" data-k="beschreibung" maxlength="4000">${esc(d.beschreibung || "")}</textarea></label>
      <label class="check"><input type="checkbox" id="r_oeffentlich"${d.oeffentlich ? " checked" : ""}><span><b>Öffentlich zeigen</b><br><span class="hint">Dann sehen auch Gäste dieses Rezept.</span></span></label>`)}
    ${fs("Bezug und Kennwerte", `<div class="grid2">${inp("ausschlag", "Für Liter Ausschlagwürze *", "number")}${inp("sudhausausbeute", "Sudhausausbeute (%)", "number")}
      ${inp("stammwuerze", "Stammwürze (°P)", "number")}${inp("bittere", "Bittere (IBU)", "number")}${inp("farbe", "Farbe (EBC)", "number")}${inp("alkohol", "Alkohol (% Vol.)", "number")}</div>
      <button type="button" class="add" id="berechnen">Kennwerte aus den Zutaten berechnen</button><span class="hint" id="berechnetInfo"></span>`)}
    ${fs("Schüttung", `<div class="rowlist rz3" id="rl_malze">${d.malze.map((m, i) => `<div class="r">${zelle("malze", i, "name", m.name, "Malz", false, "dl_malz")}${zelle("malze", i, "gramm", m.gramm, "Gramm", true)}${zelle("malze", i, "ebc", m.ebc, "EBC", true)}${weg("malze", i)}</div>`).join("")}</div>
      <button type="button" class="add" data-neu="malze">+ Malz</button>`)}
    ${fs("Wasser und Maischen", `<div class="grid2">${inp("hauptguss", "Hauptguss (l)", "number")}${inp("nachguss", "Nachguss (l)", "number")}${inp("einmaischtemperatur", "Einmaischen (°C)", "number")}${inp("abmaischtemperatur", "Abmaischen (°C)", "number")}</div>
      <div class="rowlist rz2" id="rl_rasten">${d.rasten.map((x, i) => `<div class="r">${zelle("rasten", i, "temperatur", x.temperatur, `${i + 1}. Rast °C`, true)}${zelle("rasten", i, "zeit", x.zeit, "Minuten", true)}${weg("rasten", i)}</div>`).join("")}</div>
      <button type="button" class="add" data-neu="rasten">+ Rast</button>`)}
    ${fs("Hopfen", `${inp("kochzeit", "Kochzeit (min)", "number")}
      <div class="rowlist rz5" id="rl_hopfen">${d.hopfen.map((h, i) => `<div class="r">${zelle("hopfen", i, "sorte", h.sorte, "Sorte", false, "dl_hopfen")}${zelle("hopfen", i, "gramm", h.gramm, "Gramm", true)}${zelle("hopfen", i, "alpha", h.alpha, "% α", true)}${zelle("hopfen", i, "zeit", h.zeit, "min", true)}${typSel(i, h.typ)}${weg("hopfen", i)}</div>`).join("")}</div>
      <button type="button" class="add" data-neu="hopfen">+ Hopfengabe</button>
      <p class="hint">Zeit = Kochzeit der Gabe in Minuten. Stopfhopfen: Art „Stopfen“, Zeit leer lassen.</p>`)}
    ${fs("Weitere Zutaten", `<div class="rowlist rz4" id="rl_weitere">${d.weitere.map((w, i) => `<div class="r">${zelle("weitere", i, "name", w.name, "Zutat")}${zelle("weitere", i, "menge", w.menge, "Menge", true)}${zelle("weitere", i, "einheit", w.einheit, "Einheit")}${zelle("weitere", i, "zeitpunkt", w.zeitpunkt, "Wann?")}${weg("weitere", i)}</div>`).join("")}</div>
      <button type="button" class="add" data-neu="weitere">+ Zutat</button>`)}
    ${fs("Gärung", `<div class="grid2">${inp("hefe", "Hefe", "", ' list="dl_hefe"')}${inp("gaertemperatur", "Gärtemperatur (°C)")}${inp("endvergaerungsgrad", "Endvergärungsgrad (%)", "number")}${inp("karbonisierung", "Karbonisierung (g/l)", "number")}</div>`)}
    ${fs("Anmerkung", `<label class="f" for="r_anmerkung">Hinweise zum Brauen<textarea id="r_anmerkung" data-k="anmerkung" maxlength="8000">${esc(d.anmerkung || "")}</textarea></label>`)}
  </form>`;
  const f = $("#rzForm");
  f.onsubmit = e => { e.preventDefault(); rSpeichern(); };
  const neu = { malze: () => ({name: "", gramm: null, ebc: null}), rasten: () => ({temperatur: null, zeit: null}), hopfen: () => ({sorte: "", gramm: null, alpha: null, zeit: null, typ: "Kochen"}), weitere: () => ({name: "", menge: null, einheit: "g", zeitpunkt: ""}) };
  const neuZeichnen = () => { const top = $("#sheetBody").scrollTop; rFormZeichnen(); $("#sheetBody").scrollTop = top; };
  f.querySelectorAll("[data-neu]").forEach(b => b.onclick = () => { rSammeln(); rDraft[b.dataset.neu].push(neu[b.dataset.neu]()); neuZeichnen(); });
  f.querySelectorAll("[data-weg]").forEach(b => b.onclick = () => { rSammeln(); rDraft[b.dataset.weg].splice(+b.dataset.i, 1); neuZeichnen(); });
  // Malzfarbe vorschlagen, sobald ein Malzname eingetragen ist
  f.querySelectorAll('input[data-l="malze"][data-f="name"]').forEach(inp => inp.addEventListener("change", () => {
    const ebcFeld = f.querySelector(`input[data-l="malze"][data-i="${inp.dataset.i}"][data-f="ebc"]`);
    if(ebcFeld && ebcFeld.value === ""){ const e = vorschlaege.malz.get(inp.value) ?? B.malzEbc(inp.value); if(e != null) ebcFeld.value = e; }
  }));
  $("#berechnen").onclick = () => {
    rSammeln();
    const k = B.kennwerte(rDraft);
    const setze = (key, val, st) => { if(val != null && isFinite(val)){ rDraft[key] = B.runde(val, st); f.querySelector(`[data-k="${key}"]`).value = rDraft[key]; } };
    setze("stammwuerze", k.stammwuerze, 1); setze("bittere", k.bittere, 0); setze("farbe", k.farbe, 0); setze("alkohol", k.alkohol, 1);
    $("#berechnetInfo").textContent = k.stammwuerze == null ? " Für die Stammwürze fehlen Ausschlagwürze, Sudhausausbeute oder Malzmengen." : " Berechnet und eingetragen.";
  };
}

function rSammeln(){
  const f = $("#rzForm"); if(!f) return;
  const zahlFelder = ["ausschlag", "sudhausausbeute", "stammwuerze", "bittere", "farbe", "alkohol", "hauptguss", "nachguss", "einmaischtemperatur", "abmaischtemperatur", "kochzeit", "endvergaerungsgrad", "karbonisierung"];
  f.querySelectorAll("[data-k]").forEach(el => { const k = el.dataset.k; rDraft[k] = zahlFelder.includes(k) ? B.zahl(el.value) : el.value.trim(); });
  rDraft.oeffentlich = $("#r_oeffentlich").checked;
  f.querySelectorAll("[data-l]").forEach(el => {
    const l = el.dataset.l, i = +el.dataset.i, k = el.dataset.f;
    const num = el.type === "number";
    rDraft[l][i][k] = num ? B.zahl(el.value) : el.value.trim();
  });
}

async function rSpeichern(){
  rSammeln();
  const d = rDraft, err = $("#rzErr");
  if(!d.name){ err.textContent = "Bitte einen Namen eingeben."; $("#r_name")?.focus(); return; }
  if(!d.ausschlag || d.ausschlag <= 0){ err.textContent = "Bitte angeben, für wie viele Liter das Rezept gilt."; $("#r_ausschlag")?.focus(); return; }
  const out = {...d};
  out.malze = d.malze.filter(m => m.name || m.gramm);
  out.rasten = d.rasten.filter(x => x.temperatur != null || x.zeit != null);
  out.hopfen = d.hopfen.filter(h => h.sorte || h.gramm).map(h => ({...h, zeit: h.typ === "Stopfen" ? null : h.zeit}));
  out.weitere = d.weitere.filter(w => w.name);
  ["stil", "autor", "quelle", "beschreibung", "anmerkung", "hefe", "gaertemperatur", "maischform"].forEach(k => { if(out[k] === "") out[k] = null; });
  ["id", "angelegt", "angelegt_von", "geaendert", "geaendert_von"].forEach(k => delete out[k]);
  const btn = $("#rzSave"); btn.disabled = true; err.textContent = "";
  const q = rEditId ? sb.from("rezepte").update(out).eq("id", rEditId) : sb.from("rezepte").insert(out);
  const {data, error} = await q.select("id").single();
  if(error){ btn.disabled = false; err.textContent = fehlertext(error); return; }
  vorschlaege = null;
  closeSheet(); toast(rEditId ? "Gespeichert" : "Rezept angelegt");
  if(rEditId && rezeptId === rEditId){ sicht.alpha = {}; await detailLaden(); }
  else location.href = "rezepte.html?id=" + data.id;
}
