-- Ergänzung vom 15.11.2026: Vorschaubild der Verkostungskarten als Bierdeckel
-- Die Karten unter „Bisherige Verkostungen“ zeigen standardmäßig eine aus den Kronkorken gezeichnete
-- Bierdeckel-Reihe (Bilder.deckelVorschau). Mit „eigenes_foto“ zeigt eine Verkostung stattdessen ihr Titelbild.
-- Das Titelbild selbst bleibt unverändert auf Einladung, Gastseite und Ergebnisseite.
-- Nur hinzufügend: kann vor dem Veröffentlichen ausgeführt werden (alte Seite ignoriert das neue Feld).

alter table public.verkostungen add column if not exists eigenes_foto boolean not null default false;
-- authenticated hat Tabellenrechte (select/insert/update) – gilt automatisch auch für die neue Spalte.

create or replace function public.vk_archiv() returns jsonb
language sql stable security definer set search_path = '' as $f$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', v.id, 'titel', v.titel, 'datum', v.datum, 'ort', v.ort, 'blind', v.blind, 'bild_titel', v.bild_titel,
    'eigenes_foto', v.eigenes_foto,
    'teilnehmer', (select count(*) from public.teilnehmer t where t.verkostung_id = v.id),
    'namen', coalesce((select jsonb_agg(t.name order by t.angelegt) from public.teilnehmer t where t.verkostung_id = v.id), '[]'::jsonb),
    'proben', coalesce((
      select jsonb_agg(jsonb_build_object('nummer', p.nummer, 'name', b.name, 'brauerei', b.brauerei, 'eigen', b.eigen,
               'stil', s.name, 'alkohol', b.alkohol, 'bild_kronkorken', b.bild_kronkorken, 'bild_flasche', b.bild_flasche,
               'schnitt', st.schnitt, 'anzahl', coalesce(st.anzahl, 0), 'nochmal', coalesce(st.nochmal, 0))
             order by st.schnitt desc nulls last, st.nochmal desc, p.nummer)
      from public.proben p join public.biere b on b.id = p.bier_id left join public.bierstile s on s.id = b.stil_id
      left join lateral (select round(avg(w.note)::numeric, 2) as schnitt, count(*) as anzahl, count(*) filter (where w.nochmal) as nochmal
                         from public.bewertungen w where w.probe_id = p.id and not w.ausgeblendet) st on true
      where p.verkostung_id = v.id), '[]'::jsonb)
  ) order by v.datum desc, v.angelegt desc), '[]'::jsonb)
  from public.verkostungen v where v.status = 'abgeschlossen'
$f$;
