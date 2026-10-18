/* Koldingbräu – Rezepte: Start – wählt die Ansicht anhand der Adresse */
"use strict";
KB.seite = {
  async laden(){
    await ladeAnlage();
    if(rezeptId) await detailLaden();
    else await listeZeigen();
  },
};
