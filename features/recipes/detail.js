/* Koldingbräu – Rezepte: Rezeptseite (rezepte.html?id=<uuid>)
   Aufbau wie bei maischemalzundmehr.de: Kopfwerte, „für [x] Liter Ausschlagwürze“, Brauwasser, Schüttung, Maischplan,
   Würzekochen mit änderbarem Alphawert, Gärung. Dazu Stammbaum (abgeleitet von, Varianten, gebraut als). */
"use strict";
let R = null;                                    // das Rezept, wie gespeichert
let sicht = { ziel: null, mitAnlage: false, alpha: {} };
let baum = { eltern: null, kinder: [], sude: [], ausSud: null };

async function detailLaden(){
  const {data, error} = await sb.from("rezepte").select("*").eq("id", rezeptId).maybeSingle();
  if(error || !data){ rMain().innerHTML = `<p><a class="back" href="rezepte.html">← Alle Rezepte</a></p><p class="empty">${error ? esc(fehlertext(error)) : "Dieses Rezept gibt es nicht oder es ist nicht öffentlich."}</p>`; return; }
  R = data;
  if(sicht.ziel == null){
    sicht.ziel = R.ausschlag || anlage?.standard_menge || 20;
    sicht.mitAnlage = false;
  }
  const [eltern, kinder, sude, ausSud] = await Promise.all([
    R.eltern_id ? sb.from("rezepte").select("id,name").eq("id", R.eltern_id).maybeSingle() : {data: null},
    sb.from("rezepte").select("id,name").eq("eltern_id", R.id).order("angelegt"),
    sb.rpc("rezept_sude", {p_rezept: R.id}),
    R.aus_sud_id && isBM() ? sb.from("sude").select("id,nr,stil,datum").eq("id", R.aus_sud_id).maybeSingle() : {data: null},
  ]);
  baum = { eltern: eltern.data, kinder: kinder.data || [], sude: sude.data || [], ausSud: ausSud.data };
  document.title = R.name + " · Koldingbräu";
  detailZeigen();
}

function aktuell(){ return B.umrechnen(R, { ziel: sicht.ziel, anlage: sicht.mitAnlage ? anlage : null, alpha: sicht.alpha }); }

function detailZeigen(){
  const u = aktuell();
  const k = B.kennwerte(u, sicht.mitAnlage && anlage ? anlage.sudhausausbeute : undefined);
  const gesamtMalz = u.malze.reduce((a, m) => a + (m.gramm || 0), 0);
  const koch = u.hopfen.map((h, i) => ({...h, i})).filter(h => h.typ !== "Stopfen");
  const stopf = u.hopfen.map((h, i) => ({...h, i})).filter(h => h.typ === "Stopfen");
  const anlageMoeglich = anlage && R.sudhausausbeute;
  const geaendert = sicht.ziel !== R.ausschlag || sicht.mitAnlage || Object.keys(sicht.alpha).length;

  const zeile = (l, r, cls) => `<div class="rz-row${cls ? " " + cls : ""}"><span>${l}</span><span class="num">${r}</span></div>`;
  let h = `<p class="noprint"><a class="back" href="rezepte.html">← Alle Rezepte</a></p>
  <article class="rz-blatt">
    ${R.bild_foto ? `<img class="titelbild rz-foto" id="rzFoto" src="${esc(Bilder.url(R.bild_foto))}" alt="Foto: ${esc(R.name)}">` : ""}
    <header class="rz-kopf">
      ${R.bild_etikett ? `<button type="button" class="rz-etikett" id="rzEtikett" aria-label="Etikett groß zeigen">${rezeptBild({...R, bild_foto: null}, k, true)}</button>` : R.bild_foto ? "" : rezeptBild(R, k, true)}
      <p class="kicker">${esc(R.stil || "Rezept")}</p>
      <h2>${esc(R.name)}</h2>
      <p class="hint">${esc([R.autor && "Autor: " + R.autor, R.quelle].filter(Boolean).join(" · "))}${isBM() ? (R.oeffentlich ? ` <span class="tag pub">öffentlich</span>` : ` <span class="tag intern">intern</span>`) : ""}</p>
      ${kopfwerte(R, k)}
      ${R.beschreibung ? `<p class="rz-beschr">${esc(R.beschreibung)}</p>` : ""}
      <div class="rz-skala noprint">
        <label for="zielMenge">für</label>
        <input id="zielMenge" type="number" min="1" max="500" step="0.5" value="${esc(sicht.ziel)}" inputmode="decimal">
        <span>Liter Ausschlagwürze</span>
        ${anlage ? `<label class="check klein"><input type="checkbox" id="mitAnlage"${sicht.mitAnlage ? " checked" : ""}${anlageMoeglich ? "" : " disabled"}><span>auf Anlage ${esc(anlage.name)} (${zf(anlage.sudhausausbeute)} % Ausbeute)</span></label>` : ""}
        ${geaendert ? `<button class="linkbtn" id="zurueck">Originalwerte</button>` : ""}
      </div>
      ${anlage && !R.sudhausausbeute ? `<p class="hint noprint">Das Rezept nennt keine Sudhausausbeute – auf eure Anlage kann nur die Menge umgerechnet werden.</p>` : ""}
      ${geaendert ? `<p class="hint">Umgerechnet für ${zf(sicht.ziel)} l${sicht.mitAnlage ? `, Schüttung für ${zf(anlage.sudhausausbeute)} % statt ${zf(R.sudhausausbeute)} % Ausbeute` : ""}${Object.keys(sicht.alpha).length ? ", Hopfen auf euren Alphawert" : ""} – Stammwürze, Bittere und Farbe bleiben wie im Rezept.</p>` : ""}
      ${R.stammwuerze != null ? `<p class="hint noprint" title="Eigene Nachrechnung aus den Zutaten: Stammwürze aus Schüttung und Sudhausausbeute, Bittere nach Tinseth, Farbe als Faustformel">Nachgerechnet: ${esc([zf(k.stammwuerze) + " °P", zf(k.bittere, 0) + " IBU", zf(k.farbe, 0) + " EBC", zf(k.alkohol) + " %"].join(" · "))}</p>` : ""}
    </header>

    ${(u.hauptguss != null || u.nachguss != null) ? `<section class="rz-sec"><h3>Brauwasser</h3>
      ${u.hauptguss != null ? zeile("Hauptguss", zf(u.hauptguss) + " l") : ""}${u.nachguss != null ? zeile("Nachguss", zf(u.nachguss) + " l") : ""}
      ${u.hauptguss != null && u.nachguss != null ? zeile("Gesamt", zf(u.hauptguss + u.nachguss) + " l", "summe") : ""}
      ${sicht.mitAnlage && anlage ? `<p class="hint">Nachguss passend zu ${zf(anlage.verdampfung)} l/h Verdampfung (Näherung).</p>` : ""}</section>` : ""}

    <section class="rz-sec"><h3>Schüttung</h3>
      ${u.malze.map(m => `<div class="rz-malz"><span>${esc(m.name)}${m.ebc != null ? ` <small>${zf(m.ebc)} EBC</small>` : ""}</span><span class="num">${B.fmtGramm(m.gramm)} <small>(${gesamtMalz ? zf(m.gramm / gesamtMalz * 100) : 0} %)</small></span><i style="width:${gesamtMalz ? m.gramm / gesamtMalz * 100 : 0}%"></i></div>`).join("") || `<p class="hint">Keine Malze eingetragen.</p>`}
      ${u.malze.length ? zeile("Gesamt", B.fmtGramm(gesamtMalz), "summe") : ""}</section>

    ${(u.rasten.length || u.einmaischtemperatur) ? `<section class="rz-sec"><h3>Maischplan${u.maischform && u.maischform !== "infusion" ? " · " + esc(u.maischform) : ""}</h3>
      ${u.einmaischtemperatur != null ? zeile("Einmaischen", zf(u.einmaischtemperatur) + " °C") : ""}
      ${u.rasten.map((x, i) => zeile(`${i + 1}. Rast`, `${zf(x.temperatur)} °C · ${zf(x.zeit, 0)} min`)).join("")}
      ${u.abmaischtemperatur != null ? zeile("Abmaischen", zf(u.abmaischtemperatur) + " °C") : ""}</section>` : ""}

    <section class="rz-sec"><h3>Würzekochen${u.kochzeit ? ` · ${zf(u.kochzeit, 0)} min` : ""}</h3>
      ${koch.map(x => hopfenZeile(x)).join("") || `<p class="hint">Kein Kochhopfen eingetragen.</p>`}
      ${koch.some(x => x.alpha) ? `<p class="hint noprint">Alphawert deines Hopfens eintragen – die Menge wird so angepasst, dass die Bittere gleich bleibt.</p>` : ""}</section>

    ${stopf.length ? `<section class="rz-sec"><h3>Stopfhopfen</h3>${stopf.map(x => zeile(esc(x.sorte), B.fmtGramm(x.gramm))).join("")}</section>` : ""}
    ${u.weitere.length ? `<section class="rz-sec"><h3>Weitere Zutaten</h3>${u.weitere.map(w => zeile(esc(w.name) + (w.zeitpunkt ? ` <small>${esc(w.zeitpunkt)}</small>` : ""), w.menge != null ? zf(w.menge, 2) + " " + esc(w.einheit || "") : "–")).join("")}</section>` : ""}

    <section class="rz-sec"><h3>Gärung und Reifung</h3>
      ${zeile("Hefe", esc(u.hefe || "–"))}${u.gaertemperatur ? zeile("Gärtemperatur", esc(u.gaertemperatur) + (/°/.test(u.gaertemperatur) ? "" : " °C")) : ""}
      ${u.endvergaerungsgrad != null ? zeile("Endvergärungsgrad", zf(u.endvergaerungsgrad, 0) + " %") : ""}${u.karbonisierung != null ? zeile("Karbonisierung", zf(u.karbonisierung) + " g/l") : ""}</section>

    ${R.anmerkung ? `<section class="rz-sec"><h3>Anmerkung</h3><div class="note">${esc(R.anmerkung)}</div></section>` : ""}

    ${stammbaumHtml()}
  </article>

  ${isBM() ? `<div class="top-actions noprint rz-aktionen">
      <button class="btn primary" id="sudAnlegen">Sud aus diesem Rezept anlegen</button>
      <button class="btn" id="rzEdit">Bearbeiten</button><button class="btn" id="rzName">Umbenennen</button><button class="btn" id="rzKlon">Klonen</button>
      <button class="btn" id="rzExport">Export (MMuM-JSON)</button><button class="btn" id="rzDruck">Drucken</button>
      <button class="btn" id="rzPub">${R.oeffentlich ? "Nicht mehr öffentlich" : "Öffentlich zeigen"}</button>
      ${isAdmin() ? `<button class="btn danger" id="rzDel">Löschen</button>` : ""}
    </div>` : `<div class="top-actions noprint"><button class="btn" id="rzDruck">Drucken</button></div>`}`;
  rMain().innerHTML = h;

  const zm = $("#zielMenge");
  zm.onchange = () => { const v = B.zahl(zm.value); if(v && v > 0){ sicht.ziel = v; detailZeigen(); } };
  const ma = $("#mitAnlage"); if(ma) ma.onchange = () => { sicht.mitAnlage = ma.checked; detailZeigen(); };
  const zb = $("#zurueck"); if(zb) zb.onclick = () => { sicht = { ziel: R.ausschlag || sicht.ziel, mitAnlage: false, alpha: {} }; detailZeigen(); };
  rMain().querySelectorAll("input[data-alpha]").forEach(inp => inp.onchange = () => {
    const i = inp.dataset.alpha, v = B.zahl(inp.value);
    if(v && v > 0 && v !== B.zahl(R.hopfen[i].alpha)) sicht.alpha[i] = v; else delete sicht.alpha[i];
    detailZeigen();
  });
  $("#rzDruck").onclick = () => window.print();
  const bp = [R.bild_foto, R.bild_etikett].filter(Boolean);
  if($("#rzFoto")) $("#rzFoto").onclick = () => Bilder.zeigen(bp, 0);
  if($("#rzEtikett")) $("#rzEtikett").onclick = () => Bilder.zeigen(bp, bp.length - 1);
  if(!isBM()) return;
  $("#sudAnlegen").onclick = () => sudAusRezept(aktuell());
  $("#rzEdit").onclick = () => rezeptEditInline(R);
  $("#rzName").onclick = umbenennen;
  $("#rzKlon").onclick = klonen;
  $("#rzExport").onclick = () => { download(dateiname(R.name) + (geaendert ? `_${zf(sicht.ziel)}l` : "") + ".json", JSON.stringify(B.zuMMuM(aktuell()), null, 2)); toast("Exportiert"); };
  $("#rzPub").onclick = async () => { const {error} = await sb.from("rezepte").update({oeffentlich: !R.oeffentlich}).eq("id", R.id); if(error){ toast(fehlertext(error)); return; } R.oeffentlich = !R.oeffentlich; toast(R.oeffentlich ? "Rezept ist jetzt öffentlich" : "Rezept ist jetzt intern"); detailZeigen(); };
  const del = $("#rzDel"); if(del) del.onclick = loeschen;
}

function hopfenZeile(x){
  const alt = B.zahl(R.hopfen[x.i]?.alpha);
  const zeit = x.typ === "Vorderwuerze" ? "Vorderwürze" : x.typ === "Whirlpool" ? "Whirlpool" : (x.zeit != null ? zf(x.zeit, 0) + " min" : "");
  return `<div class="rz-hopfen">
    <span class="hs"><b>${esc(x.sorte || "–")}</b>${x.alpha != null ? `<label class="alpha noprint"><input type="number" step="0.1" min="0.5" max="30" data-alpha="${x.i}" value="${esc(x.alpha)}" aria-label="Alphasäure ${esc(x.sorte || "")} in Prozent"> % α</label><span class="printonly">${zf(x.alpha)} % α</span>` : ""}
      ${x.alphaAlt != null ? `<small class="hint">statt ${zf(alt)} %</small>` : ""}</span>
    <span class="num">${B.fmtGramm(x.gramm)}</span><span class="num hz">${esc(zeit)}</span></div>`;
}

function stammbaumHtml(){
  const teile = [];
  if(baum.eltern) teile.push(`Abgeleitet von <a href="rezepte.html?id=${esc(baum.eltern.id)}">${esc(baum.eltern.name)}</a>`);
  if(baum.ausSud) teile.push(`Entstanden aus <a href="index.html?sud=${esc(baum.ausSud.id)}">Sud Nr. ${esc(baum.ausSud.nr)}</a> (${esc(fmtDateLong(baum.ausSud.datum))})`);
  if(baum.kinder.length) teile.push(`Varianten: ${baum.kinder.map(c => `<a href="rezepte.html?id=${esc(c.id)}">${esc(c.name)}</a>`).join(", ")}`);
  if(baum.sude.length) teile.push(`${baum.sude.length}× gebraut: ${baum.sude.map(s => (isBM() || s.oeffentlich) ? `<a href="index.html?sud=${esc(s.id)}">Nr. ${esc(s.nr)}</a> (${esc(fmtDateLong(s.datum))})` : `Nr. ${esc(s.nr)}`).join(", ")}`);
  else teile.push("Noch nicht gebraut.");
  return `<section class="rz-sec noprint"><h3>Stammbaum</h3><ul class="plain baum">${teile.map(t => `<li>${t}</li>`).join("")}</ul></section>`;
}

function umbenennen(){
  sheet("Rezept umbenennen", `<form id="nmForm" class="stack" novalidate><label class="f" for="nm">Name<input id="nm" maxlength="100" value="${esc(R.name)}"></label><span class="err" id="nmErr"></span></form>`,
    `<span class="spacer"></span><button class="btn" id="nmAbbr">Abbrechen</button><button class="btn primary" id="nmSave" form="nmForm" type="submit">Speichern</button>`);
  $("#nmAbbr").onclick = closeSheet;
  setTimeout(() => $("#nm")?.select(), 50);
  $("#nmForm").onsubmit = async e => { e.preventDefault();
    const n = $("#nm").value.trim(); if(!n){ $("#nmErr").textContent = "Bitte einen Namen eingeben."; return; }
    $("#nmSave").disabled = true;
    const {error} = await sb.from("rezepte").update({name: n}).eq("id", R.id);
    if(error){ $("#nmSave").disabled = false; $("#nmErr").textContent = fehlertext(error); return; }
    R.name = n; closeSheet(); toast("Umbenannt"); detailZeigen();
  };
}
async function klonen(){
  const kopie = {...R}; ["id", "angelegt", "angelegt_von", "geaendert", "geaendert_von", "original", "aus_sud_id"].forEach(k => delete kopie[k]);
  Object.assign(kopie, {name: R.name + " (Variante)", eltern_id: R.id, oeffentlich: false, bild_foto: null, bild_etikett: null});
  const {data, error} = await sb.from("rezepte").insert(kopie).select("id").single();
  if(error){ toast(fehlertext(error)); return; }
  toast("Variante angelegt"); location.href = "rezepte.html?id=" + data.id;
}
function loeschen(){
  const n = baum.sude.length;
  sheet("Rezept löschen?", `<p>„${esc(R.name)}“ wird endgültig gelöscht.${n ? ` Die ${n} daraus gebrauten Sude bleiben erhalten, verlieren aber den Verweis aufs Rezept.` : ""}${baum.kinder.length ? " Varianten bleiben erhalten." : ""}</p>`,
    `<span class="spacer"></span><button class="btn" id="dNein">Abbrechen</button><button class="btn danger" id="dJa">Endgültig löschen</button>`);
  $("#dNein").onclick = closeSheet;
  $("#dJa").onclick = async () => { $("#dJa").disabled = true;
    const {data, error} = await sb.from("rezepte").delete().eq("id", R.id).select("id");
    if(error || !data?.length){ toast(error ? fehlertext(error) : "Löschen ist nur dem Admin erlaubt."); closeSheet(); return; }
    await Promise.all([Bilder.loeschen(R.bild_foto), Bilder.loeschen(R.bild_etikett)]);
    location.href = "rezepte.html";
  };
}

/* Übergabe an die Sud-Seite: das umgerechnete Rezept wird kurz im Browser abgelegt, die Sud-Seite öffnet damit den Editor */
function sudAusRezept(u){
  try{ sessionStorage.setItem("kb_sud_aus_rezept", JSON.stringify({rezept_id: R.id, name: R.name, rezept: u, ziel: sicht.ziel, anlage: sicht.mitAnlage})); }catch(_){ toast("Der Browser erlaubt keine Zwischenablage – bitte über „+ Neuer Sud“ gehen."); return; }
  location.href = "index.html?ausRezept=1";
}
