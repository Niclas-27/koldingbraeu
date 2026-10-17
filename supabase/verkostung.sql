-- Koldingbräu – Verkostungen und Liga (Stand 17.10.2026)
-- Gäste haben keinen Zugriff auf die Tabellen. Sie arbeiten nur über die vk_*-Funktionen
-- mit dem Code der Verkostung (aus dem QR-Code) und ihrem persönlichen Schlüssel (token).

-- Zufälliger Code für den QR-Link, ohne verwechselbare Zeichen (0/o, 1/l/i)
create function private.zufallscode() returns text language sql volatile security definer set search_path = '' as $f$
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + (get_byte(x.b, i) % 31), 1), '')
  from (select extensions.gen_random_bytes(10) as b) x, generate_series(0, 9) i
$f$;

-- Bierstile: kurze Liste, vom Admin erweiterbar
create table public.bierstile (
  id serial primary key,
  name text not null unique check (length(trim(name)) between 1 and 60),
  reihenfolge integer not null default 500
);
insert into public.bierstile (name, reihenfolge) values
  ('Pils',10),('Helles',20),('Export',30),('Kölsch',40),('Altbier',50),('Märzen',60),('Rotbier',70),
  ('Dunkel',80),('Schwarzbier',90),('Bock',100),('Weizen',110),('Dunkles Weizen',120),('Weizenbock',130),
  ('Pale Ale',140),('IPA',150),('Amber Ale',160),('Porter',170),('Stout',180),('Sauerbier',190),
  ('Alkoholfrei',200),('Sonstiges',900);

-- Biere: jedes Bier gibt es nur einmal, damit die Liga über mehrere Abende zählt
create table public.biere (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  brauerei text check (length(brauerei) <= 80),
  eigen boolean not null default false,
  stil_id integer references public.bierstile(id),
  alkohol numeric(4,1) check (alkohol between 0 and 30),
  sud_id uuid references public.sude(id) on delete set null,
  notiz text check (length(notiz) <= 1000),
  angelegt timestamptz not null default now(),
  angelegt_von uuid references public.profile(id) on delete set null default auth.uid()
);

create table public.verkostungen (
  id uuid primary key default gen_random_uuid(),
  titel text not null check (length(trim(titel)) between 1 and 100),
  datum date not null default current_date,
  ort text check (length(ort) <= 100),
  blind boolean not null default false,
  status text not null default 'vorbereitung' check (status in ('vorbereitung','laeuft','abgeschlossen')),
  code text not null unique default private.zufallscode(),
  angelegt timestamptz not null default now(),
  angelegt_von uuid references public.profile(id) on delete set null default auth.uid()
);

-- Probe = ein Bier in einer Verkostung, mit Nummer
create table public.proben (
  id uuid primary key default gen_random_uuid(),
  verkostung_id uuid not null references public.verkostungen(id) on delete cascade,
  bier_id uuid not null references public.biere(id) on delete restrict,
  nummer integer not null check (nummer between 1 and 99),
  constraint proben_nummer_eindeutig unique (verkostung_id, nummer) deferrable initially deferred,
  constraint proben_bier_eindeutig unique (verkostung_id, bier_id)
);

-- Teilnehmer gelten nur für einen Abend; token ist ihr geheimer Schlüssel (liegt nur auf ihrem Handy)
create table public.teilnehmer (
  id uuid primary key default gen_random_uuid(),
  verkostung_id uuid not null references public.verkostungen(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  token uuid not null unique default gen_random_uuid(),
  angelegt timestamptz not null default now()
);

create table public.bewertungen (
  id uuid primary key default gen_random_uuid(),
  probe_id uuid not null references public.proben(id) on delete cascade,
  teilnehmer_id uuid not null references public.teilnehmer(id) on delete cascade,
  note smallint not null check (note between 0 and 10),
  merkmale jsonb not null default '{}' check (jsonb_typeof(merkmale) = 'object'),
  geruch text[] not null default '{}',
  fehler text[] not null default '{}',
  nochmal boolean,
  kommentar text check (length(kommentar) <= 1000),
  ausgeblendet boolean not null default false,
  angelegt timestamptz not null default now(),
  geaendert timestamptz not null default now(),
  constraint bewertung_einmal unique (probe_id, teilnehmer_id)
);

-- Mitgebrachte Biere, die Gäste vor Beginn vorschlagen
create table public.vorschlaege (
  id uuid primary key default gen_random_uuid(),
  verkostung_id uuid not null references public.verkostungen(id) on delete cascade,
  teilnehmer_id uuid not null references public.teilnehmer(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  brauerei text check (length(brauerei) <= 80),
  stil text check (length(stil) <= 60),
  status text not null default 'offen' check (status in ('offen','uebernommen','abgelehnt')),
  angelegt timestamptz not null default now()
);

create index on public.biere (stil_id);
create index on public.biere (sud_id);
create index on public.biere (angelegt_von);
create index on public.verkostungen (angelegt_von);
create index on public.proben (bier_id);
create index on public.teilnehmer (verkostung_id);
create index on public.bewertungen (teilnehmer_id);
create index on public.vorschlaege (verkostung_id);
create index on public.vorschlaege (teilnehmer_id);

-- Rechte: Supabase vergibt standardmäßig alles an anon/authenticated – erst entziehen, dann gezielt erlauben
revoke all on public.bierstile, public.biere, public.verkostungen, public.proben, public.teilnehmer,
  public.bewertungen, public.vorschlaege from anon, authenticated;
revoke all on sequence public.bierstile_id_seq from anon, authenticated;

alter table public.bierstile enable row level security;
alter table public.biere enable row level security;
alter table public.verkostungen enable row level security;
alter table public.proben enable row level security;
alter table public.teilnehmer enable row level security;
alter table public.bewertungen enable row level security;
alter table public.vorschlaege enable row level security;

grant select on public.bierstile to anon, authenticated;
grant insert, update on public.bierstile to authenticated;
grant usage on sequence public.bierstile_id_seq to authenticated;
create policy "Alle sehen Bierstile" on public.bierstile for select to anon, authenticated using (true);
create policy "Admin legt Bierstile an" on public.bierstile for insert to authenticated with check (private.ist_admin());
create policy "Admin ändert Bierstile" on public.bierstile for update to authenticated using (private.ist_admin()) with check (private.ist_admin());

grant select, insert, update, delete on public.biere, public.verkostungen, public.proben to authenticated;
create policy "Braumeister sehen Biere" on public.biere for select to authenticated using (private.ist_braumeister());
create policy "Braumeister legen Biere an" on public.biere for insert to authenticated with check (private.ist_braumeister());
create policy "Braumeister ändern Biere" on public.biere for update to authenticated using (private.ist_braumeister()) with check (private.ist_braumeister());
create policy "Admin löscht Biere" on public.biere for delete to authenticated using (private.ist_admin());

create policy "Braumeister sehen Verkostungen" on public.verkostungen for select to authenticated using (private.ist_braumeister());
create policy "Braumeister legen Verkostungen an" on public.verkostungen for insert to authenticated with check (private.ist_braumeister());
create policy "Braumeister ändern Verkostungen" on public.verkostungen for update to authenticated using (private.ist_braumeister()) with check (private.ist_braumeister());
create policy "Admin löscht Verkostungen" on public.verkostungen for delete to authenticated using (private.ist_admin());

create policy "Braumeister sehen Proben" on public.proben for select to authenticated using (private.ist_braumeister());
create policy "Braumeister legen Proben an" on public.proben for insert to authenticated with check (private.ist_braumeister());
create policy "Braumeister ändern Proben" on public.proben for update to authenticated using (private.ist_braumeister()) with check (private.ist_braumeister());
create policy "Braumeister nehmen Proben heraus" on public.proben for delete to authenticated using (private.ist_braumeister());

grant select (id, verkostung_id, name, angelegt) on public.teilnehmer to authenticated;  -- ohne token
create policy "Braumeister sehen Teilnehmer" on public.teilnehmer for select to authenticated using (private.ist_braumeister());

grant select on public.bewertungen to authenticated;
grant update (ausgeblendet) on public.bewertungen to authenticated;
create policy "Braumeister sehen Bewertungen" on public.bewertungen for select to authenticated using (private.ist_braumeister());
create policy "Braumeister blenden Bewertungen aus" on public.bewertungen for update to authenticated using (private.ist_braumeister()) with check (private.ist_braumeister());

grant select on public.vorschlaege to authenticated;
grant update (status) on public.vorschlaege to authenticated;
create policy "Braumeister sehen Vorschläge" on public.vorschlaege for select to authenticated using (private.ist_braumeister());
create policy "Braumeister bearbeiten Vorschläge" on public.vorschlaege for update to authenticated using (private.ist_braumeister()) with check (private.ist_braumeister());

-- ---------- Funktionen für Gäste ----------

create function private.vk_finden(p_code text) returns public.verkostungen
language plpgsql stable security definer set search_path = '' as $f$
declare v public.verkostungen;
begin
  select * into v from public.verkostungen where code = lower(trim(p_code));
  if not found then raise exception 'Diese Verkostung gibt es nicht (mehr).' using errcode = 'P0002'; end if;
  return v;
end $f$;

create function private.vk_gast(p_verkostung uuid, p_token uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $f$
declare t uuid;
begin
  select id into t from public.teilnehmer where verkostung_id = p_verkostung and token = p_token;
  if t is null then raise exception 'Bitte zuerst mit deinem Namen beitreten.' using errcode = 'P0001'; end if;
  return t;
end $f$;

create function public.vk_beitreten(p_code text, p_name text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $f$
declare v public.verkostungen; t public.teilnehmer; n text := trim(coalesce(p_name, ''));
begin
  v := private.vk_finden(p_code);
  if v.status = 'abgeschlossen' then raise exception 'Diese Verkostung ist schon abgeschlossen.' using errcode = 'P0001'; end if;
  if length(n) < 1 or length(n) > 40 then raise exception 'Bitte einen Namen mit 1 bis 40 Zeichen eingeben.' using errcode = 'P0001'; end if;
  if (select count(*) from public.teilnehmer where verkostung_id = v.id) >= 100 then
    raise exception 'Diese Verkostung hat schon zu viele Teilnehmer.' using errcode = 'P0001'; end if;
  insert into public.teilnehmer (verkostung_id, name) values (v.id, n) returning * into t;
  return jsonb_build_object('id', t.id, 'token', t.token, 'name', t.name);
end $f$;

create function public.vk_laden(p_code text, p_token uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $f$
declare v public.verkostungen; t public.teilnehmer; offen boolean; res jsonb;
begin
  v := private.vk_finden(p_code);
  if p_token is not null then select * into t from public.teilnehmer where verkostung_id = v.id and token = p_token; end if;
  offen := not v.blind or v.status = 'abgeschlossen';
  res := jsonb_build_object(
    'verkostung', jsonb_build_object('titel', v.titel, 'datum', v.datum, 'ort', v.ort, 'blind', v.blind, 'status', v.status),
    'teilnehmer', (select count(*) from public.teilnehmer where verkostung_id = v.id),
    'proben', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'nummer', p.nummer,
        'bier', case when offen then jsonb_build_object('name', b.name, 'brauerei', b.brauerei, 'eigen', b.eigen,
                                                        'stil', s.name, 'alkohol', b.alkohol) end,
        'schnitt', st.schnitt, 'anzahl', coalesce(st.anzahl, 0), 'nochmal', coalesce(st.nochmal, 0)
      ) order by p.nummer)
      from public.proben p join public.biere b on b.id = p.bier_id left join public.bierstile s on s.id = b.stil_id
      left join lateral (select round(avg(w.note)::numeric, 2) as schnitt, count(*) as anzahl,
                                count(*) filter (where w.nochmal) as nochmal
                         from public.bewertungen w where w.probe_id = p.id and not w.ausgeblendet) st on true
      where p.verkostung_id = v.id), '[]'::jsonb),
    'ich', case when t.id is null then null else jsonb_build_object(
      'name', t.name,
      'bewertungen', coalesce((select jsonb_agg(jsonb_build_object('probe_id', w.probe_id, 'note', w.note, 'merkmale', w.merkmale,
                         'geruch', w.geruch, 'fehler', w.fehler, 'nochmal', w.nochmal, 'kommentar', w.kommentar))
                       from public.bewertungen w where w.teilnehmer_id = t.id), '[]'::jsonb),
      'vorschlaege', coalesce((select jsonb_agg(jsonb_build_object('name', x.name, 'brauerei', x.brauerei, 'stil', x.stil, 'status', x.status) order by x.angelegt)
                       from public.vorschlaege x where x.teilnehmer_id = t.id), '[]'::jsonb)) end);
  return res;
end $f$;

create function public.vk_bewerten(p_code text, p_token uuid, p_probe uuid, p_note integer,
  p_merkmale jsonb default '{}', p_geruch text[] default '{}', p_fehler text[] default '{}',
  p_nochmal boolean default null, p_kommentar text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $f$
declare v public.verkostungen; t uuid; m jsonb;
  erlaubt text[] := array['farbe','klarheit','schaum','intensitaet','bitter','suesse','malzhopfen','saeure','koerper','kohlensaeure','abgang'];
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

create function public.vk_vorschlagen(p_code text, p_token uuid, p_name text, p_brauerei text default null, p_stil text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $f$
declare v public.verkostungen; t uuid; n text := trim(coalesce(p_name, ''));
begin
  v := private.vk_finden(p_code);
  t := private.vk_gast(v.id, p_token);
  if v.status <> 'vorbereitung' then raise exception 'Biere vorschlagen geht nur vor Beginn der Verkostung.' using errcode = 'P0001'; end if;
  if length(n) < 1 or length(n) > 80 then raise exception 'Bitte den Namen des Biers eingeben.' using errcode = 'P0001'; end if;
  if (select count(*) from public.vorschlaege where teilnehmer_id = t) >= 5 then
    raise exception 'Du hast schon fünf Biere vorgeschlagen.' using errcode = 'P0001'; end if;
  insert into public.vorschlaege (verkostung_id, teilnehmer_id, name, brauerei, stil)
  values (v.id, t, n, nullif(left(trim(coalesce(p_brauerei, '')), 80), ''), nullif(left(trim(coalesce(p_stil, '')), 60), ''));
  return jsonb_build_object('ok', true);
end $f$;

-- ---------- Öffentlich: Ergebnisse und Liga (nur abgeschlossene Verkostungen, ohne Namen und Kommentare) ----------

create function public.vk_archiv() returns jsonb
language sql stable security definer set search_path = '' as $f$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', v.id, 'titel', v.titel, 'datum', v.datum, 'ort', v.ort, 'blind', v.blind,
    'teilnehmer', (select count(*) from public.teilnehmer t where t.verkostung_id = v.id),
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

-- Eine Zeile je Bier und Verkostung; zusammengefasst wird im Browser (je nach Filter)
create function public.liga_daten() returns table (bier_id uuid, name text, brauerei text, eigen boolean, stil text,
  datum date, summe bigint, anzahl bigint, nochmal bigint)
language sql stable security definer set search_path = '' as $f$
  select b.id, b.name, b.brauerei, b.eigen, s.name, v.datum, sum(w.note), count(*), count(*) filter (where w.nochmal)
  from public.bewertungen w
  join public.proben p on p.id = w.probe_id
  join public.verkostungen v on v.id = p.verkostung_id and v.status = 'abgeschlossen'
  join public.biere b on b.id = p.bier_id
  left join public.bierstile s on s.id = b.stil_id
  where not w.ausgeblendet
  group by b.id, b.name, b.brauerei, b.eigen, s.name, v.id, v.datum
$f$;

revoke execute on function public.vk_beitreten(text, text), public.vk_laden(text, uuid),
  public.vk_bewerten(text, uuid, uuid, integer, jsonb, text[], text[], boolean, text),
  public.vk_vorschlagen(text, uuid, text, text, text), public.vk_archiv(), public.liga_daten() from public;
grant execute on function public.vk_beitreten(text, text), public.vk_laden(text, uuid),
  public.vk_bewerten(text, uuid, uuid, integer, jsonb, text[], text[], boolean, text),
  public.vk_vorschlagen(text, uuid, text, text, text), public.vk_archiv(), public.liga_daten() to anon, authenticated;
revoke execute on function private.zufallscode(), private.vk_finden(text), private.vk_gast(uuid, uuid) from public, anon, authenticated;
grant execute on function private.zufallscode() to authenticated;  -- Standardwert beim Anlegen einer Verkostung
