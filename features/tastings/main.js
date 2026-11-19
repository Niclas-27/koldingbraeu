/* Koldingbräu – Verkostungen: Start – wählt die Ansicht anhand der Adresse */
"use strict";
KB.seite = {
  chrome(){},
  start(){
    // Zurück auf der Seite (Handy entsperrt): sofort neu laden – Gäste auch bei offenem Blatt (siehe startTimer)
    document.addEventListener("visibilitychange", () => { if(document.visibilityState==="visible" && timer && (ansicht === "gast" || $("#sheet").hidden)) KB.seite.laden(); });
  },
  async laden(){
    if(ansicht === "gast"){ await ladeStile(); await gastLaden(); if(isBM()) bmHinweis(); }
    else if(ansicht === "detail") await detailLaden();
    else if(ansicht === "ergebnis") await ergebnisLaden();
    else if(ansicht === "ankuendigung") await ankuendigungLaden();
    else await listeLaden();
  },
};
