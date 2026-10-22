/* Koldingbräu – Verkostungen: Bewertungsbogen (Gäste und Admin)
   Mobil optimiert: das Testing läuft hauptsächlich am Handy, darum nur ein Abschnitt pro
   Bildschirm, mit „Weiter“ (bzw. „Zurück“) durchgeklickt. Reihenfolge wie vorgegeben:
   Aussehen, Geruch, Geschmack, Mundgefühl, Fehlaromen, Was fällt dir auf?, Nochmal trinken?,
   Benotung (einziges Pflichtfeld, deshalb zuletzt). */
"use strict";
const BOGEN_SCHRITTE = [
  ...MERKMALE.map(([grp, liste]) => ({art:"merkmale", label:grp, felder:liste, chips: grp==="Geruch"?GERUCH:null, chipArt:"geruch"})),
  {art:"chips", label:"Fehlaromen", chips:FEHLER, chipArt:"fehler"},
  {art:"text", label:"Was fällt dir auf?"},
  {art:"yn", label:"Würdest du es nochmal trinken?"},
  {art:"note", label:"Benotung"},
];

/* opts: {titel, hint, oben (zusätzliches HTML, bleibt über alle Schritte sichtbar), alt, speichern(werte) → Promise<{error}>, fertig()} */
function bogenZeigen(opts){
  const alt = opts.alt || {};
  const f = { note: alt.note ?? null, merkmale: {...(alt.merkmale||{})}, geruch: new Set(alt.geruch||[]), fehler: new Set(alt.fehler||[]), nochmal: alt.nochmal ?? null, kommentar: alt.kommentar || "" };
  let schritt = 0;

  const regler = ([k,label,l,r]) => {
    const has = f.merkmale[k] != null;
    return `<div class="sl${has?"":" unset"}" data-k="${k}">
      <div class="sl-top"><span>${esc(label)}</span><output id="o_${k}" class="num">${has?f.merkmale[k]:"–"}</output></div>
      <input type="range" min="0" max="10" step="1" id="r_${k}" value="${has?f.merkmale[k]:5}" aria-label="${esc(label)}: ${esc(l)} bis ${esc(r)}">
      <div class="sl-ends"><span>${esc(l)}</span><span>${esc(r)}</span></div>
    </div>`;
  };
  const chips = (liste, set, art) => `<div class="tagpick">${liste.map(t=>`<button type="button" class="chip" data-art="${art}" data-t="${esc(t)}" aria-pressed="${set.has(t)}">${esc(t)}</button>`).join("")}</div>`;

  function inhaltHtml(s){
    if(s.art === "merkmale"){
      let h = s.felder.map(regler).join("");
      if(s.chips) h += chips(s.chips, f.geruch, s.chipArt);
      return h;
    }
    if(s.art === "chips") return chips(s.chips, f.fehler, s.chipArt);
    if(s.art === "text") return `<label class="f" for="b_kom">Kommentar (optional)<textarea id="b_kom" maxlength="1000">${esc(f.kommentar)}</textarea></label><p class="hint">Beschreib das Bier, so genau du magst.</p>`;
    if(s.art === "yn") return `<div class="yn"><button type="button" data-yn="true" aria-pressed="${f.nochmal===true}">Ja</button><button type="button" data-yn="false" aria-pressed="${f.nochmal===false}">Nein</button></div>`;
    if(s.art === "note") return `<div class="scale" role="radiogroup" aria-label="Gesamtnote von 0 bis 10">${Array.from({length:11},(_,i)=>`<button type="button" role="radio" aria-checked="${f.note===i}" data-n="${i}">${i}</button>`).join("")}</div>
      <div class="sl-ends"><span>0 = gar nicht</span><span>10 = großartig</span></div>`;
    return "";
  }

  function schrittHtml(){
    const s = BOGEN_SCHRITTE[schritt], n = schritt + 1, total = BOGEN_SCHRITTE.length;
    return `<div class="fortschritt"><span class="punkte">${BOGEN_SCHRITTE.map((_,i)=>`<i class="${i<=schritt?"ab":""}"></i>`).join("")}</span><span class="zahl num">${n} / ${total}</span></div>
      <fieldset><legend>${esc(s.label)}</legend>${inhaltHtml(s)}</fieldset>
      <span class="err" id="bErr"></span>`;
  }
  function footHtml(){
    const letzte = schritt === BOGEN_SCHRITTE.length - 1;
    return `${schritt>0?`<button class="btn" id="bZurueck" aria-label="Zurück">←</button>`:""}<span class="spacer"></span><button class="btn" id="bAbbr">Abbrechen</button><button class="btn primary" id="bWeiter">${letzte?"Speichern":"Weiter"}</button>`;
  }

  function verdrahten(){
    const s = BOGEN_SCHRITTE[schritt], inhalt = $("#bogenInhalt");
    inhalt.querySelectorAll(".sl input").forEach(r => r.addEventListener("input", () => { const k = r.id.slice(2); f.merkmale[k] = +r.value; $("#o_"+k).textContent = r.value; r.closest(".sl").classList.remove("unset"); }));
    inhalt.querySelectorAll(".tagpick .chip").forEach(c => c.onclick = () => { const set = c.dataset.art==="geruch" ? f.geruch : f.fehler; const t = c.dataset.t; set.has(t) ? set.delete(t) : set.add(t); c.setAttribute("aria-pressed", String(set.has(t))); });
    const ta = $("#b_kom"); if(ta) ta.addEventListener("input", () => { f.kommentar = ta.value; });
    inhalt.querySelectorAll(".yn button").forEach(b => b.onclick = () => { const v = b.dataset.yn==="true"; f.nochmal = f.nochmal===v ? null : v; inhalt.querySelectorAll(".yn button").forEach(x=>x.setAttribute("aria-pressed", String(f.nochmal!==null && (x.dataset.yn==="true")===f.nochmal))); });
    inhalt.querySelectorAll(".scale button").forEach(b => b.onclick = () => { f.note = +b.dataset.n; $("#bErr").textContent = ""; inhalt.querySelectorAll(".scale button").forEach(x=>x.setAttribute("aria-checked", String(x===b))); });

    $("#bAbbr").onclick = closeSheet;
    const zurueck = $("#bZurueck");
    if(zurueck) zurueck.onclick = () => { schritt--; renderSchritt(); };
    $("#bWeiter").onclick = async () => {
      if(s.art === "note" && f.note == null){ $("#bErr").textContent = "Bitte eine Gesamtnote wählen."; inhalt.querySelector(".scale button")?.focus(); return; }
      if(schritt < BOGEN_SCHRITTE.length - 1){ schritt++; renderSchritt(); return; }
      $("#bWeiter").disabled = true; $("#bErr").textContent = "";
      const {error} = await opts.speichern({p_note: f.note, p_merkmale: f.merkmale, p_geruch: [...f.geruch], p_fehler: [...f.fehler], p_nochmal: f.nochmal, p_kommentar: f.kommentar.trim() || null});
      if(error){ $("#bWeiter").disabled = false; $("#bErr").textContent = fehlertext(error); return; }
      closeSheet(); toast("Gespeichert"); opts.fertig && opts.fertig();
    };
  }

  function renderSchritt(){
    $("#bogenInhalt").innerHTML = schrittHtml();
    $("#sheetFoot").innerHTML = footHtml();
    $("#sheetBody").scrollTop = 0;
    verdrahten();
  }

  // oben/hint bleiben über alle Schritte fest stehen (werden nur einmal gerendert, damit z. B.
  // der „Für wen?“-Auswahl in admin.js seine Verdrahtung nicht verliert); nur #bogenInhalt und
  // die Fußleiste werden pro Schritt ausgetauscht.
  const body = `${opts.hint?`<p class="hint">${esc(opts.hint)}</p>`:""}${opts.oben||""}<div id="bogenInhalt"></div>`;
  sheet(opts.titel, body, footHtml());
  renderSchritt();
}
