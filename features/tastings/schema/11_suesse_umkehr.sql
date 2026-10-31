-- Süße-Regler im Verkostungsbogen wird von „süß (0) – trocken (10)“ auf „trocken (0) – süß (10)“
-- gedreht (konsistent mit den anderen Reglern, z. B. Bittere: mild (0) – bitter (10); Betonung:
-- malzig (0) – hopfig (10) – das namensgebende Extrem steht jeweils rechts). Bestehende
-- Bewertungen bekommen ihren suesse-Wert umgekehrt (10 - alt), damit die ursprünglich gemeinte
-- Süße erhalten bleibt und nicht nach der Umstellung verkehrt angezeigt wird.
-- Bereits live gegen die Datenbank gefahren am 31.10.2026 (31 betroffene Zeilen).
update public.bewertungen
set merkmale = jsonb_set(merkmale, '{suesse}', to_jsonb(10 - (merkmale->>'suesse')::int))
where merkmale ? 'suesse';
