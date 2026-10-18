-- Ergänzung vom 18.10.2026: Bilder (Titelbild und Galerie je Verkostung, Kronkorken/Flasche je Bier,
-- Foto/Etikett je Sud und Rezept). Dateien liegen im öffentlichen Storage-Bucket „bilder“ als JPEG;
-- zu jedem Bild „…/name.jpg“ gibt es ein Vorschaubild „…/name_t.jpg“. In der Datenbank steht nur der Pfad.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bilder', 'bilder', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Braumeister laden hoch, ersetzen und löschen; Gäste nur über die Edge Function „galerie-hochladen“
create policy "Braumeister laden Bilder hoch" on storage.objects for insert to authenticated
  with check (bucket_id = 'bilder' and private.ist_braumeister());
create policy "Braumeister ersetzen Bilder" on storage.objects for update to authenticated
  using (bucket_id = 'bilder' and private.ist_braumeister()) with check (bucket_id = 'bilder' and private.ist_braumeister());
create policy "Braumeister löschen Bilder" on storage.objects for delete to authenticated
  using (bucket_id = 'bilder' and private.ist_braumeister());
create policy "Braumeister sehen Bilddateien" on storage.objects for select to authenticated
  using (bucket_id = 'bilder' and private.ist_braumeister());

alter table public.verkostungen add column bild_titel text;
alter table public.biere add column bild_kronkorken text, add column bild_flasche text;
alter table public.sude add column bild_foto text, add column bild_etikett text;
grant select (bild_foto, bild_etikett) on public.sude to anon;
alter table public.rezepte add column bild_foto text, add column bild_etikett text;

create table public.verkostung_bilder (
  id uuid primary key default gen_random_uuid(),
  verkostung_id uuid not null references public.verkostungen(id) on delete cascade,
  pfad text not null,
  teilnehmer_id uuid references public.teilnehmer(id) on delete set null,      -- von einem Gast
  hochgeladen_von uuid references public.profile(id) on delete set null default auth.uid(),   -- von einem Braumeister
  angelegt timestamptz not null default now()
);
create index on public.verkostung_bilder (verkostung_id);
create index on public.verkostung_bilder (teilnehmer_id);
create index on public.verkostung_bilder (hochgeladen_von);
revoke all on public.verkostung_bilder from anon, authenticated;
alter table public.verkostung_bilder enable row level security;
grant select, insert, delete on public.verkostung_bilder to authenticated;
create policy "Braumeister sehen Galerie" on public.verkostung_bilder for select to authenticated using (private.ist_braumeister());
create policy "Braumeister ergänzen Galerie" on public.verkostung_bilder for insert to authenticated with check (private.ist_braumeister());
create policy "Braumeister löschen aus Galerie" on public.verkostung_bilder for delete to authenticated using (private.ist_braumeister());

-- Funktionen um Bilder erweitern
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
    'galerie', coalesce((select jsonb_agg(jsonb_build_object('pfad', g.pfad, 'mein', t.id is not null and g.teilnehmer_id = t.id) order by g.angelegt)
                         from public.verkostung_bilder g where g.verkostung_id = v.id), '[]'::jsonb),
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

create or replace function public.vk_archiv() returns jsonb
language sql stable security definer set search_path = '' as $f$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', v.id, 'titel', v.titel, 'datum', v.datum, 'ort', v.ort, 'blind', v.blind, 'bild_titel', v.bild_titel,
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

create or replace function public.vk_ergebnis(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $f$
declare v public.verkostungen;
begin
  select * into v from public.verkostungen where id = p_id and status = 'abgeschlossen';
  if not found then raise exception 'Diese Verkostung gibt es nicht oder sie ist noch nicht abgeschlossen.' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'verkostung', jsonb_build_object('id', v.id, 'titel', v.titel, 'datum', v.datum, 'ort', v.ort, 'blind', v.blind, 'bild_titel', v.bild_titel),
    'teilnehmer', coalesce((select jsonb_agg(t.name order by t.angelegt) from public.teilnehmer t where t.verkostung_id = v.id), '[]'::jsonb),
    'galerie', coalesce((select jsonb_agg(g.pfad order by g.angelegt) from public.verkostung_bilder g where g.verkostung_id = v.id), '[]'::jsonb),
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

drop function public.liga_daten();
create function public.liga_daten() returns table (bier_id uuid, name text, brauerei text, eigen boolean, stil text,
  bild_kronkorken text, bild_flasche text, verkostung_id uuid, titel text, datum date, summe bigint, anzahl bigint, nochmal bigint)
language sql stable security definer set search_path = '' as $f$
  select b.id, b.name, b.brauerei, b.eigen, s.name, b.bild_kronkorken, b.bild_flasche, v.id, v.titel, v.datum,
         sum(w.note), count(*), count(*) filter (where w.nochmal)
  from public.bewertungen w
  join public.proben p on p.id = w.probe_id
  join public.verkostungen v on v.id = p.verkostung_id and v.status = 'abgeschlossen'
  join public.biere b on b.id = p.bier_id
  left join public.bierstile s on s.id = b.stil_id
  where not w.ausgeblendet
  group by b.id, b.name, b.brauerei, b.eigen, s.name, b.bild_kronkorken, b.bild_flasche, v.id, v.titel, v.datum
$f$;
revoke execute on function public.liga_daten() from public;
grant execute on function public.liga_daten() to anon, authenticated;
