/* Koldingbräu – Seite „Liga“
   Öffentliche Rangliste aller Biere aus abgeschlossenen Verkostungen.
   Grundlage ist allein die Gesamtnote (Durchschnitt über alle Bewertungen); gefiltert wird im Browser.
   Jedes Bier klappt auf und verlinkt auf die Ergebnisseiten der Verkostungen, bei denen es dabei war. */
(function () {
"use strict";
const {$, esc, fmtZahl, fehlertext, lsGet, lsSet} = KB;
const MIN = 3; // ab so vielen Bewertungen zählt ein Bier für die Liga

let zeilen = null;  // eine Zeile je Bier und Verkostung
const offen = new Set();  // aufgeklappte Biere
let springen = null;      // Bier aus dem Link (#bier=…), zu dem gescrollt wird
const f = { stil: "", herkunft: "alle", jahr: "", alle: false };
try { Object.assign(f, JSON.parse(lsGet("kb_liga") || "{}")); } catch(_) {}

function zusammenfassen(){
  const m = new Map();
  zeilen.forEach(z => {
    if(f.stil && z.stil !== f.stil) return;
    if(f.herkunft === "eigen" && !z.eigen) return;
    if(f.herkunft === "fremd" && z.eigen) return;
    if(f.jahr && String(z.datum).slice(0,4) !== f.jahr) return;
    const b = m.get(z.bier_id) || {id: z.bier_id, name: z.name, brauerei: z.brauerei, eigen: z.eigen, stil: z.stil, summe: 0, anzahl: 0, nochmal: 0, verkostungen: 0, abende: []};
    b.summe += +z.summe; b.anzahl += +z.anzahl; b.nochmal += +z.nochmal; b.verkostungen++;
    b.abende.push(z);
    m.set(z.bier_id, b);
  });
  const liste = [...m.values()].map(b => ({...b, schnitt: b.summe / b.anzahl}));
  liste.sort((a,b) => b.schnitt - a.schnitt || b.nochmal/b.anzahl - a.nochmal/a.anzahl || b.anzahl - a.anzahl || a.name.localeCompare(b.name, "de"));
  return liste;
}

function zeigen(){
  lsSet("kb_liga", JSON.stringify(f));
  const stile = [...new Set(zeilen.map(z => z.stil).filter(Boolean))].sort((a,b) => a.localeCompare(b, "de"));
  if(f.stil && !stile.includes(f.stil)) f.stil = "";
  const jahre = [...new Set(zeilen.map(z => String(z.datum).slice(0,4)))].sort().reverse();
  if(f.jahr && !jahre.includes(f.jahr)) f.jahr = "";
  const alle = zusammenfassen();
  const drin = alle.filter(b => b.anzahl >= MIN), wenig = alle.filter(b => b.anzahl < MIN);

  const zeile = (b, platz) => `<li id="bier-${esc(b.id)}" class="${platz && platz <= 3 ? "top p"+platz : ""}${platz ? "" : " wenig"}">
      <details data-b="${esc(b.id)}"${offen.has(b.id)?" open":""}><summary>
      <span class="pl num">${platz ? platz+"." : "–"}</span>
      <span class="nm"><b>${esc(b.name)}</b><small>${esc([b.brauerei, b.stil].filter(Boolean).join(" · "))}</small></span>
      <span class="sc"><b class="num">${fmtZahl(b.schnitt, 2)}</b></span>
      <small class="mt">${b.anzahl} Bewertungen · ${b.verkostungen} ${b.verkostungen===1?"Verkostung":"Verkostungen"} · ${Math.round(b.nochmal / b.anzahl * 100)} % nochmal</small>
      <span class="bar"><i style="width:${Math.round(b.schnitt * 10)}%"></i></span>
      </summary>
      <div class="erg-detail"><h4>Verkostet bei</h4><ul class="abende">${b.abende.slice().sort((x,y)=>String(y.datum).localeCompare(String(x.datum))).map(z => `<li>
        <a href="verkostung.html?e=${esc(z.verkostung_id)}">${esc(z.titel)}</a><small>${esc(KB.fmtDateLong(String(z.datum)))}</small>
        <span class="num">${fmtZahl(z.summe / z.anzahl, 1)}</span><small>${z.anzahl} Bew.</small></li>`).join("")}</ul></div>
      </details>
    </li>`;
  let platz = 0, vorher = null;
  const rang = drin.map((b, i) => { const k = b.schnitt.toFixed(4); if(k !== vorher){ platz = i + 1; vorher = k; } return zeile(b, platz); }).join("");

  $("#liga").innerHTML = `
    <section class="controls" aria-label="Filter">
      <select class="sort" id="lgHerkunft" aria-label="Herkunft">
        <option value="alle"${f.herkunft==="alle"?" selected":""}>Alle Biere</option>
        <option value="eigen"${f.herkunft==="eigen"?" selected":""}>Nur Koldingbräu</option>
        <option value="fremd"${f.herkunft==="fremd"?" selected":""}>Nur andere Brauereien</option>
      </select>
      <select class="sort" id="lgJahr" aria-label="Zeitraum"><option value="">Alle Jahre</option>${jahre.map(j => `<option${f.jahr===j?" selected":""}>${j}</option>`).join("")}</select>
      <div class="chips" id="lgStile">${[["", "Alle Stile"]].concat(stile.map(s => [s, s])).map(([v, l]) => `<button class="chip" data-s="${esc(v)}" aria-pressed="${f.stil===v}">${esc(l)}</button>`).join("")}</div>
    </section>
    ${drin.length ? `<ol class="rank liga erg">${rang}</ol>` : `<p class="empty">${alle.length ? `Noch kein Bier hat ${MIN} Bewertungen${f.stil||f.jahr||f.herkunft!=="alle"?" in dieser Auswahl":""}.` : zeilen.length ? "Für diese Auswahl gibt es noch keine Bewertungen." : "Sobald die erste Verkostung abgeschlossen ist, steht hier die Rangliste."}</p>`}
    ${wenig.length ? `<label class="check"><input type="checkbox" id="lgAlle"${f.alle?" checked":""}><span>Auch Biere mit weniger als ${MIN} Bewertungen zeigen (${wenig.length})</span></label>
      ${f.alle ? `<ol class="rank liga erg">${wenig.map(b => zeile(b, 0)).join("")}</ol>` : ""}` : ""}
    <p class="hint">Gewertet wird die Gesamtnote (0–10) aus allen abgeschlossenen Verkostungen. In die Liga kommt ein Bier ab ${MIN} Bewertungen; bei gleichem Schnitt entscheidet, wie viele es nochmal trinken würden.</p>`;

  $("#lgHerkunft").onchange = e => { f.herkunft = e.target.value; zeigen(); };
  $("#lgJahr").onchange = e => { f.jahr = e.target.value; zeigen(); };
  $("#lgStile").querySelectorAll(".chip").forEach(c => c.onclick = () => { f.stil = c.dataset.s; zeigen(); });
  const a = $("#lgAlle"); if(a) a.onchange = () => { f.alle = a.checked; zeigen(); };
  $("#liga").querySelectorAll("details[data-b]").forEach(d => d.addEventListener("toggle", () => { d.open ? offen.add(d.dataset.b) : offen.delete(d.dataset.b); }));
  if(springen){ const el = document.getElementById("bier-"+springen); springen = null; if(el) setTimeout(() => el.scrollIntoView({block:"center", behavior:"smooth"}), 50); }
}

KB.seite = {
  async laden(){
    if(!zeilen){
      const {data, error} = await KB.sb.rpc("liga_daten");
      if(error){ $("#liga").innerHTML = `<p class="empty">${esc(fehlertext(error))}</p>`; return; }
      zeilen = data || [];
      const m = location.hash.match(/bier=([0-9a-f-]{36})/);
      if(m && zeilen.some(z => z.bier_id === m[1])){
        const z = zeilen.find(z => z.bier_id === m[1]);
        Object.assign(f, {stil: "", herkunft: "alle", jahr: ""});
        if(zeilen.filter(x => x.bier_id === z.bier_id).reduce((a,x)=>a + +x.anzahl, 0) < MIN) f.alle = true;
        offen.add(m[1]); springen = m[1];
      }
    }
    zeigen();
  },
};
})();
