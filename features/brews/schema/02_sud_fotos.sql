-- Ergänzung vom 25.10.2026: Fotogalerie je Sud (Brautag-Fotos mit optionaler Bildunterschrift),
-- Upload/Löschen/Bearbeiten nur durch Braumeister/Admin (anders als bei Verkostungen gibt es hier
-- keine Gäste-Uploads). Dateien liegen wie gehabt im Storage-Bucket „bilder" (siehe
-- features/tastings/schema/04_images.sql); in der Datenbank steht nur der Pfad.

create table public.sud_bilder (
  id uuid primary key default gen_random_uuid(),
  sud_id uuid not null references public.sude(id) on delete cascade,
  pfad text not null,
  bildunterschrift text,
  hochgeladen_von uuid references public.profile(id) on delete set null default auth.uid(),
  angelegt timestamptz not null default now()
);
create index on public.sud_bilder (sud_id);
create index on public.sud_bilder (hochgeladen_von);
revoke all on public.sud_bilder from anon, authenticated;
alter table public.sud_bilder enable row level security;

grant select on public.sud_bilder to anon, authenticated;
grant insert, update, delete on public.sud_bilder to authenticated;

-- Lesen: Braumeister sehen alle Galerien, alle anderen (Gast ohne wie mit Anmeldung) nur die
-- Fotos öffentlich geschalteter Sude – wie bei den übrigen Sud-Spalten.
create policy "Galerie lesen" on public.sud_bilder for select to anon, authenticated
  using (private.ist_braumeister() or exists (select 1 from public.sude s where s.id = sud_bilder.sud_id and s.oeffentlich));
create policy "Braumeister ergänzen Galerie" on public.sud_bilder for insert to authenticated
  with check (private.ist_braumeister());
create policy "Braumeister bearbeiten Galerie" on public.sud_bilder for update to authenticated
  using (private.ist_braumeister()) with check (private.ist_braumeister());
create policy "Braumeister löschen aus Galerie" on public.sud_bilder for delete to authenticated
  using (private.ist_braumeister());
