/* Koldingbräu – Verkostungen: Bewertungsbogen (Gäste und Admin) */
"use strict";
/* opts: {titel, hint, oben (zusätzliches HTML), alt, speichern(werte) → Promise<{error}>, fertig()} */
function bogenZeigen(opts){
  const alt = opts.alt || {};
  const f = { note: alt.note ?? null, merkmale: {...(alt.merkmale||{})}, geruch: new Set(alt.geruch||[]), fehler: new Set(alt.fehler||[]), nochmal: alt.nochmal ?? null };
  const regler = ([k,label,l,r]) => {
    const has = f.merkmale[k] != null;
    return `<div class="sl${has?"":" unset"}" data-k="${k}">
      <div class="sl-top"><span>${esc(label)}</span><output id="o_${k}" class="num">${has?f.merkmale[k]:"–"}</output></div>
      <input type="range" min="0" max="10" step="1" id="r_${k}" value="${has?f.merkmale[k]:5}" aria-label="${esc(label)}: ${esc(l)} bis ${esc(r)}">
      <div class="sl-ends"><span>${esc(l)}</span><span>${esc(r)}</span></div>
    </div>`;
  };
  const chips = (liste, set, art) => `<div class="tagpick">${liste.map(t=>`<button type="button" class="chip" data-art="${art}" data-t="${esc(t)}" aria-pressed="${set.has(t)}">${esc(t)}</button>`).join("")}</div>`;
  const body = `<form id="bogen" novalidate>
    ${opts.hint?`<p class="hint">${esc(opts.hint)}</p>`:""}
    ${opts.oben||""}
    <fieldset><legend>Gesamtnote *</legend>
      <div class="scale" role="radiogroup" aria-label="Gesamtnote von 0 bis 10">${Array.from({length:11},(_,i)=>`<button type="button" role="radio" aria-checked="${f.note===i}" data-n="${i}">${i}</button>`).join("")}</div>
      <div class="sl-ends"><span>0 = gar nicht</span><span>10 = großartig</span></div>
    </fieldset>
    <fieldset><legend>Würdest du es nochmal trinken?</legend>
      <div class="yn"><button type="button" data-yn="true" aria-pressed="${f.nochmal===true}">Ja</button><button type="button" data-yn="false" aria-pressed="${f.nochmal===false}">Nein</button></div>
    </fieldset>
    <label class="f" for="b_kom">Was fällt dir auf? (optional)<textarea id="b_kom" maxlength="1000">${esc(alt.kommentar||"")}</textarea></label>
    <p class="hint">Alles Weitere ist freiwillig – beschreib das Bier, so genau du magst.</p>
    ${MERKMALE.map(([grp, liste]) => `<details class="grp"${grp!=="Geschmack"&&!liste.some(x=>f.merkmale[x[0]]!=null)&&!(grp==="Geruch"&&f.geruch.size)?"":" open"}><summary>${esc(grp)}</summary>
      ${liste.map(regler).join("")}
      ${grp==="Geruch"?chips(GERUCH,f.geruch,"geruch"):""}
    </details>`).join("")}
    <details class="grp"${f.fehler.size?" open":""}><summary>Fehlaromen</summary>${chips(FEHLER,f.fehler,"fehler")}</details>
  </form>`;
  sheet(opts.titel, body,
    `<span class="err" id="bErr"></span><span class="spacer"></span><button class="btn" id="bAbbr">Abbrechen</button><button class="btn primary" id="bSave">Speichern</button>`);
  const form = $("#bogen");
  form.querySelectorAll(".scale button").forEach(b => b.onclick = () => { f.note = +b.dataset.n; $("#bErr").textContent = ""; form.querySelectorAll(".scale button").forEach(x=>x.setAttribute("aria-checked", String(x===b))); });
  form.querySelectorAll(".yn button").forEach(b => b.onclick = () => { const v = b.dataset.yn==="true"; f.nochmal = f.nochmal===v ? null : v; form.querySelectorAll(".yn button").forEach(x=>x.setAttribute("aria-pressed", String(f.nochmal!==null && (x.dataset.yn==="true")===f.nochmal))); });
  form.querySelectorAll(".sl input").forEach(r => r.addEventListener("input", () => { const k = r.id.slice(2); f.merkmale[k] = +r.value; $("#o_"+k).textContent = r.value; r.closest(".sl").classList.remove("unset"); }));
  form.querySelectorAll(".tagpick .chip").forEach(c => c.onclick = () => { const s = c.dataset.art==="geruch" ? f.geruch : f.fehler; const t = c.dataset.t; s.has(t) ? s.delete(t) : s.add(t); c.setAttribute("aria-pressed", String(s.has(t))); });
  $("#bAbbr").onclick = closeSheet;
  $("#bSave").onclick = async () => {
    if(f.note == null){ $("#bErr").textContent = "Bitte eine Gesamtnote wählen."; form.querySelector(".scale button")?.focus(); return; }
    $("#bSave").disabled = true; $("#bErr").textContent = "";
    const {error} = await opts.speichern({p_note: f.note, p_merkmale: f.merkmale, p_geruch: [...f.geruch], p_fehler: [...f.fehler], p_nochmal: f.nochmal, p_kommentar: $("#b_kom").value.trim() || null});
    if(error){ $("#bSave").disabled = false; $("#bErr").textContent = fehlertext(error); return; }
    closeSheet(); toast("Gespeichert"); opts.fertig && opts.fertig();
  };
}

