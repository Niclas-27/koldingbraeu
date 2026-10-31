/* Koldingbräu – Brau-Rechenbibliothek (ohne Bezug zu einem Bereich)
   - MMuM-JSON (maischemalzundmehr.de) lesen und schreiben – ExportVersion 2.0 (Listen) und ältere flache Felder (Malz1_Name …)
   - Rezepte umrechnen: Ausschlagwürze, Anlagenprofil (Sudhausausbeute), Alpha-Ausgleich beim Hopfen
   - Kennwerte berechnen: Stammwürze (aus Schüttung + Sudhausausbeute), IBU (Tinseth), EBC (Morey), Alkohol
   Internes Rezeptformat = Spalten der Tabelle public.rezepte:
     malze  [{name, gramm, ebc}]   hopfen [{sorte, gramm, alpha, zeit, typ}]  typ: Vorderwuerze | Kochen | Whirlpool | Stopfen
     rasten [{temperatur, zeit}]   weitere [{name, menge, einheit, zeitpunkt}]
   Nutzung im Browser: window.Brau; in Node: globalThis.Brau. */
(function (global) {
"use strict";

const HOPFEN_TYPEN = { Vorderwuerze: "Vorderwürze", Kochen: "Kochen", Whirlpool: "Whirlpool", Stopfen: "Stopfen" };

/* ---------- Zahlen und Einheiten ---------- */
const zahl = v => { if (v == null || v === "") return null; const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : null; };
const runde = (v, stellen = 0) => v == null ? null : Math.round(v * 10 ** stellen) / 10 ** stellen;
function inGramm(menge, einheit) {
  const m = zahl(menge); if (m == null) return null;
  const e = String(einheit || "g").trim().toLowerCase();
  if (e === "kg") return m * 1000;
  if (e === "mg") return m / 1000;
  return m;
}
/* 4230 → "4,23 kg", 810 → "810 g" */
function fmtGramm(g) {
  if (g == null) return "–";
  if (Math.abs(g) >= 1000) return (g / 1000).toLocaleString("de-DE", { maximumFractionDigits: 2 }) + " kg";
  if (Math.abs(g) < 10 && Math.round(g) !== g) return (Math.round(g * 10) / 10).toLocaleString("de-DE") + " g";
  return Math.round(g).toLocaleString("de-DE") + " g";
}
const fmtZahl = (v, st = 1) => v == null ? "–" : (+v).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: st });

/* ---------- Malzfarben: Vorschläge, wenn ein Rezept keine EBC angibt (typische Werte) ---------- */
const MALZ_EBC = [
  [/röst|roast|black|schwarz|carafa/i, 1100], [/schoko|chocolate/i, 900], [/caramünch|caramunich|crystal|caramel ?1[2-9]\d/i, 120],
  [/caraaroma/i, 400], [/carared|cara ?red/i, 50], [/caraamber|amber/i, 70], [/carahell/i, 25], [/carapils|carafoam|dextrin/i, 4],
  [/cara/i, 60], [/melanoidin/i, 70], [/biscuit|biskuit/i, 50], [/rauch|smoke/i, 6], [/münchner|munich/i, 20],
  [/wiener|vienna/i, 8], [/weizen|wheat/i, 4], [/roggen|rye/i, 6], [/dinkel|spelt/i, 4], [/hafer|oat/i, 3],
  [/sauer|acid/i, 5], [/pale ?ale|maris/i, 6], [/pils|lager|pilsner/i, 3.5], [/reis|rice|mais|corn/i, 2],
];
function malzEbc(name) { for (const [re, ebc] of MALZ_EBC) if (re.test(name || "")) return ebc; return null; }

/* ---------- MMuM-JSON lesen ---------- */
function hopfenTyp(t) {
  const s = String(t || "").toLowerCase();
  if (/vorder|vwh|first/.test(s)) return "Vorderwuerze";
  if (/whirl|nachisom|aroma ?steep/.test(s)) return "Whirlpool";
  if (/stopf|dry/.test(s)) return "Stopfen";
  return "Kochen";
}
function ausMMuM(j) {
  if (!j || typeof j !== "object" || Array.isArray(j)) throw new Error("Das ist keine Rezeptdatei von maischemalzundmehr.de (kein JSON-Objekt).");
  if (!j.Name && !j.Malze && !j.Malz1_Name) throw new Error("In der Datei fehlen Name und Schüttung – ist es wirklich ein MMuM-Rezept?");
  const hinweise = [];
  const r = {
    name: String(j.Name || "Unbenanntes Rezept").trim(),
    stil: j.Sorte || null, autor: j.Autor || null,
    quelle: (j.Rezeptquelle || "maischemalzundmehr.de") + (j.Datum ? " · " + j.Datum : ""),
    beschreibung: j.Kurzbeschreibung || null, anmerkung: j.Anmerkung_Autor || j.Anmerkung || null,
    ausschlag: zahl(j.Ausschlagwuerze) || null, sudhausausbeute: zahl(j.Sudhausausbeute),
    stammwuerze: zahl(j.Stammwuerze), bittere: zahl(j.Bittere), farbe: zahl(j.Farbe), alkohol: zahl(j.Alkohol),
    maischform: j.Maischform || null, hauptguss: runde(zahl(j.Hauptguss), 2), nachguss: runde(zahl(j.Nachguss), 2),
    einmaischtemperatur: zahl(j.Einmaischtemperatur), abmaischtemperatur: zahl(j.Abmaischtemperatur),
    kochzeit: zahl(j.Kochzeit_Wuerze), hefe: j.Hefe || null,
    gaertemperatur: j.Gaertemperatur != null ? String(j.Gaertemperatur) : null,
    endvergaerungsgrad: zahl(j.Endvergaerungsgrad), karbonisierung: zahl(j.Karbonisierung),
    malze: [], rasten: [], hopfen: [], weitere: [], original: j,
  };
  const nummern = prefix => Object.keys(j).map(k => (k.match(new RegExp("^" + prefix + "(\\d+)_")) || [])[1]).filter(Boolean).map(Number)
    .filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);

  // Schüttung
  if (Array.isArray(j.Malze)) j.Malze.forEach(m => r.malze.push({ name: m.Name, gramm: runde(inGramm(m.Menge, m.Einheit), 1) }));
  else nummern("Malz").forEach(n => j[`Malz${n}_Name`] && r.malze.push({ name: j[`Malz${n}_Name`], gramm: runde(inGramm(j[`Malz${n}_Menge`], j[`Malz${n}_Einheit`]), 1) }));
  r.malze.forEach(m => { const e = malzEbc(m.name); m.ebc = e; });
  if (r.malze.some(m => m.ebc == null)) hinweise.push("Für einige Malze ist keine Farbe (EBC) bekannt – bitte beim Bearbeiten ergänzen.");
  if (r.malze.length) hinweise.push("Malzfarben (EBC) stehen nicht in der MMuM-Datei; ich habe typische Werte eingesetzt.");

  // Rasten
  if (Array.isArray(j.Rasten)) j.Rasten.forEach(x => r.rasten.push({ temperatur: zahl(x.Temperatur), zeit: zahl(x.Zeit) }));
  else nummern("Rast").forEach(n => r.rasten.push({ temperatur: zahl(j[`Rast${n}_Temperatur`]), zeit: zahl(j[`Rast${n}_Zeit`]) }));

  // Hopfen: Kochen, Vorderwürze, Whirlpool, Stopfen
  if (Array.isArray(j.Hopfenkochen)) j.Hopfenkochen.forEach(h => r.hopfen.push({ sorte: h.Sorte, gramm: zahl(h.Menge), alpha: zahl(h.Alpha), zeit: zahl(h.Zeit), typ: hopfenTyp(h.Typ) }));
  else nummern("Hopfen").forEach(n => j[`Hopfen${n}_Sorte`] && r.hopfen.push({ sorte: j[`Hopfen${n}_Sorte`], gramm: zahl(j[`Hopfen${n}_Menge`]), alpha: zahl(j[`Hopfen${n}_Alpha`]), zeit: zahl(j[`Hopfen${n}_Zeit`]), typ: hopfenTyp(j[`Hopfen${n}_Typ`]) }));
  nummern("Hopfen_VWH_").forEach(n => j[`Hopfen_VWH_${n}_Sorte`] && r.hopfen.push({ sorte: j[`Hopfen_VWH_${n}_Sorte`], gramm: zahl(j[`Hopfen_VWH_${n}_Menge`]), alpha: zahl(j[`Hopfen_VWH_${n}_alpha`] ?? j[`Hopfen_VWH_${n}_Alpha`]), zeit: r.kochzeit, typ: "Vorderwuerze" }));
  if (Array.isArray(j.Stopfhopfen)) j.Stopfhopfen.forEach(h => r.hopfen.push({ sorte: h.Sorte, gramm: zahl(h.Menge), alpha: zahl(h.Alpha), zeit: null, typ: "Stopfen" }));
  else nummern("Stopfhopfen").forEach(n => j[`Stopfhopfen${n}_Sorte`] && r.hopfen.push({ sorte: j[`Stopfhopfen${n}_Sorte`], gramm: zahl(j[`Stopfhopfen${n}_Menge`]), alpha: null, zeit: null, typ: "Stopfen" }));
  r.hopfen.filter(h => h.typ === "Vorderwuerze" && h.zeit == null).forEach(h => { h.zeit = r.kochzeit; });

  // Weitere Zutaten (Gewürze, Zucker …) – Felder heißen je nach Version unterschiedlich
  Object.keys(j).filter(k => /^Weitere/i.test(k) && Array.isArray(j[k])).forEach(k => j[k].forEach(z =>
    r.weitere.push({ name: z.Name || z.Sorte, menge: zahl(z.Menge), einheit: z.Einheit || "g", zeitpunkt: z.Zeitpunkt || z.Zeit || k.replace(/^Weitere_?Zutat(en)?_?/i, "") || null })));
  nummern("WeitereZutat_Wuerze_").forEach(n => j[`WeitereZutat_Wuerze_${n}_Name`] && r.weitere.push({ name: j[`WeitereZutat_Wuerze_${n}_Name`], menge: zahl(j[`WeitereZutat_Wuerze_${n}_Menge`]), einheit: j[`WeitereZutat_Wuerze_${n}_Einheit`] || "g", zeitpunkt: "Würze" }));

  if (!r.ausschlag) hinweise.push("Die Datei enthält keine Ausschlagwürze (oder 0 Liter). Bitte angeben, für welche Menge das Rezept gilt.");
  if (!r.sudhausausbeute) hinweise.push("Keine Sudhausausbeute im Rezept – beim Umrechnen auf die eigene Anlage wird die Schüttung nur nach Menge angepasst.");
  return { rezept: r, hinweise };
}

/* ---------- MMuM-JSON schreiben (ExportVersion 2.0) ---------- */
function zuMMuM(r) {
  const kg = g => g >= 1000 ? { Menge: runde(g / 1000, 3), Einheit: "kg" } : { Menge: runde(g, 1), Einheit: "g" };
  return {
    Rezeptquelle: "kolding.de", ExportVersion: "2.0", Name: r.name, Datum: new Date().toLocaleDateString("de-DE"),
    Sorte: r.stil || "", Autor: r.autor || "Koldingbräu", Ausschlagwuerze: r.ausschlag || 0, Sudhausausbeute: r.sudhausausbeute || 0,
    Stammwuerze: r.stammwuerze || 0, Bittere: r.bittere || 0, Farbe: r.farbe || 0, Alkohol: r.alkohol || 0,
    Kurzbeschreibung: r.beschreibung || "",
    Malze: (r.malze || []).map(m => ({ Name: m.name, ...kg(+m.gramm || 0) })),
    Maischform: r.maischform || "infusion", Hauptguss: r.hauptguss || 0, Einmaischtemperatur: r.einmaischtemperatur || 0,
    Rasten: (r.rasten || []).map(x => ({ Temperatur: x.temperatur, Zeit: x.zeit })),
    Abmaischtemperatur: r.abmaischtemperatur || 0, Nachguss: r.nachguss || 0, Kochzeit_Wuerze: r.kochzeit || 0,
    Hopfenkochen: (r.hopfen || []).filter(h => h.typ !== "Stopfen").map(h => ({ Sorte: h.sorte, Menge: h.gramm, Alpha: h.alpha, Zeit: h.zeit, Typ: h.typ === "Kochen" ? "" : h.typ })),
    Stopfhopfen: (r.hopfen || []).filter(h => h.typ === "Stopfen").map(h => ({ Sorte: h.sorte, Menge: h.gramm })),
    Hefe: r.hefe || "", Gaertemperatur: r.gaertemperatur || "", Endvergaerungsgrad: r.endvergaerungsgrad || 0,
    Karbonisierung: r.karbonisierung || 0, Anmerkung_Autor: r.anmerkung || "",
  };
}

/* ---------- Umrechnen ----------
   opts: { ziel: Liter Ausschlagwürze, anlage: {sudhausausbeute} | null, alpha: {index: neuer Alphawert} }
   - Mengen wachsen linear mit der Ausschlagwürze.
   - Mit Anlagenprofil wird die Schüttung zusätzlich um (Ausbeute laut Rezept / eigene Ausbeute) angepasst,
     damit die Stammwürze auf der eigenen Anlage getroffen wird.
   - Neuer Alphawert: Hopfenmenge × (alter Alpha / neuer Alpha), damit die Bittere gleich bleibt (nicht beim Stopfen). */
function umrechnen(r, opts = {}) {
  const basis = zahl(r.ausschlag);
  const ziel = zahl(opts.ziel) || basis;
  const f = basis && ziel ? ziel / basis : 1;
  const shaR = zahl(r.sudhausausbeute), shaA = opts.anlage ? zahl(opts.anlage.sudhausausbeute) : null;
  const fs = shaR && shaA ? shaR / shaA : 1;
  const alpha = opts.alpha || {};
  const out = JSON.parse(JSON.stringify(r));
  out.ausschlag = ziel;
  out.malze = (r.malze || []).map(m => ({ ...m, gramm: runde((zahl(m.gramm) || 0) * f * fs, 0) }));
  out.hopfen = (r.hopfen || []).map((h, i) => {
    const neu = zahl(alpha[i]), alt = zahl(h.alpha);
    const ausgleich = h.typ !== "Stopfen" && neu && alt ? alt / neu : 1;
    return { ...h, alpha: neu || h.alpha, gramm: runde((zahl(h.gramm) || 0) * f * ausgleich, 1), alphaAlt: neu && neu !== alt ? alt : undefined };
  });
  out.weitere = (r.weitere || []).map(w => ({ ...w, menge: w.menge == null ? null : runde(w.menge * f, 2) }));
  out.hauptguss = r.hauptguss == null ? null : runde(r.hauptguss * f * fs, 1);   // Hauptguss hängt an der Schüttung
  out.nachguss = r.nachguss == null ? null : runde(r.nachguss * f, 1);
  // Mit Anlagenprofil: Nachguss so, dass die Gesamtwassermenge zur eigenen Verdampfung passt (Näherung:
  // Ausschlagwürze + Verdampfung während des Kochens + 1 l je kg Treber − Hauptguss)
  const verd = opts.anlage ? zahl(opts.anlage.verdampfung) : null, koch = zahl(r.kochzeit);
  if (verd != null && koch && out.hauptguss != null) {
    const kg = out.malze.reduce((a, m) => a + (m.gramm || 0), 0) / 1000;
    out.nachguss = Math.max(0, runde(ziel + verd * koch / 60 + kg * 1.0 - out.hauptguss, 1));
  }
  if (shaA && shaR) out.sudhausausbeute = shaA;
  out._faktor = { menge: f, schuettung: f * fs, anlage: shaR && shaA ? true : false };
  return out;
}

/* ---------- Kennwerte ---------- */
const sgAusPlato = p => 1 + p / (258.6 - (p / 258.2) * 227.1);
const platoAusSg = sg => -616.868 + 1111.14 * sg - 630.272 * sg * sg + 135.997 * sg * sg * sg;
/* Stammwürze in °P aus Schüttung, Ausschlagwürze und Sudhausausbeute:
   SHA = Würze(l) × °P/100 × Dichte / Schüttung(kg) × 100  →  °P × Dichte = SHA × Schüttung / Würze */
function stammwuerze(r, sha) {
  const kg = (r.malze || []).reduce((a, m) => a + (zahl(m.gramm) || 0), 0) / 1000;
  const v = zahl(r.ausschlag), s = zahl(sha ?? r.sudhausausbeute);
  if (!kg || !v || !s) return null;
  const e = s * kg / v;                     // °P × Dichte
  let p = e; for (let i = 0; i < 20; i++) p = e / sgAusPlato(p);
  return p;
}
/* IBU nach Tinseth – wie bei MMuM mit Nachisomerisierung: gekochter Hopfen bekommt 10 min zusätzlich (Ausschlagen/Abkühlen),
   Vorderwürze +10 %, Whirlpool wie 0,5 min Kochzeit (Näherung), Stopfhopfen zählt nicht. */
const NACHISO = 10;
function ibu(r, plato) {
  const v = zahl(r.ausschlag); if (!v) return null;
  const sg = sgAusPlato(plato ?? zahl(r.stammwuerze) ?? 12);
  const bigness = 1.65 * Math.pow(0.000125, sg - 1);
  let summe = 0;
  (r.hopfen || []).forEach(h => {
    const g = zahl(h.gramm), a = zahl(h.alpha); if (!g || !a || h.typ === "Stopfen") return;
    const t = h.typ === "Whirlpool" ? 0.5 : ((zahl(h.zeit) ?? (h.typ === "Vorderwuerze" ? zahl(r.kochzeit) : 0)) || 0) + NACHISO;
    const util = bigness * (1 - Math.exp(-0.04 * t)) / 4.15 * (h.typ === "Vorderwuerze" ? 1.1 : 1);
    summe += util * (a / 100) * g * 1000 / v;
  });
  return summe;
}
/* Farbe in EBC – Faustformel der deutschen Hobbybrauer-Programme: Σ(Malz kg × EBC) × 8 / Liter Würze.
   Passt gut für helle bis bernsteinfarbene Biere; bei sehr dunklen Bieren (über ~60 EBC) wird nach Morey gerechnet. */
function ebc(r) {
  const v = zahl(r.ausschlag); if (!v || !(r.malze || []).length) return null;
  let summe = 0, mcu = 0, bekannt = 0;
  (r.malze || []).forEach(m => {
    const e = zahl(m.ebc) ?? malzEbc(m.name); if (e == null) return;
    const kg = (zahl(m.gramm) || 0) / 1000; bekannt++;
    summe += kg * e;
    mcu += kg * 2.20462 * ((e / 1.97 + 0.76) / 1.3546) / (v * 0.264172);
  });
  if (!bekannt) return null;
  const linear = summe * 8 / v;
  return linear <= 60 ? linear : 1.4922 * Math.pow(mcu, 0.6859) * 1.97;
}
function alkohol(plato, evg) {
  if (plato == null || evg == null) return null;
  const og = sgAusPlato(plato), fg = sgAusPlato(plato * (1 - evg / 100));
  return (og - fg) * 131.25;
}
/* Alkohol direkt aus zwei gemessenen Werten (Stammwürze/Restextrakt in °Plato) statt aus einem angenommenen
   Endvergärungsgrad – genauer als alkohol(plato, evg) oben, sobald ein echter Restextrakt vorliegt (z. B. im
   Braugang-Assistenten). Formel wie oben (Balling-Näherung), nur mit beiden Seiten als Messwert statt einer
   Schätzung. */
function alkoholAusMessung(stammwuerzePlato, restextraktPlato) {
  if (stammwuerzePlato == null || restextraktPlato == null) return null;
  const og = sgAusPlato(stammwuerzePlato), fg = sgAusPlato(restextraktPlato);
  return (og - fg) * 131.25;
}
/* Alkohol aus zwei Refraktometer-Werten (°Brix), statt aus Spindel-Werten (°Plato) wie alkoholAusMessung oben.
   Braucht eine eigene Formel, weil Alkohol selbst den Lichtbrechungsindex verfälscht: ein Refraktometer liest
   nach der Gärung zu niedrig, wenn man den Endwert naiv wie einen Plato-Wert behandelt. Die Vorgärwürze (ogBrix,
   vor jeder Gärung) braucht dafür keine Korrektur – erst der Endwert (fgBrixUnkorrigiert) wird mit der
   verbreiteten "Sean-Terrill"-Korrekturformel (Linearversion) auf die tatsächliche Dichte umgerechnet. Wie beim
   Wasserhärte-Rechner: eine anerkannte Näherungsformel, keine Laborgenauigkeit, Ergebnis nur zur Orientierung. */
function alkoholAusRefraktometer(ogBrix, fgBrixUnkorrigiert) {
  if (ogBrix == null || fgBrixUnkorrigiert == null) return null;
  const ogSg = sgAusPlato(ogBrix);
  const fgSgKorrigiert = 1.0 - 0.00085683 * ogBrix + 0.0034941 * fgBrixUnkorrigiert;
  return (ogSg - fgSgKorrigiert) * 131.25;
}
function kennwerte(r, sha) {
  const p = stammwuerze(r, sha);
  return { stammwuerze: p, bittere: ibu(r, p ?? undefined), farbe: ebc(r), alkohol: alkohol(p ?? zahl(r.stammwuerze), zahl(r.endvergaerungsgrad)) };
}

global.Brau = { HOPFEN_TYPEN, zahl, runde, inGramm, fmtGramm, fmtZahl, malzEbc, hopfenTyp, ausMMuM, zuMMuM, umrechnen,
  stammwuerze, ibu, ebc, alkohol, alkoholAusMessung, alkoholAusRefraktometer, kennwerte, sgAusPlato, platoAusSg };
})(typeof window !== "undefined" ? window : globalThis);
