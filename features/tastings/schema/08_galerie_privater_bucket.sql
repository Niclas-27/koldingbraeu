-- Ergänzung vom 27.10.2026: Teilnehmer-Fotos (Galerie einer Verkostung) sind ab jetzt nur für Braumeister/Admin
-- sichtbar. Eigener, nicht-öffentlicher Bucket statt des öffentlichen "bilder"-Buckets (Titelbild und
-- Bierbilder bleiben dort, weiterhin öffentlich). Bereits hochgeladene Galerie-Fotos der ersten Verkostung
-- wurden einmalig per Edge Function in den neuen Bucket verschoben.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verkostung-galerie', 'verkostung-galerie', false, 1572864, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 1572864, allowed_mime_types = array['image/jpeg'];

-- Braumeister dürfen selbst Fotos ergänzen/löschen/ansehen; Gäste laden ausschließlich über die Edge Function
-- "galerie-hochladen" hoch (die mit dem Service-Key arbeitet und die RLS damit umgeht) und haben sonst keinen Zugriff.
create policy "Braumeister laden Galeriebilder hoch" on storage.objects for insert to authenticated
  with check (bucket_id = 'verkostung-galerie' and private.ist_braumeister());
create policy "Braumeister sehen Galeriebilder" on storage.objects for select to authenticated
  using (bucket_id = 'verkostung-galerie' and private.ist_braumeister());
create policy "Braumeister löschen Galeriebilder" on storage.objects for delete to authenticated
  using (bucket_id = 'verkostung-galerie' and private.ist_braumeister());

-- vk_laden (Gäste-/Mitmach-Ansicht ?v=<code>): gibt die Bildpfade der Galerie nicht mehr zurück,
-- nur noch die eigene Hochlade-Anzahl (für die 3er-Grenze).
create or replace function public.vk_laden(p_code text, p_token uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $f$
declare v public.verkostungen; t public.teilnehmer; offen boolean; res jsonb;
begin
  v := private.vk_finden(p_code);
  if p_token is not null then select * into t from public.teilnehmer where verkostung_id = v.id and token = p_token; end if;
  offen := not v.blind or v.status = 'abgeschlossen';
  res := jsonb_build_object(
    'verkostung', jsonb_build_object('titel', v.titel, 'datum', v.datum, 'ort', v.ort, 'blind', v.blind, 'status', v.status, 'bild_titel', v.bild_titel),
    'teilnehmer', (select count(*) from public.teilnehmer where verkostung_id = v.id),
    'proben', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'nummer', p.nummer,
        'bier', case when offen then jsonb_build_object('name', b.name, 'brauerei', b.brauerei, 'eigen', b.eigen,
                                                        'stil', s.name, 'alkohol', b.alkohol,
                                                        'bild_kronkorken', b.bild_kronkorken, 'bild_flasche', b.bild_flasche) end,
        'schnitt', st.schnitt, 'anzahl', coalesce(st.anzahl, 0), 'nochmal', coalesce(st.nochmal, 0)
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
end $f$;

-- vk_ergebnis (öffentliche Ergebnisseite ?e=<uuid>): Galerie entfällt komplett aus der Antwort.
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
        'kommentare', coalesce((select jsonb_agg(w.kommentar order by w.note desc, w.angelegt) from public.bewertungen w
                     where w.probe_id = p.id and not w.ausgeblendet and w.kommentar is not null), '[]'::jsonb)
      ) order by p.nummer)
      from public.proben p join public.biere b on b.id = p.bier_id left join public.bierstile s on s.id = b.stil_id
      where p.verkostung_id = v.id), '[]'::jsonb));
end $f$;
