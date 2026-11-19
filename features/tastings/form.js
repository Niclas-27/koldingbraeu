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
          naechste() → {label, oeffnen} | null  (optional: nach dem Speichern „Weiter zu Probe X“ anbieten),
          entwurf (optional: localStorage-Schlüssel für den Entwurf, siehe unten),
          startAmUrteil (optional: gleich auf „Dein Urteil“ öffnen, z. B. bei schon bewerteten Bieren)}
   Entwurf (seit 19.11.2026, Gästeansicht): Jede Eingabe wird sofort auf dem Handy gemerkt. Schließt der Gast den Bogen
   versehentlich (✕, Tipp neben das Blatt, Escape) oder lädt die Seite neu, ist beim nächsten Öffnen alles wieder da –
   samt der Seite, auf der er war. Erst erfolgreiches Speichern löscht den Entwurf. Keine Rückfrage beim Schließen. */
function entwurfLesen(schluessel){
  if(!schluessel) return null;
  let e; try{ e = JSON.parse(lsGet(schluessel) || "null"); }catch(_){ return null; }
  if(!e || typeof e !== "object") return null;
  return {
    note: Number.isInteger(e.note) && e.note >= 0 && e.note <= 10 ? e.note : null,
    tags: new Set(Array.isArray(e.tags) ? e.tags.filter(t => typeof t === "string") : []),
    kommentar: typeof e.kommentar === "string" ? e.kommentar.slice(0, 140) : "",
    kreis: e.kreis && typeof e.kreis.x === "number" && typeof e.kreis.y === "number" ? kreisBegrenzen(e.kreis) : null,
    kreisGeloescht: !!e.kreisGeloescht,
    seite: Number.isInteger(e.seite) ? e.seite : 0,
  };
}
function bogenZeigen(opts){
  const alt = opts.alt || {};
  const entwurf = entwurfLesen(opts.entwurf);
  const f = entwurf || { note: alt.note ?? null, tags: new Set(alt.geruch||[]), kommentar: alt.kommentar || "",
              kreis: kreisAusMerkmalen(alt.merkmale), kreisGeloescht: false };
  let seite = 0, hatEntwurf = !!entwurf;
  const letzte = BOGEN_SEITEN.length - 1;
  const merken = () => {
    if(!opts.entwurf) return;
    hatEntwurf = true;
    lsSet(opts.entwurf, JSON.stringify({note: f.note, tags: [...f.tags], kommentar: f.kommentar, kreis: f.kreis,
      kreisGeloescht: f.kreisGeloescht, seite}));
  };

  const seiteHtml = (s, i) => {
    // Geschmacksbild: Glossar und Zurücksetzen als kleine Symbol-Knöpfe in der Überschrift, damit die Karte Platz hat
    const kopfKnoepfe = s.art === "kreis" ? `<span class="kopf-knoepfe">
        <button type="button" class="ikon-knopf" id="kreisWeg" aria-label="Auswahl zurücksetzen" title="Zurücksetzen">↺</button>
        <button type="button" class="ikon-knopf glossar-auf" data-glossar="${i}" aria-label="Was heißt das?" title="Was heißt das?">?</button></span>` : "";
    const kopfRechts = kopfKnoepfe || (s.art === "tags" ? `<small class="kopf-hinweis">mehrere möglich</small>` : "");
    let h = `<section class="bogen-seite" data-i="${i}"${i?` aria-hidden="true"`:""}><fieldset><legend${kopfRechts?` class="mit-knoepfen"`:""}><span>${esc(s.label)}</span>${kopfRechts}</legend>`;
    // Freiwillige Seiten (seit 19.11.2026): sagen, dass sie freiwillig sind, und bieten den Sprung zur Note an –
    // die Reihenfolge Riechen → Schmecken → Geschmacksbild → Urteil bleibt.
    if(s.art !== "urteil") h += `<p class="seite-frei">Freiwillig · <button type="button" class="linkbtn zur-note">direkt zur Note →</button></p>`;
    if(s.art === "tags"){
      // Kacheln in zwei Spalten (seit 14.11.2026 statt Chips): Emoji, Wort, Beispiele; Haken oben rechts zeigt die Auswahl
      h += `<div class="tagpick" role="group" aria-label="${esc(s.frage)} Mehrere möglich.">${s.tags().map(([t,e,bsp])=>`<button type="button" class="kachel" data-t="${esc(t)}" aria-pressed="${f.tags.has(t)}"><span class="k-emoji" aria-hidden="true">${e}</span><b>${esc(t)}</b><small>${esc(bsp)}</small></button>`).join("")}</div>`;
    } else if(s.art === "kreis"){
      // Ohne Hinweistext und Ecken-Beschriftung (14.11.2026): die Zeile unter der Karte erklärt, was zu tun ist
      h += `${karteHtml({attr: ` id="karteFeld" tabindex="0" role="group" aria-label="Geschmackskarte: oben bitter, unten mild, links trocken, rechts süß. Mitte = ausgewogen, Rand = sehr ausgeprägt. Mit den Pfeiltasten verschieben." aria-describedby="kreisText"`,
          innen: `<span class="k-punkt" hidden></span><span class="kreis-blase" aria-hidden="true"></span>`})}
        <p class="kreis-text" id="kreisText" aria-live="polite"></p>`;
    } else {
      // Seit 14.11.2026: fünf Stufen mit Erklärung, Zahlen direkt in der Zeile. Das Textfeld darunter fragt passend zur
      // gewählten Stufe nach („Was hat dir gefehlt?“) und rollt nach der Wahl ins Bild, damit es nicht untergeht.
      const st = f.note == null ? null : noteStufe(f.note);
      h += `<div class="nstufen" role="radiogroup" aria-label="Gesamtnote von 0 bis 10">${NOTE_STUFEN.map(([e,t,d,ns]) =>
          `<div class="nstufe${ns.includes(f.note)?" an":""}"><span class="ns-e" aria-hidden="true">${e}</span><div class="ns-t"><b>${esc(t)}</b><small>${esc(d)}</small></div>
            <div class="ns-n">${ns.map(n=>`<button type="button" role="radio" aria-checked="${f.note===n}" data-n="${n}" aria-label="${n} – ${esc(t)}">${n}</button>`).join("")}</div></div>`).join("")}</div>
        <span class="err" id="bNoteErr" role="alert"></span>
        <label class="note-satz" for="b_kom"><span class="ns-frage" id="noteFrage">${esc(st ? st[4] : "Dein Satz zum Bier")}</span><small>optional – ein Satz reicht</small>
          <input id="b_kom" maxlength="140" value="${esc(f.kommentar)}" placeholder="z. B. „Schmeckt nach Sommer“" autocomplete="off" enterkeyhint="done"></label>`;
    }
    return h + `</fieldset></section>`;
  };

  const body = `${opts.hint?`<p class="hint">${esc(opts.hint)}</p>`:""}${opts.oben||""}
    <div id="bogenInhalt"><div class="bogen-spur">${BOGEN_SEITEN.map(seiteHtml).join("")}</div></div>
    <span class="err" id="bErr" role="alert"></span>`;
  // Fortschritt seit 14.11.2026 als dünne Linie an der Oberkante der Fußleiste; „3 / 4“ nur noch für Screenreader
  const foot = `<div class="bogen-fuss">
      <div class="fortschritt"><span class="punkte" aria-hidden="true">${BOGEN_SEITEN.map(()=>"<i></i>").join("")}</span><span class="zahl vh" aria-live="polite"></span></div>
      <div class="bogen-knoepfe"><button class="btn" id="bZurueck" aria-label="Zurück">←</button><button class="btn primary" id="bWeiter"></button></div>
    </div>`;
  sheet(opts.titel, body, foot, {onClose: opts.geschlossen});   // geschlossen: z. B. Liste neu zeichnen („weitermachen“)

  const inhalt = $("#bogenInhalt"), spur = inhalt.querySelector(".bogen-spur");
  // Ändert sich die sichtbare Seite in der Höhe (Fehlermeldung, Textumbruch, Drehen des Handys), zieht die Höhe nach
  if(window.ResizeObserver){ const ro = new ResizeObserver(() => { if(spur.isConnected) hoeheSetzen(null); else ro.disconnect(); });
    [...spur.children].forEach(c => ro.observe(c)); }
  // Höhe folgt der sichtbaren Seite (seit 19.11.2026): Die Seiten liegen nebeneinander auf einer Spur, sonst wäre der
  // Bogen so hoch wie die höchste Seite – auf kleinen Handys musste man dadurch auf jeder Seite scrollen. Während des
  // Blätterns bleibt kurz die größere der beiden Höhen, damit die hinausgleitende Seite nicht abgeschnitten wird.
  let hoeheZeit = null;
  const hoeheSetzen = (vorher) => {
    const h = spur.children[seite].offsetHeight + 20;   // + padding-top von #bogenInhalt
    clearTimeout(hoeheZeit);
    if(vorher != null && vorher > h){ inhalt.style.height = vorher + "px"; hoeheZeit = setTimeout(() => { inhalt.style.height = h + "px"; }, 300); }
    else inhalt.style.height = h + "px";
  };
  function zeigen(neu){
    const vorher = inhalt.style.height ? parseFloat(inhalt.style.height) : null;
    seite = Math.max(0, Math.min(letzte, neu));
    spur.style.transform = `translateX(${-seite*100}%)`;
    hoeheSetzen(vorher);
    spur.querySelectorAll(".bogen-seite").forEach((el,i) => { el.toggleAttribute("aria-hidden", i!==seite); el.inert = i!==seite; });
    $("#sheetFoot").querySelectorAll(".punkte i").forEach((p,i) => p.classList.toggle("ab", i<=seite));
    // Für Screenreader angesagt (aria-live): welche Seite jetzt zu sehen ist
    $("#sheetFoot").querySelector(".zahl").textContent = `Seite ${seite+1} von ${BOGEN_SEITEN.length}: ${BOGEN_SEITEN[seite].label}`;
    $("#bZurueck").hidden = seite === 0;
    $("#bWeiter").textContent = seite === letzte ? "Speichern" : "Weiter";
    $("#sheetBody").scrollTop = 0;
    if(hatEntwurf) merken();   // Seite mitmerken, aber erst wenn es schon etwas zu merken gibt
  }

  noteVerdrahten(inhalt, f, merken);
  inhalt.querySelectorAll(".tagpick .kachel").forEach(c => c.onclick = () => {
    const t = c.dataset.t;
    if(f.tags.has(t)) f.tags.delete(t);
    else {
      f.tags.add(t);
      // Gegensatz (z. B. leicht ↔ kräftig) abwählen, TAGS_GEGENSAETZE in common.js
      TAGS_GEGENSAETZE.forEach(paar => { if(!paar.includes(t)) return; const g = paar.find(x => x !== t);
        if(f.tags.delete(g)) inhalt.querySelector(`.kachel[data-t="${g}"]`)?.setAttribute("aria-pressed", "false"); });
    }
    c.setAttribute("aria-pressed", String(f.tags.has(t))); merken();
  });
  inhalt.querySelectorAll("[data-glossar]").forEach(b => b.onclick = () => glossarZeigen(BOGEN_SEITEN[+b.dataset.glossar]));
  const kom = $("#b_kom");
  kom.addEventListener("input", () => { f.kommentar = kom.value; merken(); });
  kom.addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); kom.blur(); } });
  kreisVerdrahten(inhalt, f, merken);

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

  inhalt.querySelectorAll(".zur-note").forEach(b => b.onclick = () => zeigen(letzte));   // Seitenwechsel wird per aria-live angesagt
  $("#bZurueck").onclick = () => zeigen(seite - 1);
  $("#bWeiter").onclick = async () => {
    if(seite < letzte){ zeigen(seite + 1); return; }
    // Fehlende Note: Meldung direkt unter den Notenknöpfen (seit 19.11.2026; vorher unter dem Textfeld, weit weg). Kein
    // Fokus auf „0“ mehr – ein nachfolgender Tipp oder Enter hätte sonst versehentlich 0 gewählt.
    if(f.note == null){ const ne = $("#bNoteErr"); ne.textContent = "Bitte eine Note wählen – nur die ist Pflicht.";
      ne.scrollIntoView({block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"}); return; }
    const knopf = $("#bWeiter");
    knopf.disabled = true; knopf.textContent = "Wird gespeichert …"; $("#bErr").textContent = "";
    const merkmale = {...(alt.merkmale || {})};
    if(f.kreis) Object.assign(merkmale, kreisZuMerkmalen(f.kreis));
    else if(f.kreisGeloescht){ delete merkmale.bitter; delete merkmale.suesse; }
    // Auch ein Abbruch (Netz weg) landet als Meldung – vorher blieb der Knopf dann für immer grau (seit 19.11.2026)
    let error;
    try{ ({error} = await opts.speichern({p_note: f.note, p_merkmale: merkmale, p_geruch: [...f.tags], p_fehler: alt.fehler || [],
      p_nochmal: alt.nochmal ?? null, p_kommentar: f.kommentar.trim() || null})); }
    catch(e){ error = e || {}; }
    if(error){ knopf.disabled = false; knopf.textContent = "Speichern"; $("#bErr").textContent = fehlertext(error) + " Deine Eingaben bleiben erhalten."; return; }
    if(opts.entwurf) lsSet(opts.entwurf, null);
    const weiter = opts.naechste && opts.naechste();
    // Letztes offenes Bier (seit 19.11.2026): eigene Abschlussansicht statt nur Toast, wenn der Aufrufer eine liefert
    // (Gäste: abschluss in guest.js). Die Liste dahinter wird sofort neu geladen, „Fertig“ schließt nur noch.
    if(!weiter && opts.abschluss){
      $("#sheetBody").innerHTML = opts.abschluss(f.note);
      if(opts.abschlussTitel) $("#sheetTitle").textContent = opts.abschlussTitel;
      $("#sheetFoot").innerHTML = `<div class="bogen-knoepfe"><button class="btn primary" id="bFertig">Fertig</button></div>`;
      $("#bFertig").onclick = closeSheet;
      $("#bFertig").focus();
      opts.fertig && opts.fertig();
      return;
    }
    if(!weiter){ closeSheet(); toast("Gespeichert"); opts.fertig && opts.fertig(); return; }
    // Gespeichert – direkt zum nächsten noch offenen Bier weiterbieten (kein Wischen zwischen Bieren, siehe README)
    // Gäste (seit 19.11.2026): Zwischenstand mit Kronkorken-Reihe statt Haken in leerer Fläche (opts.zwischenstand)
    $("#sheetBody").innerHTML = opts.zwischenstand ? opts.zwischenstand(f.note)
      : `<div class="bogen-fertig"><span class="haken" aria-hidden="true">✓</span><h3>Gespeichert</h3><p class="hint">Deine Note: <span class="grade ${gradeCls(f.note)}">${f.note}</span></p></div>`;
    $("#sheetFoot").innerHTML = `<div class="bogen-knoepfe"><button class="btn" id="bFertig">Fertig</button><button class="btn primary" id="bNaechste">${esc(weiter.label)} →</button></div>`;
    $("#bFertig").onclick = () => { closeSheet(); opts.fertig && opts.fertig(); };
    $("#bNaechste").onclick = () => { opts.fertig && opts.fertig(); weiter.oeffnen(); };
    $("#bNaechste").focus();
  };
  // Beim Öffnen direkt auf der gemerkten Seite stehen, ohne sichtbar durch die Seiten davor zu gleiten
  spur.style.transition = "none";
  // Start: Entwurf → seine Seite; schon bewertet (opts.startAmUrteil) → gleich „Dein Urteil“, zum Ändern der Note
  zeigen(entwurf ? entwurf.seite : opts.startAmUrteil ? letzte : 0);
  void spur.offsetWidth; spur.style.transition = "";
  if(entwurf) toast("Dein Entwurf ist wieder da");
}

/* Geschmackskarte: Tippen setzt den Punkt, Ziehen verschiebt ihn.
   Pfeiltasten verschieben ihn in Schritten. Der Wert steht in f.kreis ({x, y} oder null). */
function kreisVerdrahten(inhalt, f, geaendert = () => {}){
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
  // Gemerkt wird erst beim Loslassen, nicht bei jeder Bewegung
  const ende = () => { if(!zieht) return; zieht = false; feld.classList.remove("zieht"); geaendert();
    clearTimeout(blaseWeg); blaseWeg = setTimeout(() => blase.classList.remove("an"), 1600); };
  feld.addEventListener("pointerup", ende); feld.addEventListener("pointercancel", ende);
  feld.addEventListener("keydown", e => {
    const d = {ArrowUp:[0,1], ArrowDown:[0,-1], ArrowLeft:[-1,0], ArrowRight:[1,0]}[e.key];
    if(!d) return;
    e.preventDefault();
    const p = f.kreis || {x: 0, y: 0}, schritt = 0.1;
    setzen({x: p.x + d[0]*schritt, y: p.y + d[1]*schritt}); geaendert();
  });
  inhalt.querySelector("#kreisWeg").onclick = () => { f.kreis = null; f.kreisGeloescht = true; anzeigen(); geaendert(); feld.focus(); };
  anzeigen();
}

/* Notenseite: Zahl antippen wählt die Note, markiert die Stufe und stellt die Frage am Textfeld passend; beim ersten
   Wählen rollt das Textfeld ins Bild (ohne Tastatur zu öffnen). Wert in f.note (0–10 oder null). */
function noteVerdrahten(inhalt, f, geaendert = () => {}){
  const knoepfe = [...inhalt.querySelectorAll(".nstufen button")];
  if(!knoepfe.length) return;
  // Optionsgruppe wie gewohnt bedienbar (seit 19.11.2026): nur ein Tab-Stopp (die gewählte Note, sonst die erste),
  // Pfeiltasten wählen die vorige/nächste Note, Pos1/Ende die erste/letzte – vorher 11 Tab-Stopps ohne Pfeiltasten.
  const tabStopp = () => { const an = knoepfe.find(x => x.getAttribute("aria-checked") === "true") || knoepfe[0];
    knoepfe.forEach(x => x.tabIndex = x === an ? 0 : -1); };
  tabStopp();
  inhalt.querySelector(".nstufen").addEventListener("keydown", e => {
    const i = knoepfe.indexOf(document.activeElement); if(i < 0) return;
    const ziel = {ArrowRight: i+1, ArrowDown: i+1, ArrowLeft: i-1, ArrowUp: i-1, Home: 0, End: knoepfe.length-1}[e.key];
    if(ziel == null) return;
    e.preventDefault();
    const b = knoepfe[(ziel + knoepfe.length) % knoepfe.length]; b.click(); b.focus();
  });
  knoepfe.forEach(b => b.onclick = () => {
    const erste = f.note == null;
    f.note = +b.dataset.n; $("#bErr").textContent = ""; $("#bNoteErr").textContent = ""; geaendert();
    knoepfe.forEach(x => x.setAttribute("aria-checked", String(x === b))); tabStopp();
    inhalt.querySelectorAll(".nstufe").forEach(z => z.classList.toggle("an", z.contains(b)));
    inhalt.querySelector("#noteFrage").textContent = noteStufe(f.note)[4];
    if(erste) inhalt.querySelector(".note-satz").scrollIntoView({block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
  });
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
