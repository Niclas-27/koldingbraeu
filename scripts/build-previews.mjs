#!/usr/bin/env node
/* Koldingbräu – Vorschauseiten für geteilte Links (WhatsApp & Co.)
   WhatsApp & Co. lesen beim Linkversand nur das rohe HTML einer URL, ohne JavaScript auszuführen – eine
   einzige index.html, die sich erst per Skript mit den Supabase-Daten füllt, kann also nie ein Vorschaubild
   zu EINEM bestimmten Sud/Bier/Rezept/einer Verkostung tragen. Deshalb erzeugt dieses Skript beim
   Veröffentlichen (und per Zeitplan, siehe pages.yml) winzige, statische Seiten unter eigenen Adressen
   (/sud/<id>/, /rezept/<id>/, /verkostung/<id>/, /bier/<id>/) mit den passenden <meta property="og:..">-Tags
   und leitet Menschen von dort sofort zur eigentlichen Seite weiter (index.html?sud=<id> usw.).
   Nur ÖFFENTLICHE Sude/Rezepte bekommen so eine Seite (angefragt wird genau wie im Browser als Gast: ohne
   Anmeldung, nur was RLS für "oeffentlich=true" freigibt) – interne bleiben unsichtbar und zeigen beim
   Teilen nur das allgemeine Koldingbräu-Logo (assets/og-default.png), weil dafür schlicht keine Seite
   entsteht und die normale App-Seite selbst nur die allgemeinen og-Tags trägt (siehe <head> der *.html).
   Verkostungen bekommen nur dann eine Vorschauseite, wenn sie abgeschlossen sind (das Ergebnis ist dann
   laut App ausdrücklich öffentlich, siehe verkostung.html?e=<id> / vk_archiv). Biere aus der Biersammlung
   sind in der App grundsätzlich öffentlich (Liga) und bekommen daher alle eine Vorschauseite, sofern ein
   Kronkorken-Bild hinterlegt ist.
   Läuft rein lesend mit dem öffentlichen Supabase-Schlüssel (dem gleichen, der auch im Browser steht) und
   bricht bei einem Netzwerk-/Supabase-Fehler nicht den ganzen Build ab – dann bleiben nur die neuen
   Vorschauseiten diesmal aus, die Seite selbst wird trotzdem ganz normal veröffentlicht. */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SUPABASE_URL = "https://ysmnvtuxckiflvvfxxiy.supabase.co";
const SUPABASE_KEY = "sb_publishable_bi4uUX0fOozKCCZPzSbwAA_kPhMe6CX"; // öffentlicher Schlüssel, darf im Quelltext stehen
const SITE_URL = "https://kolding.de";
const OUT = process.argv[2] || "_site";

const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const bildUrl = pfad => pfad ? `${SUPABASE_URL}/storage/v1/object/public/bilder/${encodeURI(pfad)}` : null;

async function supa(pfad, { rpc } = {}) {
  const url = rpc ? `${SUPABASE_URL}/rest/v1/rpc/${pfad}` : `${SUPABASE_URL}/rest/v1/${pfad}`;
  const res = await fetch(url, {
    method: rpc ? "POST" : "GET",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: rpc ? "{}" : undefined,
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function stub({ ordner, id, titel, beschreibung, bild, zielpfad }) {
  if (!bild) return false; // ohne Bild bringt eine eigene Vorschauseite nichts – die App-Seite selbst zeigt dann das allgemeine Logo
  const ziel = `${SITE_URL}${zielpfad}`;
  const eigeneUrl = `${SITE_URL}/${ordner}/${id}/`;
  const html = `<!doctype html>
<html lang="de"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titel)} · Koldingbräu</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${esc(ziel)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Koldingbräu">
<meta property="og:title" content="${esc(titel)} · Koldingbräu">
<meta property="og:description" content="${esc(beschreibung)}">
<meta property="og:image" content="${esc(bild)}">
<meta property="og:url" content="${esc(eigeneUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${esc(zielpfad)}">
<script>location.replace(${JSON.stringify(zielpfad)});</script>
</head><body>
<p>Weiterleitung zu <a href="${esc(zielpfad)}">Koldingbräu</a> …</p>
</body></html>
`;
  const dir = join(OUT, ordner, String(id));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.html"), html, "utf-8");
  return true;
}

async function main() {
  let erzeugt = 0;

  try {
    const sude = await supa("sude?select=id,nr,stil,bild_etikett,bild_foto&oeffentlich=eq.true");
    for (const s of sude) {
      const titel = s.stil || `Sud ${s.nr}`;
      const ok = await stub({
        ordner: "sud", id: s.id, titel,
        beschreibung: `Sud Nr. ${s.nr} im Braubuch von Koldingbräu.`,
        bild: bildUrl(s.bild_etikett || s.bild_foto),
        zielpfad: `/index.html?sud=${encodeURIComponent(s.id)}`,
      });
      if (ok) erzeugt++;
    }
  } catch (e) { console.warn("Sude-Vorschauen übersprungen:", e.message); }

  try {
    const rezepte = await supa("rezepte?select=id,name,bild_etikett,bild_foto&oeffentlich=eq.true");
    for (const r of rezepte) {
      const ok = await stub({
        ordner: "rezept", id: r.id, titel: r.name,
        beschreibung: `Rezept „${r.name}“ im Braubuch von Koldingbräu.`,
        bild: bildUrl(r.bild_etikett || r.bild_foto),
        zielpfad: `/rezepte.html?id=${encodeURIComponent(r.id)}`,
      });
      if (ok) erzeugt++;
    }
  } catch (e) { console.warn("Rezept-Vorschauen übersprungen:", e.message); }

  try {
    const archiv = await supa("vk_archiv", { rpc: true });
    for (const v of archiv) {
      const ok = await stub({
        ordner: "verkostung", id: v.id, titel: v.titel,
        beschreibung: `Ergebnis der Verkostung „${v.titel}“ bei Koldingbräu.`,
        bild: bildUrl(v.bild_titel),
        zielpfad: `/verkostung.html?e=${encodeURIComponent(v.id)}`,
      });
      if (ok) erzeugt++;
    }
  } catch (e) { console.warn("Verkostungs-Vorschauen übersprungen:", e.message); }

  try {
    const zeilen = await supa("liga_daten", { rpc: true });
    const biere = new Map();
    for (const z of zeilen) if (!biere.has(z.bier_id)) biere.set(z.bier_id, z);
    for (const b of biere.values()) {
      const ok = await stub({
        ordner: "bier", id: b.bier_id, titel: b.name,
        beschreibung: `${[b.brauerei, b.stil].filter(Boolean).join(" · ") || "Bier"} in der Koldingbräu-Liga.`,
        bild: bildUrl(b.bild_kronkorken),
        zielpfad: `/liga.html?bier=${encodeURIComponent(b.bier_id)}`,
      });
      if (ok) erzeugt++;
    }
  } catch (e) { console.warn("Bier-Vorschauen übersprungen:", e.message); }

  console.log(`Vorschauseiten erzeugt: ${erzeugt}`);
}

main().catch(e => { console.warn("Vorschauseiten komplett übersprungen:", e.message); });
