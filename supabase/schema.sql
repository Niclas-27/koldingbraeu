-- Koldingbräu Braubuch – Datenbankschema (Stand 17.10.2026)
-- Hilfsfunktionen liegen im Schema "private", das nicht über die API erreichbar ist.

create schema if not exists private;

create table public.profile (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  rolle text check (rolle in ('admin','braumeister')),   -- null = kein Zugriff
  angelegt timestamptz not null default now()
);

create function private.rolle() returns text language sql stable security definer set search_path = ''
  as $$ select p.rolle from public.profile p where p.id = auth.uid() $$;
create function private.ist_braumeister() returns boolean language sql stable security definer set search_path = ''
  as $$ select coalesce(private.rolle() in ('admin','braumeister'), false) $$;
create function private.ist_admin() returns boolean language sql stable security definer set search_path = ''
  as $$ select coalesce(private.rolle() = 'admin', false) $$;

-- Neues Konto -> Profil; nur eingeladene Konten werden automatisch Braumeister
create function private.neues_konto() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profile (id, name, email, rolle)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)), new.email,
          case when new.invited_at is not null then 'braumeister' else null end);
  return new;
end $$;
create trigger nach_neuem_konto after insert on auth.users for each row execute function private.neues_konto();

-- E-Mail-Änderungen ins Profil übernehmen
create function private.konto_geaendert() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then update public.profile set email = new.email where id = new.id; end if;
  return new;
end $$;
create trigger nach_kontoaenderung after update on auth.users for each row execute function private.konto_geaendert();

-- Rollen ändert über die Website nur ein Admin (serverseitig ohne Nutzer erlaubt)
create function private.rolle_schuetzen() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.rolle is distinct from old.rolle and auth.uid() is not null and not private.ist_admin() then
    raise exception 'Nur ein Admin darf Rollen ändern';
  end if;
  return new;
end $$;
create trigger rolle_schuetzen before update on public.profile for each row execute function private.rolle_schuetzen();

alter table public.profile enable row level security;
grant select, update (name, rolle) on public.profile to authenticated;
create policy "Braumeister sehen alle Profile" on public.profile for select to authenticated
  using (private.ist_braumeister() or id = (select auth.uid()));
create policy "Eigenes Profil oder Admin ändert" on public.profile for update to authenticated
  using (id = (select auth.uid()) or private.ist_admin()) with check (id = (select auth.uid()) or private.ist_admin());

create table public.sude (
  id uuid primary key default gen_random_uuid(),
  nr integer unique, datum date, datum_geschaetzt boolean not null default false,
  stil text, etikett text, bewertung text, hauptguss text, nachguss text, wasser text,
  malz jsonb not null default '[]', maischplan jsonb not null default '[]',
  laeutern text, kochzeit text, wuerze text, stammwuerze text, hopfensorten text,
  hopfen jsonb not null default '[]', hefe text, hefemenge text, messungen text, restextrakt text, ausschlag text,
  biermenge numeric, zucker text, flaschen integer, alkohol text, abgefuellt text, notizen text, quelle text,
  oeffentlich boolean not null default false,
  angelegt timestamptz not null default now(),
  angelegt_von uuid references public.profile(id) on delete set null default auth.uid(),
  geaendert timestamptz not null default now(),
  geaendert_von uuid references public.profile(id) on delete set null default auth.uid()
);
-- Trigger sud_geaendert setzt geaendert/geaendert_von und schützt angelegt/angelegt_von

alter table public.sude enable row level security;
-- Gäste: nur freigegebene Sude und nur diese Spalten (ohne notizen, bewertung)
grant select (id, nr, datum, datum_geschaetzt, stil, etikett, hauptguss, nachguss, wasser, malz, maischplan,
  laeutern, kochzeit, wuerze, stammwuerze, hopfensorten, hopfen, hefe, hefemenge, messungen, restextrakt,
  ausschlag, biermenge, zucker, flaschen, alkohol, abgefuellt, oeffentlich) on public.sude to anon;
create policy "Gäste sehen freigegebene Sude" on public.sude for select to anon using (oeffentlich);
grant select, insert, update, delete on public.sude to authenticated;
create policy "Braumeister sehen alle Sude" on public.sude for select to authenticated using (private.ist_braumeister());
create policy "Braumeister legen Sude an" on public.sude for insert to authenticated with check (private.ist_braumeister());
create policy "Braumeister bearbeiten Sude" on public.sude for update to authenticated
  using (private.ist_braumeister()) with check (private.ist_braumeister());
create policy "Admin löscht Sude" on public.sude for delete to authenticated using (private.ist_admin());
