-- 19: Duftkarte im Bewertungsbogen (28.11.2026)
-- Die Seite „Riechen“ bekommt eine Karte wie das Geschmacksbild: oben kräftig, unten dezent (Intensität), links malzig,
-- rechts fruchtig. Gespeichert in bewertungen.merkmale unter zwei NEUEN Schlüsseln (0–10):
--   duft_staerke  0 = dezent … 10 = kräftig
--   duft_richtung 0 = malzig … 10 = fruchtig (Hopfen, Hefe)
-- Bewusst nicht die alten Regler „intensitaet“/„malzhopfen“: „malzhopfen“ war eine Geschmacksfrage (Betonung), und rund
-- 70 ältere Bewertungen tragen diese Werte – sie sollen nicht in die Duftkarte rutschen.
-- Additiv, VOR dem Release ausführen: vk_bewerten / vk_admin_bewerten lassen die zwei Schlüssel zu (sonst würden sie
-- stillschweigend verworfen), vk_ergebnis liefert je Probe zusätzlich 'duft'. Sonst unverändert gegenüber 01/03/17;
-- die alte Oberfläche schickt die Schlüssel nicht und ignoriert das neue Feld.

create or replace function public.vk_bewerten(p_code text, p_token uuid, p_probe uuid, p_note integer,
  p_merkmale jsonb default '{}', p_geruch text[] default '{}', p_fehler text[] default '{}',
  p_nochmal boolean default null, p_kommentar text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $f$
declare v public.verkostungen; t uuid; m jsonb;
  erlaubt text[] := array['farbe','klarheit','schaum','intensitaet','bitter','suesse','malzhopfen','saeure','koerper','kohlensaeure','abgang','duft_staerke','duft_richtung'];
begin
  v := private.vk_finden(p_code);
  t := private.vk_gast(v.id, p_token);
  if v.status <> 'laeuft' then raise exception 'Bewerten geht nur, solange die Verkostung läuft.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.proben where id = p_probe and verkostung_id = v.id) then
    raise exception 'Dieses Bier gehört nicht zu dieser Verkostung.' using errcode = 'P0001'; end if;
  if p_note is null or p_note < 0 or p_note > 10 then raise exception 'Bitte eine Note von 0 bis 10 wählen.' using errcode = 'P0001'; end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into m
    from jsonb_each(case when jsonb_typeof(p_merkmale) = 'object' then p_merkmale else '{}'::jsonb end)
    where key = any(erlaubt) and case when jsonb_typeof(value) = 'number' then (value)::numeric between 0 and 10 else false end;
  insert into public.bewertungen as w (probe_id, teilnehmer_id, note, merkmale, geruch, fehler, nochmal, kommentar)
  values (p_probe, t, p_note, m,
          (select coalesce(array_agg(left(x, 30)), '{}') from (select x from unnest(coalesce(p_geruch, '{}')) x limit 20) a),
          (select coalesce(array_agg(left(x, 30)), '{}') from (select x from unnest(coalesce(p_fehler, '{}')) x limit 20) a),
          p_nochmal, nullif(left(trim(coalesce(p_kommentar, '')), 1000), ''))
  on conflict (probe_id, teilnehmer_id) do update
    set note = excluded.note, merkmale = excluded.merkmale, geruch = excluded.geruch, fehler = excluded.fehler,
        nochmal = excluded.nochmal, kommentar = excluded.kommentar, geaendert = now();
  return jsonb_build_object('ok', true);
end $f$;

create or replace function public.vk_admin_bewerten(p_probe uuid, p_teilnehmer uuid, p_note integer,
  p_merkmale jsonb default '{}', p_geruch text[] default '{}', p_fehler text[] default '{}',
  p_nochmal boolean default null, p_kommentar text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $f$
declare m jsonb; alt public.bewertungen;
  erlaubt text[] := array['farbe','klarheit','schaum','intensitaet','bitter','suesse','malzhopfen','saeure','koerper','kohlensaeure','abgang','duft_staerke','duft_richtung'];
begin
  if not private.ist_admin() then raise exception 'Das darf nur der Admin.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.proben p join public.teilnehmer t on t.verkostung_id = p.verkostung_id
                 where p.id = p_probe and t.id = p_teilnehmer) then
    raise exception 'Bier und Teilnehmer gehören nicht zur selben Verkostung.' using errcode = 'P0001'; end if;
  if p_note is null or p_note < 0 or p_note > 10 then raise exception 'Bitte eine Note von 0 bis 10 wählen.' using errcode = 'P0001'; end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into m
    from jsonb_each(case when jsonb_typeof(p_merkmale) = 'object' then p_merkmale else '{}'::jsonb end)
    where key = any(erlaubt) and case when jsonb_typeof(value) = 'number' then (value)::numeric between 0 and 10 else false end;
  select * into alt from public.bewertungen where probe_id = p_probe and teilnehmer_id = p_teilnehmer;
  if alt.id is null then
    insert into public.bewertungen (probe_id, teilnehmer_id, note, merkmale, geruch, fehler, nochmal, kommentar, nachgetragen, admin_geaendert, admin_von)
    values (p_probe, p_teilnehmer, p_note, m,
            (select coalesce(array_agg(left(x, 30)), '{}') from (select x from unnest(coalesce(p_geruch, '{}')) x limit 20) a),
            (select coalesce(array_agg(left(x, 30)), '{}') from (select x from unnest(coalesce(p_fehler, '{}')) x limit 20) a),
            p_nochmal, nullif(left(trim(coalesce(p_kommentar, '')), 1000), ''), true, now(), auth.uid());
  else
    update public.bewertungen set
      original_note = coalesce(alt.original_note, case when alt.nachgetragen then null else alt.note end),
      note = p_note, merkmale = m,
      geruch = (select coalesce(array_agg(left(x, 30)), '{}') from (select x from unnest(coalesce(p_geruch, '{}')) x limit 20) a),
      fehler = (select coalesce(array_agg(left(x, 30)), '{}') from (select x from unnest(coalesce(p_fehler, '{}')) x limit 20) a),
      nochmal = p_nochmal, kommentar = nullif(left(trim(coalesce(p_kommentar, '')), 1000), ''),
      geaendert = now(), admin_geaendert = now(), admin_von = auth.uid()
    where id = alt.id;
  end if;
  return jsonb_build_object('ok', true);
end $f$;

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
        'kreis', coalesce((select jsonb_agg(jsonb_build_array((w.merkmale->>'suesse')::numeric, (w.merkmale->>'bitter')::numeric) order by random())
                     from public.bewertungen w where w.probe_id = p.id and not w.ausgeblendet
                       and jsonb_typeof(w.merkmale->'suesse') = 'number' and jsonb_typeof(w.merkmale->'bitter') = 'number'), '[]'::jsonb),
        'kommentare', coalesce((select jsonb_agg(w.kommentar order by w.note desc, w.angelegt) from public.bewertungen w
                     where w.probe_id = p.id and not w.ausgeblendet and w.kommentar is not null), '[]'::jsonb),
        -- neu (19): je Gast seine Lage auf der Duftkarte als [richtung, staerke] (0–10), Reihenfolge zufällig
        'duft', coalesce((select jsonb_agg(jsonb_build_array((w.merkmale->>'duft_richtung')::numeric, (w.merkmale->>'duft_staerke')::numeric) order by random())
                     from public.bewertungen w where w.probe_id = p.id and not w.ausgeblendet
                       and jsonb_typeof(w.merkmale->'duft_richtung') = 'number' and jsonb_typeof(w.merkmale->'duft_staerke') = 'number'), '[]'::jsonb),
        -- neu (17): die Zusammenfassung in ein, zwei Sätzen (leer = null)
        'zusammenfassung', nullif(btrim(p.zusammenfassung), '')
      ) order by p.nummer)
      from public.proben p join public.biere b on b.id = p.bier_id left join public.bierstile s on s.id = b.stil_id
      where p.verkostung_id = v.id), '[]'::jsonb));
end $f$;
