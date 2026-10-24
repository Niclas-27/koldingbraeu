/* Koldingbräu – Rezepte: Liste (rezepte.html ohne Parameter) */
"use strict";
let rListe = [], rSuche = "";

async function listeZeigen(){
  const {data, error} = await sb.from("rezepte").select("id,name,stil,autor,quelle,ausschlag,sudhausausbeute,stammwuerze,bittere,farbe,alkohol,malze,hopfen,kochzeit,endvergaerungsgrad,oeffentlich,eltern_id,geaendert,bild_foto,bild_etikett").order("name");
  if(error){ rMain().innerHTML = `<p class="empty">${esc(fehlertext(error))}</p>`; return; }
  rListe = data || [];
  let gebraut = new Map();
  if(isBM()){
    const s = await sb.from("sude").select("rezept_id").not("rezept_id", "is", null);
    (s.data || []).forEach(x => gebraut.set(x.rezept_id, (gebraut.get(x.rezept_id) || 0) + 1));
  }
  rMain().innerHTML = `
    <div class="vk-head"><div><h2>Rezepte</h2><p class="hint">${isBM() ? "Importiere Rezepte von maischemalzundmehr.de, rechne sie auf eure Anlage um und braue daraus einen Sud." : "Rezepte von Koldingbräu."}</p></div>
      ${isBM() ? `<div class="top-actions"><button class="btn" id="anlageBtn">Anlagenprofil</button><button class="btn" id="importBtn">Importieren</button><button class="btn primary" id="neuRezeptBtn">+ Neues Rezept</button></div>` : ""}</div>
    ${isBM() ? `<label class="dropzone" id="dropzone"><input type="file" id="importDatei" accept=".json,application/json" hidden>
        <b>JSON-Datei hierher ziehen</b> oder <span class="linkbtn">auswählen</span><small>Export von maischemalzundmehr.de (⋮ → Export JSON)</small></label>` : ""}
    ${rListe.length > 4 ? `<input class="search" id="rzSuche" type="search" autocomplete="off" placeholder="Suchen: Name, Stil, Malz, Hopfen …" aria-label="Rezepte durchsuchen" value="${esc(rSuche)}">` : ""}
    <div class="rz-cards" id="rzKarten"></div>`;
  karten(gebraut);
  const s = $("#rzSuche"); if(s) s.oninput = () => { rSuche = s.value; karten(gebraut); };
  if(isBM()){
    $("#neuRezeptBtn").onclick = () => rezeptForm(null);
    $("#importBtn").onclick = () => $("#importDatei").click();
    $("#anlageBtn").onclick = anlageForm;
    importVerdrahten($("#importDatei"), $("#dropzone"));
  }
}
function karten(gebraut){
  const q = rSuche.trim().toLowerCase();
  const liste = rListe.filter(r => !q || JSON.stringify([r.name, r.stil, r.autor, r.malze, r.hopfen]).toLowerCase().includes(q));
  $("#rzKarten").innerHTML = !rListe.length
    ? `<p class="empty">${isBM() ? "Noch keine Rezepte. Zieh eine JSON-Datei von maischemalzundmehr.de hierher oder leg eins neu an." : "Noch keine öffentlichen Rezepte."}</p>`
    : !liste.length ? `<p class="empty">Kein Rezept passt zu dieser Suche.</p>`
    : liste.map(r => { const k = B.kennwerte(r); const n = gebraut.get(r.id) || 0; return `<a class="rz-card" href="rezepte.html?id=${esc(r.id)}">
        ${rezeptBild(r, k)}
        <span class="st">${esc(r.stil || "Ohne Stil")}</span>
        <b class="nm">${esc(r.name)}</b>
        <span class="mini num">${esc([zf(r.stammwuerze ?? k.stammwuerze) + " °P", zf(r.bittere ?? k.bittere, 0) + " IBU", zf(r.farbe ?? k.farbe, 0) + " EBC", zf(r.alkohol ?? k.alkohol) + " %"].join(" · "))}</span>
        <span class="ft">${esc([r.autor, r.ausschlag ? zf(r.ausschlag) + " l" : ""].filter(Boolean).join(" · "))}${n ? ` · <b>${n}× gebraut</b>` : ""}${isBM() && !r.oeffentlich ? ` <span class="lock">intern</span>` : ""}</span>
      </a>`; }).join("");
}

/* Anlagenprofil – alle Braumeister sehen es, nur der Admin ändert */
function anlageForm(){
  const a = anlage || {};
  const ro = !isAdmin();
  sheet("Anlagenprofil " + (a.name || ""), `<form id="anlForm" class="stack" novalidate>
      <p class="hint">Mit diesen Werten werden Rezepte auf eure Anlage umgerechnet: Die Schüttung passt sich an eure Sudhausausbeute an, der Nachguss an eure Verdampfung.${ro ? " Ändern kann sie der Admin." : ""}</p>
      <div class="grid2">
        <label class="f" for="an_sha">Sudhausausbeute (%)<input id="an_sha" type="number" step="0.5" min="30" max="95" value="${esc(a.sudhausausbeute ?? "")}"${ro ? " disabled" : ""}></label>
        <label class="f" for="an_verd">Verdampfung (Liter je Stunde)<input id="an_verd" type="number" step="0.1" min="0" max="20" value="${esc(a.verdampfung ?? "")}"${ro ? " disabled" : ""}></label>
        <label class="f" for="an_menge">Übliche Ausschlagwürze (Liter)<input id="an_menge" type="number" step="0.5" min="1" max="500" value="${esc(a.standard_menge ?? "")}"${ro ? " disabled" : ""}></label>
      </div>
      <label class="f" for="an_notiz">Notiz<textarea id="an_notiz" maxlength="1000"${ro ? " disabled" : ""}>${esc(a.notiz || "")}</textarea></label>
      <span class="err" id="anErr"></span>
    </form>`,
    `<span class="spacer"></span><button class="btn" id="anZu">${ro ? "Schließen" : "Abbrechen"}</button>${ro ? "" : `<button class="btn primary" id="anSave" form="anlForm" type="submit">Speichern</button>`}`);
  $("#anZu").onclick = closeSheet;
  if(ro) return;
  $("#anlForm").onsubmit = async e => { e.preventDefault();
    const out = {sudhausausbeute: B.zahl($("#an_sha").value), verdampfung: B.zahl($("#an_verd").value), standard_menge: B.zahl($("#an_menge").value), notiz: $("#an_notiz").value.trim() || null, geaendert: new Date().toISOString()};
    if(out.sudhausausbeute == null || out.verdampfung == null || out.standard_menge == null){ $("#anErr").textContent = "Bitte alle drei Werte eintragen."; return; }
    $("#anSave").disabled = true;
    const {data, error} = await sb.from("anlagen").update(out).eq("id", a.id).select().single();
    if(error){ $("#anSave").disabled = false; $("#anErr").textContent = fehlertext(error); return; }
    anlage = data; closeSheet(); toast("Anlagenprofil gespeichert"); if(rezeptId) detailZeigen();
  };
}
