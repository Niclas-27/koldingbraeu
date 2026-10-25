-- Ergänzung vom 25.10.2026: Aufnahmedatum je Foto (aus den EXIF-Daten der Datei gelesen, beim Hochladen
-- im Browser ermittelt – ohne EXIF-Datum bleibt die Spalte leer und die Oberfläche zeigt stattdessen
-- das Hochlade-Datum (angelegt) an).

alter table public.sud_bilder add column aufgenommen date;
