/* Koldingbräu – Verkostungen: Bewertungsbogen (Gäste und Admin)
   Seit 13.11.2026 kurze Seiten statt 7 Schritte – die Gäste sind keine Profis, jede Seite passt ohne Scrollen
   aufs Handy:  1. Riechen (Tags)  2. Schmecken (Tags)  3. Geschmacksbild (Kreis)  4. Urteil: Note 0–10 (einziges
   Pflichtfeld) + „Dein Satz zum Bier“.
   Blättern mit „Weiter“/„Zurück“ oder zusätzlich per Wischen (nur waagerecht, ab einer deutlichen Bewegung, nicht im
   Textfeld und nicht im Kreis; Wischen speichert nie – gespeichert wird nur mit dem Knopf). Riechen/Schmecken sind
   seit 14.11.2026 Kacheln mit Beispielen (TAGS_GERUCH / TAGS_GESCHMACK, common.js); ein Glossar („?“) gibt es nur noch
   beim Geschmacksbild (KREIS_BEGRIFFE).
   Gespeichert wird wie bisher über vk_bewerten / vk_admin_bewerten, ohne Änderung an der Datenbank:
   - Die Tags beider Seiten landen zusammen in bewertungen.geruch (nur das Wort, ohne Emoji).
   - Der Geschmackskreis landet als die früheren Regler „bitter“ und „suesse“ (0–10) in merkmale.
   - Die übrigen Regler, die Ja/Nein-Frage (nochmal) und die Fehlaromen (fehler) fragt der Bogen nicht mehr ab.
     Die Spalten bleiben für die historischen Daten bestehen. Wird eine alte Bewertung neu gespeichert, gehen ihre
     alten Werte unverändert mit, damit nichts verloren geht.
   Geschmackskreis (seit 13.11.2026): Punkt stufenlos setzen und ziehen; eine Blase über dem Daumen beschreibt die
   Wahl in Worten. Verglichen wurde auch eine Variante mit 17 festen Feldern – die stufenlose gefiel besser.
   Noch am selben Tag wurde aus dem Kreis eine quadratische „Geschmackskarte“ (karteHtml in common.js): Der Kreis saß
   nicht mittig (ungleich breite Beschriftung links/rechts), ließ die Ecken leer und kappte sie sogar – „sehr bitter
   und sehr süß“ war nicht erreichbar. Das Quadrat bildet die beiden Werte 0–10 genau ab; die Ecken nennen Bierstile
   als Orientierung. Im Code heißt es weiter „kreis“ (f.kreis, kreisText …). */
"use strict";
const BOGEN_SEITEN = [
  {art:"tags", label:"Riechen", frage:"Woran erinnert dich der Geruch?", tags: () => TAGS_GERUCH},
  {art:"tags", label:"Schmecken", frage:"Wie schmeckt es?", tags: () => TAGS_GESCHMACK},
  {art:"kreis", label:"Geschmacksbild", tags: () => KREIS_BEGRIFFE},
  {art:"urteil", label:"Dein Urteil"},
];

/* ---- Geschmackskarte -------------------------------------------------------------------------------------
   Lage als x/y von -1 bis 1: x nach rechts = süß, links = trocken; y nach oben = bitter, unten = mild.
   Mitte = ausgewogen, Rand = sehr ausgeprägt. Jede Achse für sich begrenzt – auch die Ecken sind erreichbar. */
const kreisAusMerkmalen = m => (m && typeof m.bitter === "number" && typeof m.suesse === "number")
  ? {x: (m.suesse - 5) / 5, y: (m.bitter - 5) / 5} : null;
const kreisZuMerkmalen = p => ({bitter: Math.round(5 + 5*p.y), suesse: Math.round(5 + 5*p.x)});
const kreisBegrenzen = p => ({x: Math.max(-1, Math.min(1, p.x)), y: Math.max(-1, Math.min(1, p.y))});

/* opts: {titel, hint, oben (zusätzliches HTML über dem Bogen), alt, speichern(werte) → Promise<{error}>, fertig(),
          naechste() → {label, oeffnen} | null  (optional: nach dem Speichern „Weiter zu Probe X“ anbieten)} */
function bogenZeigen(opts){
  const alt = opts.alt || {};
  const f = { note: alt.note ?? null, tags: new Set(alt.geruch||[]), kommentar: alt.kommentar || "",
              kreis: kreisAusMerkmalen(alt.merkmale), kreisGeloescht: false };
  let seite = 0;
  const letzte = BOGEN_SEITEN.length - 1;

  const seiteHtml = (s, i) => {
    // Geschmacksbild: Glossar und Zurücksetzen als kleine Symbol-Knöpfe in der Überschrift, damit die Karte Platz hat
    const kopfKnoepfe = s.art === "kreis" ? `<span class="kopf-knoepfe">
        <button type="button" class="ikon-knopf" id="kreisWeg" aria-label="Auswahl zurücksetzen" title="Zurücksetzen">↺</button>
        <button type="button" class="ikon-knopf glossar-auf" data-glossar="${i}" aria-label="Was heißt das?" title="Was heißt das?">?</button></span>` : "";
    const kopfRechts = kopfKnoepfe || (s.art === "tags" ? `<small class="kopf-hinweis">mehrere möglich</small>` : "");
    let h = `<section class="bogen-seite" data-i="${i}"${i?` aria-hidden="true"`:""}><fieldset><legend${kopfRechts?` class="mit-knoepfen"`:""}><span>${esc(s.label)}</span>${kopfRechts}</legend>`;
    if(s.art === "tags"){
      // Kacheln in zwei Spalten (seit 14.11.2026 statt Chips): Emoji, Wort, Beispiele; Haken oben rechts zeigt die Auswahl
      h += `<div class="tagpick" role="group" aria-label="${esc(s.frage)} Mehrere möglich.">${s.tags().map(([t,e,bsp])=>`<button type="button" class="kachel" data-t="${esc(t)}" aria-pressed="${f.tags.has(t)}"><span class="k-emoji" aria-hidden="true">${e}</span><b>${esc(t)}</b><small>${esc(bsp)}</small></button>`).join("")}</div>`;
    } else if(s.art === "kreis"){
      // Ohne Hinweistext und Ecken-Beschriftung (14.11.2026): die Zeile unter der Karte erklärt, was zu tun ist
      h += `${karteHtml({attr: ` id="karteFeld" tabindex="0" role="group" aria-label="Geschmackskarte: oben bitter, unten mild, links trocken, rechts süß. Mitte = ausgewogen, Rand = sehr ausgeprägt. Mit den Pfeiltasten verschieben." aria-describedby="kreisText"`,
          innen: `<span class="k-punkt" hidden></span><span class="kreis-blase" aria-hidden="true"></span>`})}
        <p class="kreis-text" id="kreisText" aria-live="polite"></p>`;
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
  // Fortschritt seit 14.11.2026 als dünne Linie an der Oberkante der Fußleiste; „3 / 4“ nur noch für Screenreader
  const foot = `<div class="bogen-fuss">
      <div class="fortschritt"><span class="punkte" aria-hidden="true">${BOGEN_SEITEN.map(()=>"<i></i>").join("")}</span><span class="zahl vh"></span></div>
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
  inhalt.querySelectorAll(".tagpick .kachel").forEach(c => c.onclick = () => { const t = c.dataset.t; f.tags.has(t) ? f.tags.delete(t) : f.tags.add(t); c.setAttribute("aria-pressed", String(f.tags.has(t))); });
  inhalt.querySelectorAll("[data-glossar]").forEach(b => b.onclick = () => glossarZeigen(BOGEN_SEITEN[+b.dataset.glossar]));
  const kom = $("#b_kom");
  kom.addEventListener("input", () => { f.kommentar = kom.value; });
  kom.addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); kom.blur(); } });
  kreisVerdrahten(inhalt, f);

  // Wischen: nur eine überwiegend waagerechte Geste über einer Mindestlänge zählt (wie in der Foto-Ansicht, lib/bilder.js),
  // damit ein leicht schräger Tap auf einen Tag nicht blättert. Im Textfeld nie (dort verschiebt man den Cursor) und
  // auf der Geschmackskarte nie (dort zieht man den Punkt).
  let startX = null, startY = null;
  inhalt.addEventListener("touchstart", e => {
    if(e.touches.length !== 1 || e.target.closest("input, textarea, .karte")){ startX = null; return; }
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

/* Geschmackskarte: Tippen setzt den Punkt, Ziehen verschiebt ihn.
   Pfeiltasten verschieben ihn in Schritten. Der Wert steht in f.kreis ({x, y} oder null). */
function kreisVerdrahten(inhalt, f){
  const feld = inhalt.querySelector("#karteFeld");
  if(!feld) return;
  const punkt = feld.querySelector(".k-punkt"), blase = feld.querySelector(".kreis-blase");
  let blaseWeg = null;
  const anzeigen = () => {
    const p = f.kreis;
    punkt.hidden = !p;
    if(p){ punkt.style.left = (50 + p.x*50) + "%"; punkt.style.top = (50 - p.y*50) + "%"; }
    inhalt.querySelector("#kreisText").textContent = kreisText(p);
    // Blase über dem Daumen: der Finger verdeckt den Punkt.
    if(p){
      blase.textContent = kreisText(p);
      // nach ihrer echten Breite eingerückt, damit sie höchstens 8 px über die Karte hinausragt
      const fw = feld.clientWidth, halb = blase.offsetWidth / 2, x = (50 + p.x*50) / 100 * fw;
      blase.style.left = Math.min(fw + 8 - halb, Math.max(halb - 8, x)) + "px";
      // immer über dem Finger – ganz oben ragt sie über die Überschrift (darunter verdeckt sie der Daumen)
      blase.style.top = (50 - p.y*50) + "%";
    } else blase.classList.remove("an");
    inhalt.querySelector("#kreisWeg").hidden = !p;
  };
  const setzen = p => { f.kreis = kreisBegrenzen(p); f.kreisGeloescht = false; anzeigen(); };
  const ausZeiger = e => {
    const r = feld.getBoundingClientRect();
    return {x: ((e.clientX - r.left) / r.width) * 2 - 1, y: 1 - ((e.clientY - r.top) / r.height) * 2};
  };
  let zieht = false;
  feld.addEventListener("pointerdown", e => {
    zieht = true; feld.setPointerCapture(e.pointerId); feld.classList.add("zieht"); setzen(ausZeiger(e)); e.preventDefault();
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
  anzeigen();
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
