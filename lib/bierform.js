/* Koldingbräu – Biere anlegen, bearbeiten, suchen und filtern (seit 08.11.2026)
   Gemeinsam genutzt vom Bierkeller (bierkeller.html, features/cellar/) und vom Fenster „Bier hinzufügen“ einer
   Verkostung (features/tastings/admin.js). Braucht core/core.js (KB) und lib/bilder.js (Bilder).

   BierForm.laden()                 → Biere inkl. stil, verkostungen (Anzahl), letzte (Datum der letzten Verkostung)
   BierForm.filter(el, biere, zeichnen, {sortWahl}) → Suchfeld + Filter-Chips in el; ruft zeichnen(gefiltert) bei jeder Änderung
   BierForm.oeffnen(bier|null, {vorgabe, stile, knopf, gespeichert(id)}) → Formular im Seitenblatt
   BierForm.zeile(b)                → „Brauerei · Stil · 5,2 % Vol.“ */
(function (global) {
"use strict";
const { $, esc, fmtZahl, sheet, closeSheet, toast, fehlertext, isAdmin } = KB;
const sb = () => KB.sb;

const zeile = b => b ? [b.brauerei, b.stil, b.alkohol != null ? fmtZahl(b.alkohol, 1) + " % Vol." : ""].filter(Boolean).join(" · ") : "";

let stileCache = null;
async function stileLaden() {
  if (stileCache) return stileCache;
  const { data } = await sb().from("bierstile").select("id,name,reihenfolge").order("reihenfolge").order("name");
  stileCache = data || []; return stileCache;
}

/* Alle Biere mit „wie oft / wann zuletzt verkostet“. Ohne PostgREST-Aggregate (gesperrt): Proben laden und zählen. */
async function laden() {
  const [b, p] = await Promise.all([
    sb().from("biere").select("id,name,brauerei,eigen,alkohol,stil_id,sud_id,notiz,bild_kronkorken,bild_flasche,bierstile(name)").order("name"),
    sb().from("proben").select("bier_id,verkostungen(datum)"),
  ]);
  if (b.error) throw b.error;
  const info = new Map();
  (p.data || []).forEach(x => {
    const i = info.get(x.bier_id) || { n: 0, letzte: null };
    i.n++; const d = x.verkostungen?.datum || null;
    if (d && (!i.letzte || d > i.letzte)) i.letzte = d;
    info.set(x.bier_id, i);
  });
  return (b.data || []).map(x => ({ ...x, stil: x.bierstile?.name || null, verkostungen: info.get(x.id)?.n || 0, letzte: info.get(x.id)?.letzte || null }));
}

const sortierer = {
  letzte: (a, b) => (b.letzte || "").localeCompare(a.letzte || "") || a.name.localeCompare(b.name, "de"),
  name: (a, b) => a.name.localeCompare(b.name, "de"),
};

/* Suche + Filter. Zustand bleibt pro Seite im Speicher, damit erneutes Öffnen nicht von vorn beginnt. */
const merk = {};
function filter(el, biere, zeichnen, o = {}) {
  const key = o.merken || "standard";
  const f = merk[key] = merk[key] || { q: "", herkunft: "", stil: "", nie: false, sort: "letzte" };
  const stile = [...new Set(biere.map(b => b.stil).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));
  const chip = (wert, label, aktiv) => `<button type="button" class="chip${aktiv ? " on" : ""}" data-h="${wert}" aria-pressed="${aktiv}">${label}</button>`;
  el.innerHTML = `<input class="search" type="search" autocomplete="off" placeholder="Bier, Brauerei oder Stil suchen …" aria-label="Biere durchsuchen" value="${esc(f.q)}">
    <div class="bf-chips">
      ${chip("eigen", "Selbst gebraut", f.herkunft === "eigen")}${chip("fremd", "Gekauft", f.herkunft === "fremd")}
      <button type="button" class="chip${f.nie ? " on" : ""}" data-nie aria-pressed="${f.nie}">Noch nie verkostet</button>
      ${stile.length ? `<select class="bf-stil" aria-label="Nach Bierstil filtern"><option value="">Alle Stile</option>${stile.map(s => `<option${s === f.stil ? " selected" : ""}>${esc(s)}</option>`).join("")}</select>` : ""}
      ${o.sortWahl ? `<select class="bf-sort" aria-label="Sortierung"><option value="letzte"${f.sort === "letzte" ? " selected" : ""}>Zuletzt verkostet</option><option value="name"${f.sort === "name" ? " selected" : ""}>Name A–Z</option></select>` : ""}
    </div>`;
  const anwenden = () => {
    const q = f.q.trim().toLowerCase();
    const liste = biere.filter(b =>
      (!q || [b.name, b.brauerei, b.stil].filter(Boolean).join(" ").toLowerCase().includes(q)) &&
      (!f.herkunft || (f.herkunft === "eigen") === !!b.eigen) &&
      (!f.stil || b.stil === f.stil) &&
      (!f.nie || !b.verkostungen)).sort(sortierer[o.sortWahl ? f.sort : "letzte"]);
    zeichnen(liste, f);
  };
  const such = el.querySelector(".search");
  such.oninput = () => { f.q = such.value; anwenden(); };
  el.querySelectorAll("[data-h]").forEach(b => b.onclick = () => { f.herkunft = f.herkunft === b.dataset.h ? "" : b.dataset.h; filter(el, biere, zeichnen, o); });
  el.querySelector("[data-nie]").onclick = () => { f.nie = !f.nie; filter(el, biere, zeichnen, o); };
  const st = el.querySelector(".bf-stil"); if (st) st.onchange = () => { f.stil = st.value; anwenden(); };
  const so = el.querySelector(".bf-sort"); if (so) so.onchange = () => { f.sort = so.value; anwenden(); };
  anwenden();
  if (o.fokus && !matchMedia("(hover:none)").matches) such.focus(); // auf dem Handy nicht: die Tastatur würde die Liste verdecken
}

/* Bier anlegen oder bearbeiten. o.vorgabe: {name, brauerei, stilName}; o.stile: Stil-Liste des Aufrufers (wird bei
   „neuer Stil“ ergänzt); o.knopf: Beschriftung beim Anlegen; o.gespeichert(id, istNeu): nach dem Speichern. */
async function oeffnen(bier, o = {}) {
  const vorgabe = o.vorgabe || {};
  const stile = o.stile || await stileLaden();
  const { data: sude } = await sb().from("sude").select("id,nr,stil,datum,bild_etikett,bild_kronkorken,bild_flasche").order("datum", { ascending: false });
  const b = bier || { name: vorgabe.name || "", brauerei: vorgabe.brauerei || "", eigen: false, stil_id: (stile.find(s => s.name.toLowerCase() === (vorgabe.stilName || "").toLowerCase()) || {}).id ?? null, alkohol: null, sud_id: null, notiz: "", bild_kronkorken: null, bild_flasche: null };
  const bildBasis = `biere/${bier?.id || "neu-" + crypto.randomUUID()}`;
  const bierVorschau = { name: b.name, stil: (stile.find(s => s.id === b.stil_id) || {}).name };
  sheet(bier ? "Bier bearbeiten" : "Neues Bier", `<form id="bierForm" class="stack" novalidate>
      <label class="f" for="bi_name">Name *<input id="bi_name" maxlength="80" value="${esc(b.name)}" required></label>
      <label class="check"><input type="checkbox" id="bi_eigen"${b.eigen ? " checked" : ""}><span><b>Selbst gebraut (Koldingbräu)</b></span></label>
      <div class="grid2">
        <label class="f" for="bi_br">Brauerei<input id="bi_br" maxlength="80" value="${esc(b.brauerei || "")}"></label>
        <label class="f" for="bi_alk">Alkohol (% Vol.)<input id="bi_alk" type="number" step="0.1" min="0" max="30" inputmode="decimal" value="${esc(b.alkohol ?? "")}"></label>
        <label class="f" for="bi_stil">Bierstil<select id="bi_stil"><option value="">– bitte wählen –</option>${stile.map(s => `<option value="${s.id}"${s.id === b.stil_id ? " selected" : ""}>${esc(s.name)}</option>`).join("")}${isAdmin() ? `<option value="neu">+ Neuer Stil …</option>` : ""}</select></label>
        <label class="f" for="bi_sud" id="sudWrap"${b.eigen ? "" : " hidden"}>Zugehöriger Sud<select id="bi_sud"><option value="">–</option>${(sude || []).map(s => `<option value="${s.id}"${s.id === b.sud_id ? " selected" : ""}>Nr. ${esc(s.nr)} · ${esc(s.stil || "")}${s.datum ? " · " + esc(KB.fmtDateLong(s.datum)) : ""}</option>`).join("")}</select></label>
      </div>
      <label class="f" for="bi_neustil" id="neuStilWrap" hidden>Name des neuen Stils<input id="bi_neustil" maxlength="60"></label>
      <div class="grid2 bildfelder">
        ${Bilder.feldHtml("bi_kk", b.bild_kronkorken, { art: "rund", bier: bierVorschau, beschriftung: "Kronkorken" })}
        ${Bilder.feldHtml("bi_fl", b.bild_flasche, { art: "hoch", bier: bierVorschau, beschriftung: "Flasche" })}
      </div>
      <p class="hint">Beide Bilder sind freiwillig. Gibt es nur eins, wird es überall gezeigt.</p>
      <label class="f" for="bi_notiz">Notiz (intern)<textarea id="bi_notiz" maxlength="1000">${esc(b.notiz || "")}</textarea></label>
      <span class="err" id="biErr"></span>
    </form>`,
    `<span class="spacer"></span><button class="btn" id="biAbbr">Abbrechen</button><button class="btn primary" id="biSave" form="bierForm" type="submit">${bier ? "Speichern" : (o.knopf || "Anlegen")}</button>`);
  const fKK = Bilder.feldVerdrahten("bi_kk", { art: "rund", basis: bildBasis + "/kronkorken", titel: "Kronkorken", bier: bierVorschau });
  const fFL = Bilder.feldVerdrahten("bi_fl", { art: "hoch", basis: bildBasis + "/flasche", titel: "Flasche", bier: bierVorschau });
  $("#biAbbr").onclick = closeSheet;
  $("#bi_eigen").onchange = () => { $("#sudWrap").hidden = !$("#bi_eigen").checked; if ($("#bi_eigen").checked && !$("#bi_br").value.trim()) $("#bi_br").value = "Koldingbräu"; };
  $("#bi_stil").onchange = () => { $("#neuStilWrap").hidden = $("#bi_stil").value !== "neu"; };
  // Sud ausgewählt: Sud und Bier teilen sich Kronkorken und Flasche (dieselbe Datei). Übernommen wird, was fehlt.
  $("#bi_sud").onchange = () => {
    const sud = (sude || []).find(s => s.id === $("#bi_sud").value);
    if (!sud) return;
    if (sud.bild_kronkorken && !fKK.wert()) fKK.setzen(sud.bild_kronkorken);
    const fl = sud.bild_flasche || sud.bild_etikett;
    if (fl && !fFL.wert()) fFL.setzen(fl);
  };
  $("#bierForm").onsubmit = async e => {
    e.preventDefault();
    const err = $("#biErr"), alk = $("#bi_alk").value;
    const out = { name: $("#bi_name").value.trim(), brauerei: $("#bi_br").value.trim() || null, eigen: $("#bi_eigen").checked,
      alkohol: alk === "" ? null : +alk, sud_id: $("#bi_eigen").checked ? ($("#bi_sud").value || null) : null, notiz: $("#bi_notiz").value.trim() || null,
      bild_kronkorken: fKK.wert(), bild_flasche: fFL.wert() };
    if (!out.name) { err.textContent = "Bitte einen Namen eingeben."; return; }
    if (out.alkohol != null && (isNaN(out.alkohol) || out.alkohol < 0 || out.alkohol > 30)) { err.textContent = "Alkohol bitte zwischen 0 und 30 % angeben."; return; }
    $("#biSave").disabled = true; err.textContent = "";
    let stil = $("#bi_stil").value;
    if (stil === "neu") {
      const n = $("#bi_neustil").value.trim();
      if (!n) { $("#biSave").disabled = false; err.textContent = "Bitte den Namen des neuen Stils eingeben."; return; }
      const r = await sb().from("bierstile").insert({ name: n }).select("id,name,reihenfolge").single();
      if (r.error) { $("#biSave").disabled = false; err.textContent = fehlertext(r.error); return; }
      stile.push(r.data); if (stileCache && stileCache !== stile) stileCache.push(r.data); stil = r.data.id;
    }
    out.stil_id = stil ? +stil : null;
    const q = bier ? sb().from("biere").update(out).eq("id", bier.id) : sb().from("biere").insert(out);
    const { data, error } = await q.select("id").single();
    if (error) { $("#biSave").disabled = false; err.textContent = fehlertext(error); return; }
    // Verknüpfter Sud bekommt dieselben Bilder (gemeinsame Pflege), dann erst alte Dateien aufräumen.
    if (out.sud_id && (out.bild_kronkorken || out.bild_flasche)) {
      const upd = {}; if (out.bild_kronkorken) upd.bild_kronkorken = out.bild_kronkorken; if (out.bild_flasche) upd.bild_flasche = out.bild_flasche;
      await sb().from("sude").update(upd).eq("id", out.sud_id);
    }
    if (bier) for (const k of ["bild_kronkorken", "bild_flasche"]) if (bier[k] && bier[k] !== out[k]) Bilder.loeschen(bier[k]);
    if (o.gespeichert) await o.gespeichert(data.id, !bier);
    else { toast(bier ? "Gespeichert" : "Bier angelegt"); closeSheet(); }
  };
}

global.BierForm = { laden, filter, oeffnen, zeile, stileLaden };
})(window);
