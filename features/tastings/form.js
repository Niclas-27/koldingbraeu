/* Koldingbräu – Verkostungen: Bewertungsbogen (Gäste und Admin)
   Seit 13.11.2026 kurze Seiten statt 7 Schritte – die Gäste sind keine Profis, jede Seite passt ohne Scrollen
   aufs Handy:  1. Riechen (Tags)  2. Schmecken (Tags)  3. Geschmacksbild (Kreis)  4. Urteil: Note 0–10 (einziges
   Pflichtfeld) + „Dein Satz zum Bier“.
   Blättern mit „Weiter“/„Zurück“ oder zusätzlich per Wischen (nur waagerecht, ab einer deutlichen Bewegung, nicht im
   Textfeld und nicht im Kreis; Wischen speichert nie – gespeichert wird nur mit dem Knopf). „Was heißt das?“ öffnet
   ein kleines Glossar zu den Begriffen der aktuellen Seite (TAGS_GERUCH / TAGS_GESCHMACK / KREIS_BEGRIFFE, common.js).
   Gespeichert wird wie bisher über vk_bewerten / vk_admin_bewerten, ohne Änderung an der Datenbank:
   - Die Tags beider Seiten landen zusammen in bewertungen.geruch (nur das Wort, ohne Emoji).
   - Der Geschmackskreis landet als die früheren Regler „bitter“ und „suesse“ (0–10) in merkmale.
   - Die übrigen Regler, die Ja/Nein-Frage (nochmal) und die Fehlaromen (fehler) fragt der Bogen nicht mehr ab.
     Die Spalten bleiben für die historischen Daten bestehen. Wird eine alte Bewertung neu gespeichert, gehen ihre
     alten Werte unverändert mit, damit nichts verloren geht.
   Geschmackskreis (seit 13.11.2026): Punkt stufenlos setzen und ziehen; eine Blase über dem Daumen beschreibt die
   Wahl in Worten. Verglichen wurde auch eine Variante mit 17 festen Feldern – die stufenlose gefiel besser. */
"use strict";
const BOGEN_SEITEN = [
  {art:"tags", label:"Riechen", frage:"Woran erinnert dich der Geruch?", tags: () => TAGS_GERUCH},
  {art:"tags", label:"Schmecken", frage:"Wie schmeckt es?", tags: () => TAGS_GESCHMACK},
  {art:"kreis", label:"Geschmacksbild", tags: () => KREIS_BEGRIFFE},
  {art:"urteil", label:"Dein Urteil"},
];

/* ---- Geschmackskreis --------------------------------------------------------------------------------------
   Lage im Kreis als x/y von -1 bis 1: x nach rechts = süß, links = trocken; y nach oben = bitter, unten = mild.
   Mitte = ausgewogen, Rand = sehr ausgeprägt. */
const KREIS_R = 100;
const kreisAusMerkmalen = m => (m && typeof m.bitter === "number" && typeof m.suesse === "number")
  ? {x: (m.suesse - 5) / 5, y: (m.bitter - 5) / 5} : null;
const kreisZuMerkmalen = p => ({bitter: Math.round(5 + 5*p.y), suesse: Math.round(5 + 5*p.x)});
const kreisBegrenzen = p => { const r = Math.hypot(p.x, p.y); return r > 1 ? {x: p.x/r, y: p.y/r} : p; };
function kreisText(p){
  if(!p) return "Noch nichts gewählt – tipp in den Kreis.";
  const teil = (v, plus, minus) => { const a = Math.abs(v); if(a < 0.2) return null;
    return {a, t: (a > 0.75 ? "sehr " : a < 0.45 ? "leicht " : "") + (v > 0 ? plus : minus)}; };
  const t = [teil(p.y, "bitter", "mild"), teil(p.x, "süß", "trocken")].filter(Boolean).sort((a,b) => b.a - a.a).map(x => x.t);
  if(!t.length) return "Ausgewogen";
  const s = t.join(" und "); return s[0].toUpperCase() + s.slice(1);
}
function kreisSvg(){
  return `<svg class="kreis-svg" viewBox="-104 -104 208 208" aria-hidden="true">
    <circle class="kreis-grund" r="${KREIS_R}"/><circle class="kreis-hilfe" r="${KREIS_R/2}"/>
    <line class="kreis-achse" x1="0" y1="-${KREIS_R}" x2="0" y2="${KREIS_R}"/><line class="kreis-achse" x1="-${KREIS_R}" y1="0" x2="${KREIS_R}" y2="0"/>
    <circle class="kreis-mitte" r="2.5"/>
    <g class="kreis-punkt" hidden><circle class="kp-hof" r="20"/><circle class="kp-kern" r="9"/></g>
  </svg>`;
}

/* opts: {titel, hint, oben (zusätzliches HTML über dem Bogen), alt, speichern(werte) → Promise<{error}>, fertig(),
          naechste() → {label, oeffnen} | null  (optional: nach dem Speichern „Weiter zu Probe X“ anbieten)} */
function bogenZeigen(opts){
  const alt = opts.alt || {};
  const f = { note: alt.note ?? null, tags: new Set(alt.geruch||[]), kommentar: alt.kommentar || "",
              kreis: kreisAusMerkmalen(alt.merkmale), kreisGeloescht: false };
  let seite = 0;
  const letzte = BOGEN_SEITEN.length - 1;

  const seiteHtml = (s, i) => {
    let h = `<section class="bogen-seite" data-i="${i}"${i?` aria-hidden="true"`:""}><fieldset><legend>${esc(s.label)}</legend>`;
    if(s.art === "tags"){
      h += `<p class="hint">${esc(s.frage)} Tipp an, was passt – gern mehrere, gern keins.</p>
        <div class="tagpick">${s.tags().map(([t,e])=>`<button type="button" class="chip" data-t="${esc(t)}" aria-pressed="${f.tags.has(t)}"><span aria-hidden="true">${e}</span> ${esc(t)}</button>`).join("")}</div>
        <button type="button" class="linkbtn glossar-auf" data-glossar="${i}">Was heißt das?</button>`;
    } else if(s.art === "kreis"){
      h += `<p class="hint">Wo liegt das Bier? Mitte = ausgewogen, außen = sehr ausgeprägt.</p>
        <div class="kreis">
          <span class="kl kl-o">☕ Bitter</span><span class="kl kl-l">🌵<br>Trocken</span>
          <div class="kreis-feld" tabindex="0" role="group" aria-label="Geschmackskreis: oben bitter, unten mild, links trocken, rechts süß. Mit den Pfeiltasten verschieben." aria-describedby="kreisText"></div>
          <span class="kl kl-r">🍯<br>Süß</span><span class="kl kl-u">🥛 Mild</span>
        </div>
        <p class="kreis-text" id="kreisText" aria-live="polite"></p>
        <div class="kreis-links"><button type="button" class="linkbtn glossar-auf" data-glossar="${i}">Was heißt das?</button>
          <button type="button" class="linkbtn" id="kreisWeg">Zurücksetzen</button></div>`;
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
  kreisVerdrahten(inhalt, f);

  // Wischen: nur eine überwiegend waagerechte Geste über einer Mindestlänge zählt (wie in der Foto-Ansicht, lib/bilder.js),
  // damit ein leicht schräger Tap auf einen Tag nicht blättert. Im Textfeld nie (dort verschiebt man den Cursor) und
  // im Geschmackskreis nie (dort zieht man den Punkt).
  let startX = null, startY = null;
  inhalt.addEventListener("touchstart", e => {
    if(e.touches.length !== 1 || e.target.closest("input, textarea, .kreis-feld")){ startX = null; return; }
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
    const merkmale = {...(alt.merkmale || {})};
    if(f.kreis) Object.assign(merkmale, kreisZuMerkmalen(f.kreis));
    else if(f.kreisGeloescht){ delete merkmale.bitter; delete merkmale.suesse; }
    const {error} = await opts.speichern({p_note: f.note, p_merkmale: merkmale, p_geruch: [...f.tags], p_fehler: alt.fehler || [],
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

/* Geschmackskreis: Tippen setzt den Punkt, Ziehen verschiebt ihn.
   Pfeiltasten verschieben ihn in Schritten. Der Wert steht in f.kreis ({x, y} oder null). */
function kreisVerdrahten(inhalt, f){
  const feld = inhalt.querySelector(".kreis-feld");
  if(!feld) return;
  let svg, punkt, blase, blaseWeg = null;
  const zeichnen = () => {
    feld.innerHTML = kreisSvg() + `<span class="kreis-blase" aria-hidden="true"></span>`;
    svg = feld.querySelector("svg"); punkt = svg.querySelector(".kreis-punkt"); blase = feld.querySelector(".kreis-blase");
    anzeigen();
  };
  const anzeigen = () => {
    const p = f.kreis;
    punkt.toggleAttribute("hidden", !p); // SVG-Elemente kennen .hidden nicht als Eigenschaft
    if(p) punkt.setAttribute("transform", `translate(${(p.x*KREIS_R).toFixed(1)} ${(-p.y*KREIS_R).toFixed(1)})`);
    inhalt.querySelector("#kreisText").textContent = kreisText(p);
    // Blase über dem Daumen: der Finger verdeckt den Punkt, und der Text unter dem Kreis liegt auf kleinen Handys
    // schon unter dem Weiter-Knopf. Waagerecht etwas eingerückt, damit sie am Rand nicht aus dem Bild ragt.
    if(p){
      blase.textContent = kreisText(p);
      blase.style.left = Math.min(72, Math.max(28, 50 + p.x*KREIS_R/2.08)) + "%";
      blase.style.top = (50 - p.y*KREIS_R/2.08) + "%";
    } else blase.classList.remove("an");
    inhalt.querySelector("#kreisWeg").hidden = !p;
  };
  const setzen = p => { p = kreisBegrenzen(p); f.kreis = p; f.kreisGeloescht = false; anzeigen(); };
  const ausZeiger = e => {
    const r = svg.getBoundingClientRect(), s = 208 / r.width; // viewBox ist 208 breit
    return {x: ((e.clientX - r.left) * s - 104) / KREIS_R, y: -((e.clientY - r.top) * s - 104) / KREIS_R};
  };
  let zieht = false;
  feld.addEventListener("pointerdown", e => {
    const p = ausZeiger(e);
    if(Math.hypot(p.x, p.y) > 1.08) return; // knapp außerhalb zählt noch, weiter weg nicht
    zieht = true; feld.setPointerCapture(e.pointerId); feld.classList.add("zieht"); setzen(p); e.preventDefault();
    clearTimeout(blaseWeg); blase.classList.add("an");
  });
  feld.addEventListener("pointermove", e => { if(zieht) setzen(ausZeiger(e)); });
  // Nach dem Loslassen bleibt die Blase noch kurz stehen, damit man sie ohne Daumen lesen kann
  const ende = () => { if(!zieht) return; zieht = false; feld.classList.remove("zieht");
    clearTimeout(blaseWeg); blaseWeg = setTimeout(() => blase.classList.remove("an"), 1600); };
  feld.addEventListener("pointerup", ende); feld.addEventListener("pointercancel", ende);
  feld.addEventListener("keydown", e => {
    const d = {ArrowUp:[0,1], ArrowDown:[0,-1], ArrowLeft:[-1,0], ArrowRight:[1,0]}[e.key];
    if(!d) return;
    e.preventDefault();
    const p = f.kreis || {x: 0, y: 0}, schritt = 0.1;
    setzen({x: p.x + d[0]*schritt, y: p.y + d[1]*schritt});
  });
  inhalt.querySelector("#kreisWeg").onclick = () => { f.kreis = null; f.kreisGeloescht = true; anzeigen(); feld.focus(); };
  zeichnen();
}

/* Kleines Glossar zu den Begriffen einer Seite – eigenes Fenster über dem Bogen (wie bestaetigen() in core.js),
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
