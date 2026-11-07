-- Bilder: Kronkorken + Flasche statt Etikett, Ausschnitte zum späteren Neuzuschneiden (07.11.2026)
-- Konzept „Verkostungs-Einladung & Foto-Zuschnitt“, Abschnitte „Fotos“.
--
-- TEIL A – nur hinzufügend, vor dem Veröffentlichen:
alter table public.sude add column if not exists bild_kronkorken text, add column if not exists bild_flasche text;
grant select (bild_kronkorken, bild_flasche) on public.sude to anon;   -- sude hat Spalten-Rechte für Gäste
alter table public.rezepte add column if not exists bild_kronkorken text, add column if not exists bild_flasche text;

-- Ausschnitt je hochgeladenem Bild: pfad = fertiges Großbild, basis_pfad = unbeschnittenes Bild (max. 1600 px,
-- „Variante B“) bzw. bei Altbildern das alte Großbild selbst. rahmen/quadrat als Anteile 0…1 des Basisbilds.
create table if not exists public.bild_ausschnitte (
  pfad text primary key,
  basis_pfad text not null,
  rahmen jsonb not null,
  quadrat jsonb,
  angelegt timestamptz not null default now(),
  angelegt_von uuid default auth.uid()
);
create index if not exists bild_ausschnitte_basis on public.bild_ausschnitte (basis_pfad);
alter table public.bild_ausschnitte enable row level security;
create policy "Braumeister lesen Ausschnitte" on public.bild_ausschnitte for select to authenticated using (private.ist_braumeister());
create policy "Braumeister legen Ausschnitte an" on public.bild_ausschnitte for insert to authenticated with check (private.ist_braumeister());
create policy "Braumeister ändern Ausschnitte" on public.bild_ausschnitte for update to authenticated using (private.ist_braumeister());
create policy "Braumeister löschen Ausschnitte" on public.bild_ausschnitte for delete to authenticated using (private.ist_braumeister());
grant select, insert, update, delete on public.bild_ausschnitte to authenticated;
revoke all on public.bild_ausschnitte from anon;   -- Supabase gibt neuen Tabellen sonst Standardrechte für anon

-- TEIL B – nach dem Veröffentlichen: vorhandene Etiketten werden zur Flasche (Entscheidung Nutzer), und Sud und
-- verknüpftes Bier teilen ab jetzt ihre Kronkorken-/Flaschenbilder (dieselbe Datei, kein Kopieren).
--
-- update public.sude set bild_flasche = coalesce(bild_flasche, bild_etikett), bild_etikett = null where bild_etikett is not null;
-- update public.rezepte set bild_flasche = coalesce(bild_flasche, bild_etikett), bild_etikett = null where bild_etikett is not null;
-- update public.sude s set bild_kronkorken = coalesce(s.bild_kronkorken, b.bild_kronkorken), bild_flasche = coalesce(s.bild_flasche, b.bild_flasche)
--   from public.biere b where b.sud_id = s.id;
-- update public.biere b set bild_kronkorken = coalesce(s.bild_kronkorken, b.bild_kronkorken), bild_flasche = coalesce(s.bild_flasche, b.bild_flasche)
--   from public.sude s where b.sud_id = s.id;
