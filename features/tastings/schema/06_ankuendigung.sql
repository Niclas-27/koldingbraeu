-- Ergänzung vom 20.10.2026: Öffentliche Ankündigung anstehender Verkostungen (ohne Login).
-- Zeigt Titel, Datum, Ort und – wenn nicht blind – die Biere, damit Gäste sich schon vorab
-- informieren können, bevor sie über den Code/QR-Link beitreten. Verrät keinen Code und keine
-- Teilnehmer-Namen; bei blinden Verkostungen bleiben auch die Biernamen verborgen.

create or replace function public.vk_angekuendigt() returns jsonb
language sql stable security definer set search_path = '' as $f$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', v.id, 'titel', v.titel, 'datum', v.datum, 'ort', v.ort, 'blind', v.blind, 'status', v.status, 'bild_titel', v.bild_titel,
    'teilnehmer', (select count(*) from public.teilnehmer t where t.verkostung_id = v.id),
    'anzahlProben', (select count(*) from public.proben p where p.verkostung_id = v.id),
    'proben', case when v.blind then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('nummer', p.nummer, 'name', b.name, 'brauerei', b.brauerei, 'eigen', b.eigen,
               'stil', s.name, 'alkohol', b.alkohol, 'bild_kronkorken', b.bild_kronkorken, 'bild_flasche', b.bild_flasche)
             order by p.nummer)
      from public.proben p join public.biere b on b.id = p.bier_id left join public.bierstile s on s.id = b.stil_id
      where p.verkostung_id = v.id), '[]'::jsonb) end
  ) order by v.datum asc, v.angelegt asc), '[]'::jsonb)
  from public.verkostungen v where v.status in ('vorbereitung', 'laeuft')
$f$;

revoke execute on function public.vk_angekuendigt() from public;
grant execute on function public.vk_angekuendigt() to anon, authenticated;
