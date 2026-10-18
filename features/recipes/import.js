/* Koldingbräu – Rezepte: Import einer JSON-Datei von maischemalzundmehr.de mit Vorschau */
"use strict";

function importVerdrahten(input, zone){
  input.onchange = () => { if(input.files[0]) dateiLesen(input.files[0]); input.value = ""; };
  ["dragenter", "dragover"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add("ueber"); }));
  ["dragleave", "drop"].forEach(ev => zone.addEventListener(ev, () => zone.classList.remove("ueber")));
  zone.addEventListener("drop", e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if(f) dateiLesen(f); });
  // Datei, die neben die Zone fällt, soll den Browser nicht wegnavigieren
  window.addEventListener("dragover", e => e.preventDefault());
  window.addEventListener("drop", e => { if(!zone.contains(e.target)){ e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if(f) dateiLesen(f); } });
}

function dateiLesen(datei){
  if(datei.size > 2 * 1024 * 1024){ toast("Die Datei ist zu groß für ein Rezept."); return; }
  const fr = new FileReader();
  fr.onload = () => {
    let j;
    try{ j = JSON.parse(String(fr.result).replace(/^﻿/, "")); }catch(_){ importFehler("Die Datei ist kein gültiges JSON."); return; }
    try{ const {rezept, hinweise} = B.ausMMuM(j); importVorschau(rezept, hinweise); }
    catch(e){ importFehler(e.message); }
  };
  fr.onerror = () => importFehler("Die Datei konnte nicht gelesen werden.");
  fr.readAsText(datei, "utf-8");
}
function importFehler(t){
  sheet("Import nicht möglich", `<p>${esc(t)}</p><p class="hint">Auf maischemalzundmehr.de beim Rezept oben rechts auf ⋮ → „Export JSON“ klicken und die heruntergeladene Datei hier verwenden.</p>`,
    `<span class="spacer"></span><button class="btn" id="ifZu">Schließen</button>`);
  $("#ifZu").onclick = closeSheet;
}

async function importVorschau(r, hinweise){
  const k = B.kennwerte(r);
  const doppelt = (rListe || []).find(x => x.name.toLowerCase() === r.name.toLowerCase());
  const hopfen = r.hopfen.filter(h => h.typ !== "Stopfen"), stopf = r.hopfen.filter(h => h.typ === "Stopfen");
  sheet("Rezept importieren", `<form id="impForm" class="stack" novalidate>
      <label class="f" for="imp_name">Name<input id="imp_name" maxlength="100" value="${esc(r.name)}"></label>
      ${doppelt ? `<p class="hint">Es gibt schon ein Rezept „${esc(doppelt.name)}“. Gib dem neuen einen eigenen Namen oder importiere es trotzdem.</p>` : ""}
      <label class="f" for="imp_aus">Gilt für Liter Ausschlagwürze<input id="imp_aus" type="number" step="0.5" min="1" inputmode="decimal" value="${esc(r.ausschlag ?? "")}"></label>
      <label class="check"><input type="checkbox" id="imp_pub"><span><b>Öffentlich zeigen</b></span></label>
      ${hinweise.length ? `<ul class="hinweise">${hinweise.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    </form>
    <section class="sec"><h3>Vorschau</h3>
      <p><b>${esc(r.stil || "Ohne Stil")}</b>${r.autor ? " · " + esc(r.autor) : ""}</p>
      ${kopfwerte(r, k)}
      <dl class="kv">
        <div><dt>Schüttung</dt><dd>${r.malze.map(m => esc(`${m.name} ${B.fmtGramm(m.gramm)}`)).join("<br>") || "–"}</dd></div>
        <div><dt>Maischplan</dt><dd>${esc([r.einmaischtemperatur != null ? `Einmaischen ${zf(r.einmaischtemperatur)} °C` : "", ...r.rasten.map(x => `${zf(x.temperatur)} °C ${zf(x.zeit, 0)} min`), r.abmaischtemperatur != null ? `Abmaischen ${zf(r.abmaischtemperatur)} °C` : ""].filter(Boolean).join(" · ")) || "–"}</dd></div>
        <div><dt>Hopfen</dt><dd>${hopfen.map(h => esc(`${h.sorte} ${B.fmtGramm(h.gramm)} (${TYP_LABEL[h.typ]}${h.typ === "Kochen" && h.zeit != null ? " " + h.zeit + " min" : ""})`)).join("<br>") || "–"}</dd></div>
        ${stopf.length ? `<div><dt>Stopfhopfen</dt><dd>${stopf.map(h => esc(`${h.sorte} ${B.fmtGramm(h.gramm)}`)).join("<br>")}</dd></div>` : ""}
        <div><dt>Hefe</dt><dd>${esc(r.hefe || "–")}</dd></div>
      </dl>
    </section>`,
    `<span class="err" id="impErr"></span><span class="spacer"></span><button class="btn" id="impAbbr">Abbrechen</button><button class="btn primary" id="impSave" form="impForm" type="submit">Rezept anlegen</button>`);
  $("#impAbbr").onclick = closeSheet;
  $("#impForm").onsubmit = async e => { e.preventDefault();
    const name = $("#imp_name").value.trim(), aus = B.zahl($("#imp_aus").value);
    if(!name){ $("#impErr").textContent = "Bitte einen Namen eingeben."; return; }
    if(!aus || aus <= 0){ $("#impErr").textContent = "Bitte die Ausschlagwürze angeben, für die das Rezept gilt."; $("#imp_aus").focus(); return; }
    const out = {...r, name, ausschlag: aus, oeffentlich: $("#imp_pub").checked};
    $("#impSave").disabled = true;
    const {data, error} = await sb.from("rezepte").insert(out).select("id").single();
    if(error){ $("#impSave").disabled = false; $("#impErr").textContent = fehlertext(error); return; }
    closeSheet(); toast("Rezept importiert"); location.href = "rezepte.html?id=" + data.id;
  };
}
