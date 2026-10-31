-- Koldingbräu – Sude: gewünschte Karbonisierung (Stand 31.10.2026)
-- Setzt features/brews/schema/08_braugang_assistent.sql voraus.
--
-- Für den Zucker-Rechner im Abfüllung-Schritt des Braugang-Assistenten (siehe brews.js,
-- Brau.primingZucker() in lib/brau.js): dieselbe Einheit (g/l) wie beim bereits bestehenden
-- rezepte.karbonisierung, damit sich künftig auch ein Rezept-Zielwert übernehmen ließe.

alter table public.sude add column karbonisierung numeric(4,1);
comment on column public.sude.karbonisierung is
  'Gewünschte Karbonisierung in g/l CO2, analog zu rezepte.karbonisierung.';

-- Interne Angabe wie notizen/wasserhaerte – kein zusätzliches anon-Grant nötig.
