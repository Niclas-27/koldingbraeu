/* Koldingbräu – Rezepte: gemeinsame Bausteine
   Die Dateien dieses Bereichs teilen sich den globalen Gültigkeitsbereich der Seite rezepte.html;
   Reihenfolge: common → list → detail → editor → import → main. Rechnen: lib/brau.js (window.Brau). */
"use strict";
const {$, esc, isBM, isAdmin, fmtDateLong, toast, notice, sheet, closeSheet, sec, fehlertext, lsGet, lsSet} = KB;
const sb = new Proxy({}, {get: (_, k) => { const v = KB.sb[k]; return typeof v === "function" ? v.bind(KB.sb) : v; }});
const B = window.Brau;

const rParams = new URLSearchParams(location.search);
const rezeptId = rParams.get("id") || "";
const rMain = () => $("#rz");
let anlage = null;      // Anlagenprofil Koldingbräu (nur für Braumeister lesbar)

const TYP_LABEL = B.HOPFEN_TYPEN;
const zf = (v, st = 1) => B.fmtZahl(v, st);
const kopf = (label, wert, einheit) => `<div class="kw"><span>${esc(label)}</span><b class="num">${wert == null ? "–" : esc(zf(wert))}</b><small>${esc(einheit)}</small></div>`;
/* Vorschaubild eines Rezepts: Etikett, sonst Foto, sonst gezeichneter Kronkorken in der Rezeptfarbe */
function rezeptBild(r, k, gross){
  const p = r.bild_etikett || r.bild_foto;
  if(p) return `<img class="rz-bild kb-zack${gross ? " gross" : ""}" src="${esc(Bilder.url(p, !gross))}" alt="" loading="lazy">`;
  return `<span class="rz-bild ph${gross ? " gross" : ""}">${Bilder.platzhalter({name: r.name, stil: r.stil, ebc: r.farbe ?? k?.farbe})}</span>`;
}
function kopfwerte(r, k){
  // Werte laut Rezept, wenn vorhanden – sonst berechnet
  return `<div class="kws">${kopf("Stammwürze", r.stammwuerze ?? k?.stammwuerze, "°P")}${kopf("Bittere", r.bittere ?? k?.bittere, "IBU")}${kopf("Farbe", r.farbe ?? k?.farbe, "EBC")}${kopf("Alkohol", r.alkohol ?? k?.alkohol, "% Vol.")}</div>`;
}
async function ladeAnlage(){
  if(!isBM()){ anlage = null; return null; }
  const {data} = await sb.from("anlagen").select("*").order("id").limit(1).maybeSingle();
  anlage = data || null; return anlage;
}
/* Tatsächliche Ausbeute aus euren Suden (nur Braumeister).
   anlageVorschlag(): Ø der letzten 5 Sude mit vollständigen Werten – Vorschlag fürs Anlagenprofil.
   rezeptVorschlag(r): Ø der Sude aus diesem Rezept, sonst der Sude im selben Stil. */
const SUD_AUSBEUTE_FELDER = "datum,ausschlag,stammwuerze,malz,rezept_id,stil";
async function anlageVorschlag(){
  if(!isBM()) return null;
  const {data} = await sb.from("sude").select(SUD_AUSBEUTE_FELDER).order("datum", {ascending: false}).limit(40);
  return B.ausbeuteSchnitt(data || [], 5);
}
async function rezeptVorschlag(r){
  if(!isBM() || !r) return null;
  const filter = [r.id ? `rezept_id.eq.${r.id}` : null, r.stil ? `stil.eq.${JSON.stringify(r.stil)}` : null].filter(Boolean).join(",");
  if(!filter) return null;
  const {data} = await sb.from("sude").select(SUD_AUSBEUTE_FELDER).or(filter).order("datum", {ascending: false}).limit(40);
  const alle = data || [], eigene = alle.filter(s => r.id && s.rezept_id === r.id);
  const v = B.ausbeuteSchnitt(eigene, 5);
  if(v) return {...v, basis: "aus diesem Rezept"};
  const st = B.ausbeuteSchnitt(alle.filter(s => s.stil === r.stil), 5);
  return st ? {...st, basis: `im Stil ${r.stil}`} : null;
}
const sudeText = n => n === 1 ? "1 Sud" : n + " Sude";
function download(name, inhalt){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([inhalt], {type: "application/json"}));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const dateiname = n => String(n || "rezept").normalize("NFKD").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "rezept";
