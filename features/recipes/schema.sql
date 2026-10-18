-- Koldingbräu – Bereich Rezepte: Rezepte, Anlagenprofil, Verbindung zu Suden (Stand 18.10.2026)
-- Setzt supabase/core.sql (Rollen) und features/brews/schema.sql (sude) voraus.

-- Anlagenprofil: Kennwerte der eigenen Brauanlage, damit Rezepte passend umgerechnet werden
create table public.anlagen (
  id serial primary key,
  name text not null unique check (length(trim(name)) between 1 and 60),
  sudhausausbeute numeric(4,1) not null default 65 check (sudhausausbeute between 30 and 95),   -- %
  verdampfung numeric(4,1) not null default 3 check (verdampfung between 0 and 20),              -- Liter je Stunde
  standard_menge numeric(5,1) not null default 20 check (standard_menge between 1 and 500),      -- Liter Ausschlagwürze
  notiz text check (length(notiz) <= 1000),
  geaendert timestamptz not null default now()
);
insert into public.anlagen (name) values ('Koldingbräu');

create table public.rezepte (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  stil text check (length(stil) <= 80),
  autor text check (length(autor) <= 100),
  quelle text check (length(quelle) <= 200),          -- z. B. „maischemalzundmehr.de“, „eigenes“, „aus Sud Nr. 12“
  beschreibung text check (length(beschreibung) <= 4000),
  anmerkung text check (length(anmerkung) <= 8000),
  -- Bezugsgrößen des Rezepts
  ausschlag numeric(6,2) check (ausschlag > 0),        -- Liter Ausschlagwürze, für die die Mengen gelten
  sudhausausbeute numeric(4,1),                         -- % laut Rezept
  stammwuerze numeric(4,1), bittere numeric(5,1), farbe numeric(5,1), alkohol numeric(4,1),   -- Kopfwerte laut Rezept
  -- Zutaten und Ablauf
  malze jsonb not null default '[]' check (jsonb_typeof(malze) = 'array'),         -- [{name, gramm, ebc}]
  maischform text, hauptguss numeric(6,2), nachguss numeric(6,2),
  einmaischtemperatur numeric(4,1), abmaischtemperatur numeric(4,1),
  rasten jsonb not null default '[]' check (jsonb_typeof(rasten) = 'array'),       -- [{temperatur, zeit}]
  kochzeit integer,
  hopfen jsonb not null default '[]' check (jsonb_typeof(hopfen) = 'array'),       -- [{sorte, gramm, alpha, zeit, typ}] typ: Vorderwuerze|Kochen|Whirlpool|Stopfen
  weitere jsonb not null default '[]' check (jsonb_typeof(weitere) = 'array'),     -- [{name, menge, einheit, zeitpunkt}]
  hefe text, gaertemperatur text, endvergaerungsgrad numeric(4,1), karbonisierung numeric(4,1),
  -- Herkunft und Stammbaum
  eltern_id uuid references public.rezepte(id) on delete set null,   -- geklont von
  aus_sud_id uuid references public.sude(id) on delete set null,     -- aus diesem Sud entstanden
  original jsonb,                                                     -- unveränderter Import zum Nachschlagen
  oeffentlich boolean not null default false,
  angelegt timestamptz not null default now(),
  angelegt_von uuid references public.profile(id) on delete set null default auth.uid(),
  geaendert timestamptz not null default now(),
  geaendert_von uuid references public.profile(id) on delete set null default auth.uid()
);
create index on public.rezepte (eltern_id);
create index on public.rezepte (aus_sud_id);
create index on public.rezepte (angelegt_von);
create index on public.rezepte (geaendert_von);
create trigger rezept_geaendert before update on public.rezepte for each row execute function private.sud_geaendert();

-- Sud aus Rezept: Kopie der Werte, plus Verweis aufs Rezept
alter table public.sude add column rezept_id uuid references public.rezepte(id) on delete set null;
create index on public.sude (rezept_id);
grant select (rezept_id) on public.sude to anon;

-- Rechte
revoke all on public.anlagen, public.rezepte from anon, authenticated;
revoke all on sequence public.anlagen_id_seq from anon, authenticated;
alter table public.anlagen enable row level security;
alter table public.rezepte enable row level security;

grant select on public.anlagen to authenticated;
grant update (name, sudhausausbeute, verdampfung, standard_menge, notiz, geaendert) on public.anlagen to authenticated;
create policy "Braumeister sehen Anlagen" on public.anlagen for select to authenticated using (private.ist_braumeister());
create policy "Admin ändert Anlagen" on public.anlagen for update to authenticated using (private.ist_admin()) with check (private.ist_admin());

grant select on public.rezepte to anon;
grant select, insert, update, delete on public.rezepte to authenticated;
create policy "Gäste sehen öffentliche Rezepte" on public.rezepte for select to anon using (oeffentlich);
create policy "Braumeister sehen Rezepte" on public.rezepte for select to authenticated using (private.ist_braumeister() or oeffentlich);
create policy "Braumeister legen Rezepte an" on public.rezepte for insert to authenticated with check (private.ist_braumeister());
create policy "Braumeister ändern Rezepte" on public.rezepte for update to authenticated using (private.ist_braumeister()) with check (private.ist_braumeister());
create policy "Admin löscht Rezepte" on public.rezepte for delete to authenticated using (private.ist_admin());

-- Stammbaum öffentlich zeigen: wie oft gebraut, mit Nummer/Datum (ohne Bewertung, ohne interne Sude)
create function public.rezept_sude(p_rezept uuid) returns table (id uuid, nr integer, datum date, oeffentlich boolean)
language sql stable security definer set search_path = '' as $f$
  select s.id, s.nr, s.datum, s.oeffentlich from public.sude s
  join public.rezepte r on r.id = s.rezept_id
  where s.rezept_id = p_rezept and (r.oeffentlich or private.ist_braumeister())
  order by s.datum
$f$;
revoke execute on function public.rezept_sude(uuid) from public;
grant execute on function public.rezept_sude(uuid) to anon, authenticated;
