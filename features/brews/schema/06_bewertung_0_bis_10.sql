-- Koldingbräu – Sude: Bewertung von Schulnote auf 0–10 umstellen (29.10.2026)
-- Bisher eine Schulnote als Freitext (1 = beste, 6 = schlechteste Note, + macht sie 0.3 besser,
-- - macht sie 0.3 schlechter – gleiche Lesart wie die bisherige gradeVal()-Funktion im Braubuch).
-- Neu: eine Zahl von 0 bis 10 mit einer Nachkommastelle, 10 = beste Note, wie bei den
-- Verkostungs-Gesamtnoten. Die alte Schulnote bleibt zur Nachvollziehbarkeit in einer eigenen
-- Spalte erhalten.

alter table public.sude add column bewertung_schulnote_alt text;
update public.sude set bewertung_schulnote_alt = bewertung where bewertung is not null;

-- Schulnote erkennen (erste Ziffer, direkt gefolgt von optional + oder -) und linear von
-- [1 (beste) .. 6 (schlechteste)] auf [10 .. 0] abbilden, auf 0..10 begrenzt (z. B. "1+" wäre
-- rechnerisch besser als die beste Schulnote und wird auf 10 gekappt).
with erkannt as (
  select id,
    (regexp_match(bewertung, '(\d)\s*([+-])?'))[1]::numeric as ziffer,
    (regexp_match(bewertung, '(\d)\s*([+-])?'))[2] as zeichen
  from public.sude
  where bewertung is not null and trim(bewertung) <> ''
),
umgerechnet as (
  select id,
    case when ziffer is null then null
      else greatest(0, least(10, round(
        (6 - (ziffer + case zeichen when '+' then -0.3 when '-' then 0.3 else 0 end)) / 5.0 * 10
      , 1))) end as note
  from erkannt
)
update public.sude s set bewertung = u.note::text from umgerechnet u where s.id = u.id;

alter table public.sude alter column bewertung type numeric(3,1) using nullif(bewertung, '')::numeric;
alter table public.sude add constraint sude_bewertung_bereich check (bewertung is null or bewertung between 0 and 10);

comment on column public.sude.bewertung is 'Gesamtnote 0–10, 10 = beste Note (wie Verkostungs-Gesamtnoten).';
comment on column public.sude.bewertung_schulnote_alt is 'Alte Bewertung als Schulnote (Freitext), nur zur Nachvollziehbarkeit – wird nicht mehr im Braubuch angezeigt oder bearbeitet.';
