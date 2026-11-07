/* Koldingbräu – Verkostungen: öffentliche Ankündigung einer Verkostung (?a=<uuid>)
   Ziel des Einladungslinks. Zeigt Titel, Datum, Uhrzeit, Ort, Einladungstext, Titelbild und die Biere (bei blind
   nur die Anzahl) – aber keinen Code: mitmachen geht erst am Abend mit dem QR-Code bzw. Code vor Ort.
   Ist die Verkostung abgeschlossen, leitet die Seite aufs Ergebnis weiter, damit alte Einladungen im Chat
   dorthin führen. */
"use strict";
async function ankuendigungLaden(){
  stopTimer();
  const zurueck = `<p><a class="back" href="verkostung.html">← Alle Verkostungen</a></p>`;
  const {data, error} = await sb.rpc("vk_ankuendigung", {p_id: ankuendigungId});
  if(error){ main().innerHTML = zurueck + `<p class="empty">${esc(fehlertext(error))}</p>`; return; }
  const v = data;
  if(v.status === "abgeschlossen"){ location.replace("verkostung.html?e=" + encodeURIComponent(v.id)); return; }
  document.title = v.titel + " · Koldingbräu";
  const biere = v.blind
    ? `<p class="hint">${v.anzahlProben} ${v.anzahlProben===1?"Bier steht":"Biere stehen"} bereit – welche, wird erst am Ende verraten.</p>`
    : (v.proben.length ? `<ul class="plain">${v.proben.map(p=>`<li><b>${p.nummer}.</b> ${esc(p.name)} <small class="hint">${esc(bierZeile(p))}</small></li>`).join("")}</ul>` : `<p class="hint">Die Biere stehen noch nicht fest.</p>`);
  main().innerHTML = zurueck + `
    <div class="vk-head"><div><p class="kicker">Einladung zur Verkostung</p><h2>${esc(v.titel)}</h2>
      <p class="ank-wann">${esc(wannWo(v))}</p></div>${statusTag(v.status)}</div>
    ${v.bild_titel ? `<img class="titelbild" src="${esc(Bilder.url(v.bild_titel))}" alt="Titelbild der Verkostung">` : ""}
    ${(v.einladungstext||"").trim() ? `<div class="vk-card ank-text">${esc(v.einladungstext.trim())}</div>` : ""}
    ${sec(v.blind ? "Blind verkostet" : "Diese Biere gibt es", biere)}
    <form id="ankCode" class="vk-card codebox" novalidate>
      <p class="hint">${v.status==="laeuft" ? "Die Verkostung läuft gerade. Mitmachen kannst du mit dem Code oder QR-Code vor Ort." : "Am Abend bekommst du vor Ort den Code zum Mitmachen."}</p>
      <label class="f" for="ank_c">Code vom Abend<input id="ank_c" autocomplete="one-time-code" autocapitalize="off" spellcheck="false" placeholder="z. B. herbstrunde-q7x2pmz4"></label>
      <button class="btn" type="submit">Mitmachen</button>
    </form>`;
  $("#ankCode").onsubmit = e => { e.preventDefault(); const c = $("#ank_c").value.trim().toLowerCase().replace(/.*[?&]v=/, "").replace(/[^a-z0-9-]/g, ""); if(c) location.href = "verkostung.html?v="+encodeURIComponent(c); };
}
