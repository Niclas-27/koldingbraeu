-- 16: Ergebnisseite – Punktwolke auf der Geschmackskarte (13.11.2026)
-- Additiv: vk_ergebnis liefert je Probe zusätzlich 'kreis' = Liste der einzelnen Punkte [suesse, bitter] (0–10)
-- aus den nicht ausgeblendeten Bewertungen. Keine Namen, Reihenfolge zufällig – wer welchen Punkt gesetzt hat,
-- lässt sich nicht ablesen (wie bei den Einzelnoten). Sonst unverändert gegenüber 09_galerie_privater_bucket.sql.
-- Kann vor dem Release laufen: die alte Oberfläche ignoriert das neue Feld, die neue kommt auch ohne aus.
create or replace function public.vk_ergebnis(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $f$
declare v public.verkostungen;
begin
  select * into v from public.verkostungen where id = p_id and status = 'abgeschlossen';
  if not found then raise exception 'Diese Verkostung gibt es nicht oder sie ist noch nicht abgeschlossen.' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'verkostung', jsonb_build_object('id', v.id, 'titel', v.titel, 'datum', v.datum, 'ort', v.ort, 'blind', v.blind, 'bild_titel', v.bild_titel),
    'teilnehmer', coalesce((select jsonb_agg(t.name order by t.angelegt) from public.teilnehmer t where t.verkostung_id = v.id), '[]'::jsonb),
    'proben', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nummer', p.nummer, 'bier_id', b.id, 'name', b.name, 'brauerei', b.brauerei, 'eigen', b.eigen, 'stil', s.name, 'alkohol', b.alkohol,
        'bild_kronkorken', b.bild_kronkorken, 'bild_flasche', b.bild_flasche,
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
        -- neu (16): je sichtbarer Bewertung mit Geschmackskarte ein Punkt [suesse, bitter] – ohne Namen, in zufälliger Reihenfolge
        'kreis', coalesce((select jsonb_agg(jsonb_build_array((w.merkmale->>'suesse')::numeric, (w.merkmale->>'bitter')::numeric) order by random())
                     from public.bewertungen w where w.probe_id = p.id and not w.ausgeblendet
                       and jsonb_typeof(w.merkmale->'suesse') = 'number' and jsonb_typeof(w.merkmale->'bitter') = 'number'), '[]'::jsonb),
        'kommentare', coalesce((select jsonb_agg(w.kommentar order by w.note desc, w.angelegt) from public.bewertungen w
                     where w.probe_id = p.id and not w.ausgeblendet and w.kommentar is not null), '[]'::jsonb)
      ) order by p.nummer)
      from public.proben p join public.biere b on b.id = p.bier_id left join public.bierstile s on s.id = b.stil_id
      where p.verkostung_id = v.id), '[]'::jsonb));
end $f$;
