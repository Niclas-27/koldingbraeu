-- Koldingbräu – Sude: Milchsäure getrennt nach Hauptguss/Nachguss (Stand 31.10.2026)
-- Setzt features/brews/schema/08_braugang_assistent.sql voraus.
--
-- Die ursprüngliche Spalte sude.milchsaeure (ein einziger Gesamtwert) war zu grob: beim Wassermachen wird
-- Hauptguss und Nachguss meist getrennt angesäuert, und der Wasserhärte-Rechner im Assistenten gibt auch
-- getrennte Empfehlungen aus. sude.milchsaeure bleibt stehen (ungenutzt, keine Daten darin), wird aber im
-- Assistenten nicht mehr angezeigt.

alter table public.sude add column milchsaeure_hauptguss numeric(6,1);
alter table public.sude add column milchsaeure_nachguss numeric(6,1);
comment on column public.sude.milchsaeure_hauptguss is 'ml Milchsäure im Hauptguss, ersetzt die zu grobe sude.milchsaeure (unbenutzt, bleibt stehen).';
comment on column public.sude.milchsaeure_nachguss is 'ml Milchsäure im Nachguss, ersetzt die zu grobe sude.milchsaeure (unbenutzt, bleibt stehen).';

-- Interne Angabe wie die übrigen neuen Wasser-Felder – kein zusätzliches anon-Grant nötig.
