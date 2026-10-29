-- Koldingbräu – Bereich Sude: Tabelle sude und ihre Rechte (Stand 29.10.2026, siehe schema/06 für die
-- Umstellung von bewertung auf eine 0–10-Skala)
-- Setzt supabase/core.sql voraus (private.ist_braumeister, private.ist_admin).

create table public.sude (
  id uuid primary key default gen_random_uuid(),
  nr integer unique, datum date, datum_geschaetzt boolean not null default false,
  stil text, etikett text,
  bewertung numeric(3,1) check (bewertung is null or bewertung between 0 and 10), -- 10 = beste Note
  bewertung_schulnote_alt text, -- alte Schulnote (Freitext), nur zur Nachvollziehbarkeit
  hauptguss text, nachguss text, wasser text,
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
