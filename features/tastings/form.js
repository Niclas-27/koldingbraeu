/* Koldingbräu – Verkostungen: Bewertungsbogen (Gäste und Admin)
   Seit 13.11.2026 drei kurze Seiten statt 7 Schritte – die Gäste sind keine Profis, jede Seite passt ohne Scrollen
   aufs Handy:  1. Riechen (Tags)  2. Schmecken (Tags)  3. Urteil: Note 0–10 (einziges Pflichtfeld) + „Dein Satz zum Bier“.
   Blättern mit „Weiter“/„Zurück“ oder zusätzlich per Wischen (nur waagerecht, ab einer deutlichen Bewegung, nicht im
   Textfeld; Wischen speichert nie – gespeichert wird nur mit dem Knopf). „Was heißt das?“ öffnet ein kleines Glossar
   zu den Tags der aktuellen Seite (Erklärungen in TAGS_GERUCH / TAGS_GESCHMACK, common.js).
   Gespeichert wird wie bisher über vk_bewerten / vk_admin_bewerten, ohne Änderung an der Datenbank:
   - Die Tags beider Seiten landen zusammen in bewertungen.geruch (nur das Wort, ohne Emoji).
   - Die Regler (merkmale), die Ja/Nein-Frage (nochmal) und die Fehlaromen (fehler) fragt der Bogen nicht mehr ab.
     Die Spalten bleiben für die historischen Daten bestehen. Neue Bewertungen senden {} / null / [];
     wird eine alte Bewertung neu gespeichert, gehen ihre alten Werte unverändert mit, damit nichts verloren geht. */
"use strict";
const BOGEN_SEITEN = [
  {art:"tags", label:"Riechen", frage:"Woran erinnert dich der Geruch?", tags: () => TAGS_GERUCH},
  {art:"tags", label:"Schmecken", frage:"Wie schmeckt es?", tags: () => TAGS_GESCHMACK},
  {art:"urteil", label:"Dein Urteil"},
];

/* opts: {titel, hint, oben (zusätzliches HTML über dem Bogen), alt, speichern(werte) → Promise<{error}>, fertig(),
          naechste() → {label, oeffnen} | null  (optional: nach dem Speichern „Weiter zu Probe X“ anbieten)} */
function bogenZeigen(opts){
  const alt = opts.alt || {};
  const f = { note: alt.note ?? null, tags: new Set(alt.geruch||[]), kommentar: alt.kommentar || "" };
  let seite = 0;
  const letzte = BOGEN_SEITEN.length - 1;

  const seiteHtml = (s, i) => {
    let h = `<section class="bogen-seite" data-i="${i}"${i?` aria-hidden="true"`:""}><fieldset><legend>${esc(s.label)}</legend>`;
    if(s.art === "tags"){
      h += `<p class="hint">${esc(s.frage)} Tipp an, was passt – gern mehrere, gern keins.</p>
        <div class="tagpick">${s.tags().map(([t,e])=>`<button type="button" class="chip" data-t="${esc(t)}" aria-pressed="${f.tags.has(t)}"><span aria-hidden="true">${e}</span> ${esc(t)}</button>`).join("")}</div>
        <button type="button" class="linkbtn glossar-auf" data-glossar="${i}">Was heißt das?</button>`;
    } else {
      h += `<div class="scale" role="radiogroup" aria-label="Gesamtnote von 0 bis 10">${Array.from({length:11},(_,n)=>`<button type="button" role="radio" aria-checked="${f.note===n}" data-n="${n}">${n}</button>`).join("")}</div>
        <div class="sl-ends"><span>0 = gar nicht</span><span>10 = großartig</span></div>
        <label class="f" for="b_kom">Dein Satz zum Bier (optional)<input id="b_kom" maxlength="140" value="${esc(f.kommentar)}" placeholder="z. B. „Schmeckt nach Sommer“" autocomplete="off" enterkeyhint="done"></label>`;
    }
    return h + `</fieldset></section>`;
  };

  const body = `${opts.hint?`<p class="hint">${esc(opts.hint)}</p>`:""}${opts.oben||""}
    <div id="bogenInhalt"><div class="bogen-spur">${BOGEN_SEITEN.map(seiteHtml).join("")}</div></div>
    <span class="err" id="bErr" role="alert"></span>`;
  const foot = `<div class="bogen-fuss">
      <div class="fortschritt"><span class="punkte">${BOGEN_SEITEN.map(()=>"<i></i>").join("")}</span><span class="zahl num"></span></div>
      <div class="bogen-knoepfe"><button class="btn" id="bZurueck" aria-label="Zurück">←</button><button class="btn primary" id="bWeiter"></button></div>
    </div>`;
  sheet(opts.titel, body, foot);

  const inhalt = $("#bogenInhalt"), spur = inhalt.querySelector(".bogen-spur");
  function zeigen(neu){
    seite = Math.max(0, Math.min(letzte, neu));
    spur.style.transform = `translateX(${-seite*100}%)`;
    spur.querySelectorAll(".bogen-seite").forEach((el,i) => { el.toggleAttribute("aria-hidden", i!==seite); el.inert = i!==seite; });
    $("#sheetFoot").querySelectorAll(".punkte i").forEach((p,i) => p.classList.toggle("ab", i<=seite));
    $("#sheetFoot").querySelector(".zahl").textContent = `${seite+1} / ${BOGEN_SEITEN.length}`;
    $("#bZurueck").hidden = seite === 0;
    $("#bWeiter").textContent = seite === letzte ? "Speichern" : "Weiter";
    $("#sheetBody").scrollTop = 0;
  }

  inhalt.querySelectorAll(".scale button").forEach(b => b.onclick = () => { f.note = +b.dataset.n; $("#bErr").textContent = ""; inhalt.querySelectorAll(".scale button").forEach(x=>x.setAttribute("aria-checked", String(x===b))); });
  inhalt.querySelectorAll(".tagpick .chip").forEach(c => c.onclick = () => { const t = c.dataset.t; f.tags.has(t) ? f.tags.delete(t) : f.tags.add(t); c.setAttribute("aria-pressed", String(f.tags.has(t))); });
  inhalt.querySelectorAll("[data-glossar]").forEach(b => b.onclick = () => glossarZeigen(BOGEN_SEITEN[+b.dataset.glossar]));
  const kom = $("#b_kom");
  kom.addEventListener("input", () => { f.kommentar = kom.value; });
  kom.addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); kom.blur(); } });

  // Wischen: nur eine überwiegend waagerechte Geste über einer Mindestlänge zählt (wie in der Foto-Ansicht, lib/bilder.js),
  // damit ein leicht schräger Tap auf einen Tag nicht blättert. Im Textfeld nie (dort verschiebt man den Cursor).
  let startX = null, startY = null;
  inhalt.addEventListener("touchstart", e => {
    if(e.touches.length !== 1 || e.target.closest("input, textarea")){ startX = null; return; }
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
  }, {passive: true});
  inhalt.addEventListener("touchend", e => {
    if(startX === null) return;
    const dx = e.changedTouches[0].clientX - startX, dy = e.changedTouches[0].clientY - startY;
    startX = null;
    if(Math.abs(dx) > Math.max(60, inhalt.clientWidth / 4) && Math.abs(dx) > Math.abs(dy) * 1.5) zeigen(seite + (dx < 0 ? 1 : -1));
  }, {passive: true});

  $("#bZurueck").onclick = () => zeigen(seite - 1);
  $("#bWeiter").onclick = async () => {
    if(seite < letzte){ zeigen(seite + 1); return; }
    if(f.note == null){ $("#bErr").textContent = "Bitte eine Note wählen."; inhalt.querySelector(".scale button")?.focus(); return; }
    $("#bWeiter").disabled = true; $("#bErr").textContent = "";
    const {error} = await opts.speichern({p_note: f.note, p_merkmale: alt.merkmale || {}, p_geruch: [...f.tags], p_fehler: alt.fehler || [],
      p_nochmal: alt.nochmal ?? null, p_kommentar: f.kommentar.trim() || null});
    if(error){ $("#bWeiter").disabled = false; $("#bErr").textContent = fehlertext(error); return; }
    const weiter = opts.naechste && opts.naechste();
    if(!weiter){ closeSheet(); toast("Gespeichert"); opts.fertig && opts.fertig(); return; }
    // Gespeichert – direkt zum nächsten noch offenen Bier weiterbieten (kein Wischen zwischen Bieren, siehe README)
    $("#sheetBody").innerHTML = `<div class="bogen-fertig"><span class="haken" aria-hidden="true">✓</span><h3>Gespeichert</h3><p class="hint">Deine Note: <b class="num">${f.note}</b></p></div>`;
    $("#sheetFoot").innerHTML = `<div class="bogen-knoepfe"><button class="btn" id="bFertig">Fertig</button><button class="btn primary" id="bNaechste">${esc(weiter.label)} →</button></div>`;
    $("#bFertig").onclick = () => { closeSheet(); opts.fertig && opts.fertig(); };
    $("#bNaechste").onclick = () => { opts.fertig && opts.fertig(); weiter.oeffnen(); };
    $("#bNaechste").focus();
  };
  zeigen(0);
}

/* Kleines Glossar zu den Tags einer Seite – eigenes Fenster über dem Bogen (wie bestaetigen() in core.js),
   damit der Bogen mit allen Eingaben darunter offen bleibt. */
function glossarZeigen(s){
  const eintraege = s.tags().filter(([,,erkl]) => erkl);
  const d = document.createElement("div");
  d.className = "frage glossar"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "glossarTitel");
  d.innerHTML = `<div class="frage-k"><h3 id="glossarTitel">${esc(s.label)}: Was heißt das?</h3>
    <dl>${eintraege.map(([t,e,erkl]) => `<div><dt><span aria-hidden="true">${e}</span> ${esc(t)}</dt><dd>${esc(erkl)}</dd></div>`).join("")}</dl>
    <div class="frage-f"><button type="button" class="btn primary" data-zu>Alles klar</button></div></div>`;
  const zu = () => { d.remove(); document.removeEventListener("keydown", taste, true); };
  // Escape schließt nur das Glossar, nicht auch noch den Bogen darunter (core.js schließt das Fenster bei Escape)
  const taste = e => { if(e.key === "Escape"){ e.stopPropagation(); zu(); } };
  d.onclick = e => { if(e.target === d) zu(); };
  d.querySelector("[data-zu]").onclick = zu;
  document.addEventListener("keydown", taste, true);
  document.body.appendChild(d); d.querySelector("[data-zu]").focus({preventScroll: true}); // Titel oben sichtbar lassen
}
