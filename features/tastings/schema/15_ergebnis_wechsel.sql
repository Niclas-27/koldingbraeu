-- 07.11.2026: Nach dem Abschließen wechselt die Gästeseite automatisch auf die Ergebnisseite (?e=<id>) und zeigt dort
-- je Bier die eigene Note. Dafür liefert vk_laden – NUR wenn die Verkostung abgeschlossen ist – zusätzlich die
-- Verkostungs-ID ('id') und je Probe die 'bier_id' (über sie ordnet die Ergebnisseite die eigenen Noten zu).
-- Rein additiv (neue JSON-Felder), darf vor dem Frontend laufen. Angewendet am 07.11.2026.
create or replace function public.vk_laden(p_code text, p_token uuid default null::uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v public.verkostungen; t public.teilnehmer; offen boolean; fertig boolean; res jsonb;
begin
  v := private.vk_finden(p_code);
  if p_token is not null then select * into t from public.teilnehmer where verkostung_id = v.id and token = p_token; end if;
  offen := not v.blind or v.status = 'abgeschlossen';
  fertig := v.status = 'abgeschlossen';
  res := jsonb_build_object(
    'verkostung', jsonb_build_object('id', case when fertig then v.id end, 'titel', v.titel, 'datum', v.datum, 'ort', v.ort, 'blind', v.blind, 'status', v.status, 'bild_titel', v.bild_titel),
    'teilnehmer', (select count(*) from public.teilnehmer where verkostung_id = v.id),
    'proben', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'nummer', p.nummer, 'bier_id', case when fertig then p.bier_id end,
        'bier', case when offen then jsonb_build_object('name', b.name, 'brauerei', b.brauerei, 'eigen', b.eigen,
                                                        'stil', s.name, 'alkohol', b.alkohol,
                                                        'bild_kronkorken', b.bild_kronkorken, 'bild_flasche', b.bild_flasche) end,
        'schnitt', case when fertig then st.schnitt end,
        'anzahl', case when fertig then coalesce(st.anzahl, 0) else 0 end,
        'nochmal', case when fertig then coalesce(st.nochmal, 0) else 0 end
      ) order by p.nummer)
      from public.proben p join public.biere b on b.id = p.bier_id left join public.bierstile s on s.id = b.stil_id
      left join lateral (select round(avg(w.note)::numeric, 2) as schnitt, count(*) as anzahl,
                                count(*) filter (where w.nochmal) as nochmal
                         from public.bewertungen w where w.probe_id = p.id and not w.ausgeblendet) st on true
      where p.verkostung_id = v.id), '[]'::jsonb),
    'ich', case when t.id is null then null else jsonb_build_object(
      'name', t.name,
      'bilder', (select count(*) from public.verkostung_bilder g where g.teilnehmer_id = t.id),
      'bewertungen', coalesce((select jsonb_agg(jsonb_build_object('probe_id', w.probe_id, 'note', w.note, 'merkmale', w.merkmale,
                         'geruch', w.geruch, 'fehler', w.fehler, 'nochmal', w.nochmal, 'kommentar', w.kommentar))
                       from public.bewertungen w where w.teilnehmer_id = t.id), '[]'::jsonb),
      'vorschlaege', coalesce((select jsonb_agg(jsonb_build_object('name', x.name, 'brauerei', x.brauerei, 'stil', x.stil, 'status', x.status) order by x.angelegt)
                       from public.vorschlaege x where x.teilnehmer_id = t.id), '[]'::jsonb)) end);
  return res;
end $function$;
