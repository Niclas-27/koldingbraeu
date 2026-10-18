/* Koldingbräu – Verkostungen: Start – wählt die Ansicht anhand der Adresse */
"use strict";
KB.seite = {
  chrome(){},
  start(){
    document.addEventListener("visibilitychange", () => { if(document.visibilityState==="visible" && timer && $("#sheet").hidden) KB.seite.laden(); });
  },
  async laden(){
    if(ansicht === "gast"){ await ladeStile(); await gastLaden(); if(isBM()) bmHinweis(); }
    else if(ansicht === "detail") await detailLaden();
    else if(ansicht === "ergebnis") await ergebnisLaden();
    else await listeLaden();
  },
};
