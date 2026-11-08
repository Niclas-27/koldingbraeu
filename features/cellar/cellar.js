/* Koldingbräu – Bierkeller (bierkeller.html, seit 08.11.2026)
   Alle Biere an einem Ort, auch ohne anstehende Verkostung: suchen, filtern, anlegen, bearbeiten, löschen.
   Nur für Braumeister (Menüpunkt mit class="nur-bm", Seite zeigt Gästen nur einen Hinweis). Formular und
   Filter kommen aus lib/bierform.js und werden genauso beim „Bier hinzufügen“ einer Verkostung benutzt.
   Löschen: nur Admin, nur Biere, die in keiner Verkostung stehen (sonst stimmten Liga und Ergebnisse nicht mehr). */
(function () {
"use strict";
const {$, esc, isBM, isAdmin, toast, fehlertext, bestaetigen, fmtDateLong} = KB;
let biere = null;

function zeigen(){
  $("#kellerAktionen").innerHTML = `<button class="btn primary" id="neuBier">+ Bier</button>`;
  $("#neuBier").onclick = () => BierForm.oeffnen(null, {gespeichert: neuLaden});
  $("#keller").innerHTML = `<div class="bf-leiste" id="kFilter"></div><p class="keller-zahl" id="kZahl"></p><div class="keller-liste" id="kListe"></div>`;
  BierForm.filter($("#kFilter"), biere, gef => {
    $("#kZahl").textContent = gef.length === biere.length ? `${biere.length} Biere` : `${gef.length} von ${biere.length} Bieren`;
    $("#kListe").innerHTML = gef.length ? gef.map(b => `<div class="kz">${Bilder.bier(b)}
      <span class="kz-t"><b>${b.verkostungen ? `<a href="liga.html?bier=${esc(b.id)}">${esc(b.name)}</a>` : esc(b.name)}</b>
        <small>${esc(BierForm.zeile(b) || "–")}</small>
        <small>${b.verkostungen ? `${b.verkostungen}× verkostet · zuletzt ${esc(fmtDateLong(b.letzte))}` : "noch nie verkostet"}</small></span>
      <span class="kz-a"><button class="btn ghost" data-ed="${esc(b.id)}">Bearbeiten</button>${isAdmin() && !b.verkostungen ? `<button class="btn ghost danger" data-del="${esc(b.id)}">Löschen</button>` : ""}</span></div>`).join("")
      : `<p class="empty">Kein Bier passt zu Suche und Filter.</p>`;
    $("#kListe").querySelectorAll("[data-ed]").forEach(btn => btn.onclick = () => BierForm.oeffnen(biere.find(b => b.id === btn.dataset.ed), {gespeichert: neuLaden}));
    $("#kListe").querySelectorAll("[data-del]").forEach(btn => btn.onclick = () => loeschen(biere.find(b => b.id === btn.dataset.del)));
  }, {merken: "keller", sortWahl: true});
}
async function neuLaden(id, neu){
  toast(neu ? "Bier angelegt" : "Gespeichert"); KB.closeSheet();
  biere = await BierForm.laden(); zeigen();
}
function loeschen(b){
  bestaetigen(`„${b.name}“ löschen?`, "Das Bier wird endgültig aus dem Bierkeller entfernt.", "Endgültig löschen", async () => {
    const r = await KB.sb.from("biere").delete().eq("id", b.id).select("id");
    if(r.error || !r.data?.length){ toast(r.error ? fehlertext(r.error) : "Löschen ist nur dem Admin erlaubt."); return; }
    await Promise.all(["bild_kronkorken","bild_flasche"].map(k => b[k] && Bilder.loeschen(b[k])));
    toast("Bier gelöscht"); biere = biere.filter(x => x.id !== b.id); zeigen();
  }, true);
}

KB.seite = {
  chrome(){},
  async laden(){
    if(!isBM()){ biere = null; $("#kellerAktionen").innerHTML = ""; $("#keller").innerHTML = `<p class="empty">Der Bierkeller ist nur für Braumeister. Bitte oben rechts anmelden.</p>`; return; }
    try{ biere = await BierForm.laden(); }catch(e){ $("#keller").innerHTML = `<p class="empty">${esc(fehlertext(e))}</p>`; return; }
    zeigen();
  },
};
})();
