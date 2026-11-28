-- 20: Empfehlung aus der Note ableiten (28.11.2026)
-- Seit 13.11.2026 fragt der Bogen „Würdest du es weiterempfehlen?“ nicht mehr ab; bewertungen.nochmal blieb seitdem leer.
-- Davon hängen aber der Titel „Einstimmig empfohlen“ und der Gleichstand-Entscheider der Rangliste ab. Seit dem Release
-- „Duftkarte“ setzt der Bogen nochmal = (Note >= 7) – ab „Gut · Gerne wieder“ (EMPFEHLUNG_AB in common.js).
-- Diese Datei füllt die Lücke der Bewertungen seit dem 13.11. mit derselben Regel. Ausdrückliche alte Antworten
-- (nochmal nicht null) bleiben unangetastet.
-- Schreibt Daten um: erst NACH dem Release und nur mit Freigabe des Nutzers ausführen.
update public.bewertungen set nochmal = (note >= 7) where nochmal is null;
