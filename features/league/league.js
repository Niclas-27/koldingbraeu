/* Koldingbräu – Seite „Liga“
   Öffentliche Rangliste aller Biere aus abgeschlossenen Verkostungen (liga.html).
   Grundlage ist allein die Gesamtnote (Durchschnitt über alle Bewertungen); gefiltert wird im Browser.
   Jedes Bier verlinkt auf seine eigene Detailseite (liga.html?bier=<uuid>) mit Durchschnittswerten,
   Kommentaren und Bildern aus allen Verkostungen, bei denen es dabei war. */
(function () {
"use strict";
const {$, esc, fmtZahl, fehlertext, lsGet, lsSet, sec, gradeCls} = KB;
const MIN = 3; // ab so vielen Bewertungen zählt ein Bier für die Liga

// Gleiche Merkmale wie im Bewertungsbogen (features/tastings/common.js) – hier dupliziert, weil
// liga.html den Bereich „Verkostungen“ nicht lädt. Für die Beschriftung des Geschmacksprofils.
const MERKMALE = [
  ["Aussehen", [["farbe","Farbe","hell","dunkel"],["klarheit","Klarheit","klar","trüb"],["schaum","Schaum","wenig","viel"]]],
  ["Geruch", [["intensitaet","Intensität","schwach","kräftig"]]],
  ["Geschmack", [["bitter","Bittere","mild","bitter"],["suesse","Süße","süß","trocken"],["malzhopfen","Betonung","malzig","hopfig"]]],
  ["Mundgefühl", [["koerper","Körper","schlank","vollmundig"],["kohlensaeure","Kohlensäure","wenig","spritzig"],["abgang","Abgang","kurz","lang"]]],
];

let zeilen = null;  // eine Zeile je Bier und Verkostung
const f = { stil: "", herkunft: "alle", jahr: "", alle: false };
try { Object.assign(f, JSON.parse(lsGet("kb_liga") || "{}")); } catch(_) {}

function zusammenfassen(){
  const m = new Map();
  zeilen.forEach(z => {
    if(f.stil && z.stil !== f.stil) return;
    if(f.herkunft === "eigen" && !z.eigen) return;
    if(f.herkunft === "fremd" && z.eigen) return;
    if(f.jahr && String(z.datum).slice(0,4) !== f.jahr) return;
    const b = m.get(z.bier_id) || {id: z.bier_id, name: z.name, brauerei: z.brauerei, eigen: z.eigen, stil: z.stil, bild_kronkorken: z.bild_kronkorken, bild_flasche: z.bild_flasche, summe: 0, anzahl: 0, nochmal: 0, verkostungen: 0};
    b.summe += +z.summe; b.anzahl += +z.anzahl; b.nochmal += +z.nochmal; b.verkostungen++;
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

  const zeile = (b, platz) => `<li class="${platz && platz <= 3 ? "top p"+platz : ""}${platz ? "" : " wenig"}">
      <a href="liga.html?bier=${esc(b.id)}">
      <span class="pl num">${platz ? platz+"." : "–"}</span>
      <span class="nm mit-bild">${Bilder.bier(b)}<span><b>${esc(b.name)}</b><small>${esc([b.brauerei, b.stil].filter(Boolean).join(" · "))}</small></span></span>
      <span class="sc"><b class="num ${gradeCls(b.schnitt)}">${fmtZahl(b.schnitt, 1)}</b></span>
      <small class="mt">${b.anzahl} Bewertungen · ${b.verkostungen} ${b.verkostungen===1?"Verkostung":"Verkostungen"} · ${Math.round(b.nochmal / b.anzahl * 100)} % nochmal</small>
      <span class="bar"><i class="${gradeCls(b.schnitt)}" style="width:${Math.round(b.schnitt * 10)}%"></i></span>
      </a>
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
}

/* ---------- Bier-Detailseite (liga.html?bier=<uuid>) ---------- */
const tags = o => Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([t,n])=>`<span class="tag">${esc(t)}${n>1?` ${n}×`:""}</span>`).join(" ");
const profil = merkmale => MERKMALE.flatMap(([,l])=>l).filter(([k]) => merkmale[k]).map(([k,label,l,r]) =>
  `<div class="pf"><span class="pf-l">${esc(l)}</span><span class="pf-t"><i style="left:${merkmale[k].wert*10}%"></i></span><span class="pf-r">${esc(r)}</span><small class="pf-n">${esc(label)}</small></div>`).join("");

async function zeigeDetail(bierId){
  $("#liga").innerHTML = `<p><a class="back" href="liga.html">← Zur Liga</a></p><p class="empty">Wird geladen …</p>`;
  const {data, error} = await KB.sb.rpc("bier_detail", {p_id: bierId});
  if(error){ $("#liga").innerHTML = `<p><a class="back" href="liga.html">← Zur Liga</a></p><p class="empty">${esc(fehlertext(error))}</p>`; return; }
  const b = data.bier;
  document.title = b.name + " · Koldingbräu";
  const kennzahlen = `<div class="kws">
      <div class="kw"><span>Schnitt</span><b class="num ${gradeCls(data.schnitt)}">${data.schnitt!=null?fmtZahl(data.schnitt,1):"–"}</b></div>
      <div class="kw"><span>Bewertungen</span><b class="num">${data.anzahl||0}</b></div>
      <div class="kw"><span>Nochmal</span><b class="num">${data.anzahl?Math.round(data.nochmal/data.anzahl*100):"–"}</b><small>${data.anzahl?"%":""}</small></div>
      <div class="kw"><span>Alkohol</span><b class="num">${b.alkohol!=null?fmtZahl(b.alkohol,1):"–"}</b><small>${b.alkohol!=null?"% Vol.":""}</small></div>
    </div>`;
  const header = `<header class="bier-kopf">
      ${Bilder.bier(b,"gross")}
      <p class="kicker">${esc([b.brauerei, b.stil].filter(Boolean).join(" · ") || "Bier")}</p>
      <h2>${esc(b.name)}</h2>
      ${kennzahlen}
      ${b.eigen?`<div class="tags"><span class="tag pub">Koldingbräu</span></div>`:""}
    </header>`;
  const bilder = Bilder.bierFotos(b);
  const hatWerte = data.anzahl > 0;
  const body = `<p class="noprint"><a class="back" href="liga.html">← Zur Liga</a></p>
    <article class="bier-blatt">
      ${header}
      ${bilder?sec("Bilder", bilder):""}
      ${hatWerte ? `
        ${profil(data.merkmale)?sec("Geschmacksprofil", profil(data.merkmale)):""}
        ${Object.keys(data.geruch).length?sec("Geruch", `<p>${tags(data.geruch)}</p>`):""}
        ${Object.keys(data.fehler).length?sec("Fehlaromen", `<p>${tags(data.fehler)}</p>`):""}
        ${data.kommentare.length?sec("Was gesagt wurde", `<ul class="zitate">${data.kommentare.map(k=>`<li>${esc(k)}</li>`).join("")}</ul>`):""}
      ` : `<p class="empty">Für dieses Bier gibt es noch keine Bewertungen aus abgeschlossenen Verkostungen.</p>`}
      ${sec("Verkostet bei", data.verkostungen.length?`<ul class="abende">${data.verkostungen.map(v=>`<li>
          <a href="verkostung.html?e=${esc(v.id)}">${esc(v.titel)}</a><small>${esc(KB.fmtDateLong(String(v.datum)))}</small>
          <span class="num ${gradeCls(v.schnitt)}">${v.schnitt!=null?fmtZahl(v.schnitt,1):"–"}</span><small>${v.anzahl} Bew.</small></li>`).join("")}</ul>`:`<p class="empty">Noch keine Verkostung.</p>`)}
    </article>`;
  $("#liga").innerHTML = body;
  Bilder.bierFotosVerdrahten($("#liga"));
}

KB.seite = {
  async laden(){
    const bierId = new URLSearchParams(location.search).get("bier");
    if(bierId){ await zeigeDetail(bierId); return; }
    if(!zeilen){
      const {data, error} = await KB.sb.rpc("liga_daten");
      if(error){ $("#liga").innerHTML = `<p class="empty">${esc(fehlertext(error))}</p>`; return; }
      zeilen = data || [];
    }
    zeigen();
  },
};
})();
