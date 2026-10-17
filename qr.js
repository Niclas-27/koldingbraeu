/* Koldingbräu – kleiner QR-Code-Erzeuger (Byte-Modus, Fehlerkorrektur M, Version 1–10)
   Nach dem Verfahren aus ISO/IEC 18004; Aufbau angelehnt an Project Nayuki „QR Code generator“ (MIT).
   Reicht für Links bis etwa 210 Zeichen. Nutzung: QR.svg("https://…") liefert ein SVG als Text. */
(function (global) {
"use strict";

// Fehlerkorrektur M: [EC-Codewörter je Block, Blöcke Gruppe 1, Datenwörter G1, Blöcke G2, Datenwörter G2]
const BLOECKE = [null,
  [10,1,16,0,0],[16,1,28,0,0],[26,1,44,0,0],[18,2,32,0,0],[24,2,43,0,0],
  [16,4,27,0,0],[18,4,31,0,0],[22,2,38,2,39],[22,3,36,2,37],[26,4,43,1,44]];
const AUSRICHTUNG = [null,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];

function mul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
function divisor(grad) {
  const r = new Array(grad - 1).fill(0).concat([1]); let root = 1;
  for (let i = 0; i < grad; i++) {
    for (let j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
    root = mul(root, 2);
  }
  return r;
}
function rest(daten, div) {
  const r = div.map(() => 0);
  for (const b of daten) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= mul(c, f); }); }
  return r;
}
const bit = (x, i) => ((x >>> i) & 1) !== 0;

function matrix(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  let v = 1;
  for (; v <= 10; v++) {
    const b = BLOECKE[v], kap = (b[1] * b[2] + b[3] * b[4]) * 8;
    if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= kap) break;
  }
  if (v > 10) throw new Error("Text zu lang für den QR-Code");
  const [ecn, g1, d1, g2, d2] = BLOECKE[v];
  const datenWoerter = g1 * d1 + g2 * d2, kap = datenWoerter * 8;

  // Bitfolge: Modus, Länge, Daten, Abschluss, Füllbytes
  const bits = [];
  const push = (wert, n) => { for (let i = n - 1; i >= 0; i--) bits.push((wert >>> i) & 1); };
  push(4, 4); push(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => push(b, 8));
  push(0, Math.min(4, kap - bits.length));
  push(0, (8 - bits.length % 8) % 8);
  for (let pad = 0xEC; bits.length < kap; pad ^= 0xEC ^ 0x11) push(pad, 8);
  const woerter = []; for (let i = 0; i < bits.length; i += 8) woerter.push(bits.slice(i, i + 8).reduce((a, x) => (a << 1) | x, 0));

  // Blöcke bilden, Fehlerkorrektur anhängen, verschränken
  const div = divisor(ecn), bloecke = []; let k = 0;
  for (let i = 0; i < g1 + g2; i++) {
    const n = i < g1 ? d1 : d2, d = woerter.slice(k, k + n); k += n;
    bloecke.push({ d, e: rest(d, div) });
  }
  const folge = [];
  for (let i = 0; i < Math.max(d1, d2); i++) bloecke.forEach(b => { if (i < b.d.length) folge.push(b.d[i]); });
  for (let i = 0; i < ecn; i++) bloecke.forEach(b => folge.push(b.e[i]));

  const size = 17 + 4 * v;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const setF = (x, y, dunkel) => { m[y][x] = dunkel; fn[y][x] = true; };

  for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const ap = AUSRICHTUNG[v], na = ap.length;
  for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const format = maske => {
    const data = (0 << 3) | maske; // Fehlerkorrektur M = 00
    let r = data; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((data << 10) | r) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setF(8, i, bit(b, i));
    setF(8, 7, bit(b, 6)); setF(8, 8, bit(b, 7)); setF(7, 8, bit(b, 8));
    for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(b, i));
    for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(b, i));
    for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(b, i));
    setF(8, size - 8, true);
  };
  format(0);
  if (v >= 7) {
    let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
    const b = (v << 12) | r;
    for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, c = Math.floor(i / 3); setF(a, c, bit(b, i)); setF(c, a, bit(b, i)); }
  }

  // Daten im Zickzack von rechts unten eintragen
  let i = 0;
  for (let rechts = size - 1; rechts >= 1; rechts -= 2) {
    if (rechts === 6) rechts = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = rechts - j, hoch = ((rechts + 1) & 2) === 0, y = hoch ? size - 1 - vert : vert;
      if (!fn[y][x] && i < folge.length * 8) { m[y][x] = bit(folge[i >>> 3], 7 - (i & 7)); i++; }
    }
  }

  const masken = [
    (x, y) => (x + y) % 2, (x, y) => y % 2, (x, y) => x % 3, (x, y) => (x + y) % 3,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2, (x, y) => x * y % 2 + x * y % 3,
    (x, y) => (x * y % 2 + x * y % 3) % 2, (x, y) => ((x + y) % 2 + x * y % 3) % 2];
  const maskieren = n => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && masken[n](x, y) === 0) m[y][x] = !m[y][x]; };
  const strafe = () => {
    let p = 0, dunkel = 0;
    const zeile = get => {
      let lauf = 1;
      for (let a = 1; a <= size; a++) {
        if (a < size && get(a) === get(a - 1)) lauf++;
        else { if (lauf >= 5) p += 3 + lauf - 5; lauf = 1; }
      }
      const s = Array.from({ length: size }, (_, a) => get(a) ? "1" : "0").join("");
      const pad = "0000" + s + "0000";
      for (let a = pad.indexOf("10111010000"); a >= 0; a = pad.indexOf("10111010000", a + 1)) p += 40;
      for (let a = pad.indexOf("00001011101"); a >= 0; a = pad.indexOf("00001011101", a + 1)) p += 40;
    };
    for (let y = 0; y < size; y++) zeile(x => m[y][x]);
    for (let x = 0; x < size; x++) zeile(y => m[y][x]);
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
      const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
    }
    m.forEach(r => r.forEach(c => { if (c) dunkel++; }));
    p += 10 * Math.floor(Math.abs(dunkel * 20 - size * size * 10) / (size * size));
    return p;
  };
  let beste = 0, min = Infinity;
  for (let n = 0; n < 8; n++) { maskieren(n); format(n); const s = strafe(); if (s < min) { min = s; beste = n; } maskieren(n); }
  maskieren(beste); format(beste);
  return m;
}

function svg(text, opts) {
  const m = matrix(text), rand = (opts && opts.rand != null) ? opts.rand : 4, n = m.length + 2 * rand;
  let d = "";
  m.forEach((r, y) => r.forEach((c, x) => { if (c) d += `M${x + rand},${y + rand}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR-Code"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

global.QR = { matrix, svg };
})(typeof window !== "undefined" ? window : globalThis);
