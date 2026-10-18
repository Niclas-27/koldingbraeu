-- Ergänzung vom 18.10.2026: Der Admin darf Bewertungen nachträglich ändern und fehlende nachtragen.
-- Jede Änderung wird vermerkt; die ursprüngliche Note bleibt erhalten (nur intern sichtbar).

alter table public.bewertungen
  add column original_note smallint check (original_note between 0 and 10),
  add column admin_geaendert timestamptz,
  add column admin_von uuid references public.profile(id) on delete set null,
  add column nachgetragen boolean not null default false;
create index on public.bewertungen (admin_von);

-- Teilnehmer nachträglich hinzufügen (z. B. wenn jemand gefehlt hat)
create function public.vk_admin_teilnehmer(p_verkostung uuid, p_name text) returns uuid
language plpgsql volatile security definer set search_path = '' as $f$
declare n text := trim(coalesce(p_name, '')); t uuid;
begin
  if not private.ist_admin() then raise exception 'Das darf nur der Admin.' using errcode = 'P0001'; end if;
  if length(n) < 1 or length(n) > 40 then raise exception 'Bitte einen Namen mit 1 bis 40 Zeichen eingeben.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.verkostungen where id = p_verkostung) then raise exception 'Diese Verkostung gibt es nicht.' using errcode = 'P0002'; end if;
  insert into public.teilnehmer (verkostung_id, name) values (p_verkostung, n) returning id into t;
  return t;
end $f$;

-- Bewertung ändern oder nachtragen – unabhängig vom Status der Verkostung
create function public.vk_admin_bewerten(p_probe uuid, p_teilnehmer uuid, p_note integer,
  p_merkmale jsonb default '{}', p_geruch text[] default '{}', p_fehler text[] default '{}',
  p_nochmal boolean default null, p_kommentar text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $f$
declare m jsonb; alt public.bewertungen;
  erlaubt text[] := array['farbe','klarheit','schaum','intensitaet','bitter','suesse','malzhopfen','saeure','koerper','kohlensaeure','abgang'];
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

revoke execute on function public.vk_admin_teilnehmer(uuid, text),
  public.vk_admin_bewerten(uuid, uuid, integer, jsonb, text[], text[], boolean, text) from public, anon;
grant execute on function public.vk_admin_teilnehmer(uuid, text),
  public.vk_admin_bewerten(uuid, uuid, integer, jsonb, text[], text[], boolean, text) to authenticated;
