-- Ergänzung vom 18.10.2026: öffentliche Ergebnisseiten
-- Öffentliche Ergebnisseite einer abgeschlossenen Verkostung: Vornamen der Teilnehmer, Kommentare ohne Namen
create or replace function public.vk_ergebnis(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $f$
declare v public.verkostungen;
begin
  select * into v from public.verkostungen where id = p_id and status = 'abgeschlossen';
  if not found then raise exception 'Diese Verkostung gibt es nicht oder sie ist noch nicht abgeschlossen.' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'verkostung', jsonb_build_object('id', v.id, 'titel', v.titel, 'datum', v.datum, 'ort', v.ort, 'blind', v.blind),
    'teilnehmer', coalesce((select jsonb_agg(t.name order by t.angelegt) from public.teilnehmer t where t.verkostung_id = v.id), '[]'::jsonb),
    'proben', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nummer', p.nummer, 'bier_id', b.id, 'name', b.name, 'brauerei', b.brauerei, 'eigen', b.eigen, 'stil', s.name, 'alkohol', b.alkohol,
        'schnitt', (select round(avg(w.note)::numeric, 2) from public.bewertungen w where w.probe_id = p.id and not w.ausgeblendet),
        'anzahl', (select count(*) from public.bewertungen w where w.probe_id = p.id and not w.ausgeblendet),
        'nochmal', (select count(*) from public.bewertungen w where w.probe_id = p.id and not w.ausgeblendet and w.nochmal),
        'noten', coalesce((select jsonb_agg(w.note order by w.note desc) from public.bewertungen w where w.probe_id = p.id and not w.ausgeblendet), '[]'::jsonb),
        'merkmale', coalesce((select jsonb_object_agg(x.k, jsonb_build_object('wert', x.w, 'n', x.n)) from (
                       select m.key as k, round(avg((m.value)::numeric), 1) as w, count(*) as n
                       from public.bewertungen w, jsonb_each(w.merkmale) m where w.probe_id = p.id and not w.ausgeblendet group by m.key) x), '{}'::jsonb),
        'geruch', coalesce((select jsonb_object_agg(x.t, x.n) from (select g as t, count(*) as n from public.bewertungen w, unnest(w.geruch) g
                     where w.probe_id = p.id and not w.ausgeblendet group by g) x), '{}'::jsonb),
        'fehler', coalesce((select jsonb_object_agg(x.t, x.n) from (select g as t, count(*) as n from public.bewertungen w, unnest(w.fehler) g
                     where w.probe_id = p.id and not w.ausgeblendet group by g) x), '{}'::jsonb),
        'kommentare', coalesce((select jsonb_agg(w.kommentar order by w.note desc, w.angelegt) from public.bewertungen w
                     where w.probe_id = p.id and not w.ausgeblendet and w.kommentar is not null), '[]'::jsonb)
      ) order by p.nummer)
      from public.proben p join public.biere b on b.id = p.bier_id left join public.bierstile s on s.id = b.stil_id
      where p.verkostung_id = v.id), '[]'::jsonb));
end $f$;
revoke execute on function public.vk_ergebnis(uuid) from public;
grant execute on function public.vk_ergebnis(uuid) to anon, authenticated;

-- Übersicht: zusätzlich die Vornamen der Teilnehmer
create or replace function public.vk_archiv() returns jsonb
language sql stable security definer set search_path = '' as $f$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', v.id, 'titel', v.titel, 'datum', v.datum, 'ort', v.ort, 'blind', v.blind,
    'teilnehmer', (select count(*) from public.teilnehmer t where t.verkostung_id = v.id),
    'namen', coalesce((select jsonb_agg(t.name order by t.angelegt) from public.teilnehmer t where t.verkostung_id = v.id), '[]'::jsonb),
    'proben', coalesce((
      select jsonb_agg(jsonb_build_object('nummer', p.nummer, 'name', b.name, 'brauerei', b.brauerei, 'eigen', b.eigen,
               'stil', s.name, 'alkohol', b.alkohol, 'schnitt', st.schnitt, 'anzahl', coalesce(st.anzahl, 0), 'nochmal', coalesce(st.nochmal, 0))
             order by st.schnitt desc nulls last, st.nochmal desc, p.nummer)
      from public.proben p join public.biere b on b.id = p.bier_id left join public.bierstile s on s.id = b.stil_id
      left join lateral (select round(avg(w.note)::numeric, 2) as schnitt, count(*) as anzahl, count(*) filter (where w.nochmal) as nochmal
                         from public.bewertungen w where w.probe_id = p.id and not w.ausgeblendet) st on true
      where p.verkostung_id = v.id), '[]'::jsonb)
  ) order by v.datum desc, v.angelegt desc), '[]'::jsonb)
  from public.verkostungen v where v.status = 'abgeschlossen'
$f$;

-- Liga: zusätzlich Verkostung (id, titel), damit jedes Bier auf seine Abende verlinken kann
drop function public.liga_daten();
create function public.liga_daten() returns table (bier_id uuid, name text, brauerei text, eigen boolean, stil text,
  verkostung_id uuid, titel text, datum date, summe bigint, anzahl bigint, nochmal bigint)
language sql stable security definer set search_path = '' as $f$
  select b.id, b.name, b.brauerei, b.eigen, s.name, v.id, v.titel, v.datum, sum(w.note), count(*), count(*) filter (where w.nochmal)
  from public.bewertungen w
  join public.proben p on p.id = w.probe_id
  join public.verkostungen v on v.id = p.verkostung_id and v.status = 'abgeschlossen'
  join public.biere b on b.id = p.bier_id
  left join public.bierstile s on s.id = b.stil_id
  where not w.ausgeblendet
  group by b.id, b.name, b.brauerei, b.eigen, s.name, v.id, v.titel, v.datum
$f$;
revoke execute on function public.liga_daten() from public;
grant execute on function public.liga_daten() to anon, authenticated;
