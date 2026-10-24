-- Ergänzung vom 25.10.2026: Öffentliche Detailseite je Bier (liga.html?bier=<uuid>)
-- Fasst alle Bewertungen eines Biers aus allen abgeschlossenen Verkostungen zusammen (Durchschnitt),
-- unabhängig davon, in wie vielen Proben es dabei war. Aufbau wie bei vk_ergebnis(), nur über alle
-- Verkostungen hinweg statt nur eine.
create or replace function public.bier_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $f$
declare b public.biere;
begin
  select * into b from public.biere where id = p_id;
  if not found then raise exception 'Dieses Bier gibt es nicht.' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'bier', jsonb_build_object('id', b.id, 'name', b.name, 'brauerei', b.brauerei, 'eigen', b.eigen,
              'stil', (select s.name from public.bierstile s where s.id = b.stil_id), 'alkohol', b.alkohol,
              'bild_kronkorken', b.bild_kronkorken, 'bild_flasche', b.bild_flasche),
    'schnitt', (select round(avg(w.note)::numeric, 2) from public.bewertungen w
                join public.proben p on p.id = w.probe_id join public.verkostungen v on v.id = p.verkostung_id and v.status = 'abgeschlossen'
                where p.bier_id = b.id and not w.ausgeblendet),
    'anzahl', (select count(*) from public.bewertungen w
                join public.proben p on p.id = w.probe_id join public.verkostungen v on v.id = p.verkostung_id and v.status = 'abgeschlossen'
                where p.bier_id = b.id and not w.ausgeblendet),
    'nochmal', (select count(*) filter (where w.nochmal) from public.bewertungen w
                join public.proben p on p.id = w.probe_id join public.verkostungen v on v.id = p.verkostung_id and v.status = 'abgeschlossen'
                where p.bier_id = b.id and not w.ausgeblendet),
    'noten', coalesce((select jsonb_agg(w.note order by w.note desc) from public.bewertungen w
                join public.proben p on p.id = w.probe_id join public.verkostungen v on v.id = p.verkostung_id and v.status = 'abgeschlossen'
                where p.bier_id = b.id and not w.ausgeblendet), '[]'::jsonb),
    'merkmale', coalesce((select jsonb_object_agg(x.k, jsonb_build_object('wert', x.w, 'n', x.n)) from (
                   select m.key as k, round(avg((m.value)::numeric), 1) as w, count(*) as n
                   from public.bewertungen w
                   join public.proben p on p.id = w.probe_id join public.verkostungen v on v.id = p.verkostung_id and v.status = 'abgeschlossen',
                     jsonb_each(w.merkmale) m
                   where p.bier_id = b.id and not w.ausgeblendet group by m.key) x), '{}'::jsonb),
    'geruch', coalesce((select jsonb_object_agg(x.t, x.n) from (
                 select g as t, count(*) as n from public.bewertungen w
                 join public.proben p on p.id = w.probe_id join public.verkostungen v on v.id = p.verkostung_id and v.status = 'abgeschlossen',
                   unnest(w.geruch) g
                 where p.bier_id = b.id and not w.ausgeblendet group by g) x), '{}'::jsonb),
    'fehler', coalesce((select jsonb_object_agg(x.t, x.n) from (
                 select g as t, count(*) as n from public.bewertungen w
                 join public.proben p on p.id = w.probe_id join public.verkostungen v on v.id = p.verkostung_id and v.status = 'abgeschlossen',
                   unnest(w.fehler) g
                 where p.bier_id = b.id and not w.ausgeblendet group by g) x), '{}'::jsonb),
    'kommentare', coalesce((select jsonb_agg(w.kommentar order by w.note desc, w.angelegt) from public.bewertungen w
                join public.proben p on p.id = w.probe_id join public.verkostungen v on v.id = p.verkostung_id and v.status = 'abgeschlossen'
                where p.bier_id = b.id and not w.ausgeblendet and w.kommentar is not null), '[]'::jsonb),
    'verkostungen', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'titel', v.titel, 'datum', v.datum,
               'schnitt', st.schnitt, 'anzahl', coalesce(st.anzahl, 0), 'nochmal', coalesce(st.nochmal, 0)) order by v.datum desc)
      from public.proben p join public.verkostungen v on v.id = p.verkostung_id and v.status = 'abgeschlossen'
      left join lateral (select round(avg(w.note)::numeric, 2) as schnitt, count(*) as anzahl, count(*) filter (where w.nochmal) as nochmal
                         from public.bewertungen w where w.probe_id = p.id and not w.ausgeblendet) st on true
      where p.bier_id = b.id), '[]'::jsonb)
  );
end $f$;
revoke execute on function public.bier_detail(uuid) from public;
grant execute on function public.bier_detail(uuid) to anon, authenticated;
