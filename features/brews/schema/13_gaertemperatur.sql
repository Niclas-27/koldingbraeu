-- Koldingbräu – Sude: höchste Gärtemperatur (Stand 22.11.2026)
-- Setzt features/brews/schema/12_ziel_kh_speise.sql voraus.
-- Nur Hinzufügen – darf vor dem Release der Oberfläche laufen (siehe HANDOVER.md 2.5). Lief am 22.11.2026.
--
-- Für den Zucker-Rechner im Abfüllung-Schritt: aus der höchsten Temperatur, die das Bier bei/nach der Gärung
-- erreicht hat, ergibt sich die Restkohlensäure (Brau.restkohlensaeure in lib/brau.js). Ohne Wert rechnet der
-- Assistent wie bisher mit 1,7 g/l (ca. 18–20 °C).

alter table public.sude add column gaertemperatur numeric(4,1);
comment on column public.sude.gaertemperatur is
  'Höchste Temperatur des Biers bei/nach der Gärung in °C – bestimmt die Restkohlensäure für den Zucker-Rechner.';

-- Interne Angabe wie karbonisierung – kein anon-Grant.
