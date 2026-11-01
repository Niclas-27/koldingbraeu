// Rechentests für lib/brau.js – Aufruf: node tests/brau_test.js
require("../lib/brau.js");
const fs = require("fs"), path = require("path");
let fehler = 0;
const ok = (name, bed, info="") => { console.log((bed ? "  ok    " : "  FEHLT ") + name + (info ? "  (" + info + ")" : "")); if (!bed) fehler++; };
const nah = (a, b, tol) => a != null && Math.abs(a - b) <= tol;

console.log("MMuM 2.0: Drives Me Hazy");
const j = JSON.parse(fs.readFileSync(path.join(__dirname, "data/drives-me-hazy.json"), "utf8"));
const { rezept: r, hinweise } = Brau.ausMMuM(j);
ok("Name", r.name === "Drives Me Hazy");
ok("5 Malze, Gramm", r.malze.length === 5 && r.malze[0].gramm === 4230 && r.malze[2].gramm === 810);
ok("Hopfen: 3 Kochen/Whirlpool + 3 Stopfen", r.hopfen.length === 6 && r.hopfen.filter(h => h.typ === "Stopfen").length === 3);
ok("Vorderwürze erkannt", r.hopfen[0].typ === "Vorderwuerze" && r.hopfen[1].typ === "Whirlpool");
ok("Rasten", r.rasten.length === 1 && r.rasten[0].temperatur === 67);
ok("Ausschlag 24 l, SHA 55", r.ausschlag === 24 && r.sudhausausbeute === 55);
const k = Brau.kennwerte(r);
ok("Stammwürze aus Schüttung plausibel (Rezept: 15 °P – Autorwerte passen nicht ganz zur Ausbeute 55 %)", k.stammwuerze > 14 && k.stammwuerze < 19, k.stammwuerze?.toFixed(2));
ok("IBU in der Nähe von 8", nah(k.bittere, 8, 2.5), k.bittere?.toFixed(1));
ok("EBC plausibel (8–16)", k.farbe > 8 && k.farbe < 16, k.farbe?.toFixed(1));
ok("Alkohol aus Rezept-Stammwürze 15 °P und EVG 72 % ≈ 6 %", nah(Brau.alkohol(15, 72), 6, 0.4), Brau.alkohol(15, 72).toFixed(2));
ok("Alkohol aus gemessener Stammwürze 12 °P und gemessenem Restextrakt 3 °P ≈ 4,8 %", nah(Brau.alkoholAusMessung(12, 3), 4.8, 0.3), Brau.alkoholAusMessung(12, 3).toFixed(2));
ok("Alkohol aus Messung ohne Restextrakt → null", Brau.alkoholAusMessung(12, null) === null);
ok("Alkohol aus Refraktometer (OG 14 °Bx, Endwert 7 °Bx) ≈ 5,8 % (gegen unabhängig von Hand gerechnete Terrill-Kubikformel als Gegenprobe: ≈1,013 SG Restdichte)", nah(Brau.alkoholAusRefraktometer(14, 7), 5.8, 0.3), Brau.alkoholAusRefraktometer(14, 7).toFixed(2));
ok("Alkohol aus Refraktometer ohne Endwert → null", Brau.alkoholAusRefraktometer(14, null) === null);
ok("Zucker je Liter für 5,5 g/l Ziel (Standard-Restkohlensäure) ≈ 7,2 g/l – passt zur Faustregel ~7 g/l", nah(Brau.primingZucker(5.5), 7.2, 0.5), Brau.primingZucker(5.5).toFixed(2));
ok("Zucker 0, wenn Ziel unter der Restkohlensäure liegt", Brau.primingZucker(1, 1.7) === 0);
ok("Zucker je Liter unabhängig von der Biermenge (reine g/l-Dosierung, keine Gesamtmenge)", Brau.primingZucker(5.5) === Brau.primingZucker(5.5, 1.7));
const maerzen = { ausschlag: 28, malze: [{ name: "Pilsner Malz", gramm: 3500 }, { name: "Münchner Malz", gramm: 2000 }] };
ok("Märzen: 5,5 kg auf 28 l bei 67 % Ausbeute ≈ 12,5 °P (MMuM)", nah(Brau.stammwuerze(maerzen, 67), 12.5, 0.15), Brau.stammwuerze(maerzen, 67).toFixed(2));
ok("Märzen: Magnum 10 g 15 % 60 min + HM 30 g 5 % 10 min ≈ 20 IBU (MMuM)", nah(Brau.ibu({ ausschlag: 28, hopfen: [{ gramm: 10, alpha: 15, zeit: 60, typ: "Kochen" }, { gramm: 30, alpha: 5, zeit: 10, typ: "Kochen" }] }, 12.5), 20, 3), Brau.ibu({ ausschlag: 28, hopfen: [{ gramm: 10, alpha: 15, zeit: 60, typ: "Kochen" }, { gramm: 30, alpha: 5, zeit: 10, typ: "Kochen" }] }, 12.5).toFixed(1));
ok("Märzen: Farbe ≈ 15 EBC (MMuM)", nah(Brau.ebc(maerzen), 15, 4), Brau.ebc(maerzen).toFixed(1));

console.log("Umrechnen");
const u = Brau.umrechnen(r, { ziel: 20 });
ok("Malz linear (20/24)", u.malze[0].gramm === Math.round(4230 * 20 / 24));
ok("Hopfen linear", u.hopfen[1].gramm === Math.round(88 * 20 / 24 * 10) / 10);
const ua = Brau.umrechnen(r, { ziel: 24, anlage: { sudhausausbeute: 65 } });
ok("Anlagenprofil: Schüttung × 55/65", ua.malze[0].gramm === Math.round(4230 * 55 / 65));
ok("Stammwürze bleibt mit eigener Ausbeute gleich", nah(Brau.stammwuerze(ua, 65), k.stammwuerze, 0.05));
const al = Brau.umrechnen(r, { alpha: { 0: 12 } });
ok("Alpha-Ausgleich 15,8 → 12", al.hopfen[0].gramm === Math.round(2 * 15.8 / 12 * 10) / 10 && al.hopfen[0].alphaAlt === 15.8);
ok("IBU bleibt beim Alpha-Ausgleich gleich", nah(Brau.ibu(al, k.stammwuerze), Brau.ibu(r, k.stammwuerze), 0.05));

console.log("Rundreise und altes Format");
const r2 = Brau.ausMMuM(Brau.zuMMuM(r)).rezept;
ok("Export → Import behält Malze/Hopfen", r2.malze.length === 5 && r2.hopfen.length === 6 && r2.malze[0].gramm === 4230);
const alt = { Name: "Märzen", Ausschlagwuerze: 0, Malz1_Name: "Pilsner Malz", Malz1_Menge: 3.5, Malz1_Einheit: "kg", Malz2_Name: "Münchner Malz", Malz2_Menge: 2, Malz2_Einheit: "kg",
  Rast1_Temperatur: 50, Rast1_Zeit: 5, Rast2_Temperatur: 62, Rast2_Zeit: 30, Hopfen1_Sorte: "Magnum", Hopfen1_Menge: 10, Hopfen1_Alpha: 15, Hopfen1_Zeit: 60, Hopfen1_Typ: "" };
const a = Brau.ausMMuM(alt);
ok("Flaches Format: Malze, Rasten, Hopfen", a.rezept.malze.length === 2 && a.rezept.malze[1].gramm === 2000 && a.rezept.rasten.length === 2 && a.rezept.hopfen[0].typ === "Kochen");
ok("Ausschlag 0 → Hinweis", a.rezept.ausschlag === null && a.hinweise.some(h => /Ausschlagwürze/.test(h)));
let wurf = false; try { Brau.ausMMuM([1, 2]); } catch (e) { wurf = true; } ok("Unsinn wird abgelehnt", wurf);
// Sudhausausbeute: tatsächliche Ausbeute, eigene Ausbeute je Rezept
const hazy = [4000, 1500, 500, 400, 1000].map(g => ({ gramm: g }));
ok("Ist-Ausbeute Sud 23: 20 l, 16,5 °P, 7,4 kg ≈ 47,6 %", nah(Brau.istAusbeute(20, 16.5, hazy), 47.6, 0.3), Brau.istAusbeute(20, 16.5, hazy));
ok("Ist-Ausbeute ohne Stammwürze = null", Brau.istAusbeute(20, null, hazy) === null);
const sch = Brau.ausbeuteSchnitt([{ datum: "2020-01-01", ausschlag: 20, stammwuerze: 16.5, malz: hazy }, { datum: "2026-01-01", ausschlag: 20, stammwuerze: null, malz: hazy }, { datum: "2025-01-01", ausschlag: 20, stammwuerze: 16.5, malz: hazy }], 5);
ok("Schnitt überspringt unvollständige Sude", sch.anzahl === 2 && nah(sch.wert, 47.6, 0.3), JSON.stringify(sch));
ok("Zielausbeute: Rezept vor Anlage", Brau.zielAusbeute({ eigene_ausbeute: 48 }, { sudhausausbeute: 55 }) === 48 && Brau.zielAusbeute({}, { sudhausausbeute: 55 }) === 55);
const ue = Brau.umrechnen({ ...r, eigene_ausbeute: 50 }, { ziel: 24, anlage: { sudhausausbeute: 65 } });
ok("Eigene Ausbeute geht vor: Schüttung × 55/50", ue.malze[0].gramm === Math.round(4230 * 55 / 50), ue.malze[0].gramm);
console.log(fehler ? `\n${fehler} Fehler` : "\nAlles grün.");
process.exit(fehler ? 1 : 0);
