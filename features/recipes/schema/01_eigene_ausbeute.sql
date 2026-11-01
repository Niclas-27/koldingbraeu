-- Koldingbräu – Rezepte: eigene Sudhausausbeute je Rezept (Stand 01.11.2026)
-- rezepte.sudhausausbeute bleibt die Ausbeute laut Quelle (Autor des Rezepts) und dient als Bezug,
-- auf den die Schüttung umgerechnet wird. rezepte.eigene_ausbeute ist optional die Ausbeute, die
-- auf der eigenen Anlage mit genau diesem Rezept erreicht wird (z. B. niedriger bei viel Hafer/Weizen).
-- Leer = Wert des Anlagenprofils.
alter table public.rezepte add column eigene_ausbeute numeric(4,1) check (eigene_ausbeute between 30 and 95);
comment on column public.rezepte.sudhausausbeute is 'Sudhausausbeute laut Quelle (%) – Bezug der Mengen im Rezept';
comment on column public.rezepte.eigene_ausbeute is 'Eigene Sudhausausbeute für dieses Rezept (%), leer = Anlagenprofil';

-- Aufräumen: 0 bedeutet „keine Angabe“
update public.rezepte set sudhausausbeute = null where sudhausausbeute = 0;
-- Pale Ale ist ein eigenes Rezept: Quellwert = eigene Ausbeute
update public.rezepte set eigene_ausbeute = sudhausausbeute where name = 'Pale Ale' and sudhausausbeute between 30 and 95;
