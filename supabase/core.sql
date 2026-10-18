-- Koldingbräu – bereichsübergreifend: Profile, Rollen (Gast / Braumeister / Admin), Hilfsfunktionen (Stand 18.10.2026)
-- Die Tabellen der einzelnen Bereiche stehen in features/<bereich>/schema*.sql
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
